import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler } from "../../core/http/error-middleware.js";
import { prisma } from "../../core/prisma/client.js";
import { apiCacheControlMiddleware } from "../../core/security/security-headers.js";
import type { AuthUserDto } from "../auth/auth.dto.js";
import { createSitemapRouter } from "../seo/sitemap.routes.js";
import { createPublicClubsRouter } from "./clubs.routes.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

// Model a shared cache that honors Cache-Control and Vary, including cached 404s.
const createSharedCache = (app: express.Express) => {
  const entries: Array<{
    url: string;
    cookie: string;
    vary: string[];
    response: request.Response;
  }> = [];
  let originRequests = 0;
  return {
    get originRequests() {
      return originRequests;
    },
    get: async (url: string, cookie = "") => {
      const entry = entries.find(
        (entry) =>
          entry.url === url &&
          (!entry.vary.includes("cookie") || entry.cookie === cookie)
      );
      if (entry) return entry.response;
      originRequests++;
      const response = await request(app).get(url).set("Cookie", cookie);
      const policy = String(response.headers["cache-control"] ?? "");
      const vary = String(response.headers.vary ?? "")
        .toLowerCase()
        .split(/\s*,\s*/);
      if (
        /\bpublic\b/.test(policy) &&
        !/\b(private|no-store)\b/.test(policy) &&
        !vary.includes("*") &&
        [200, 404].includes(response.status)
      ) {
        entries.push({ url, cookie, vary, response });
      }
      return response;
    }
  };
};

describeDatabase("public club cache isolation", () => {
  it("isolates identical URLs for anonymous, banned, and eligible readers in every order", async () => {
    const suffix = crypto.randomUUID();
    const linkName = `cache-${suffix}`;
    const users: AuthUserDto[] = [];
    let clubId: string | undefined;
    try {
      for (const label of ["banned", "eligible"]) {
        const user = await prisma.user.create({
          data: {
            email: `${label}-${suffix}@example.com`,
            displayName: `${label}-${suffix}`,
            username: `${label}_${suffix}`.slice(0, 30),
            passwordHash: "cache-test-unused-password"
          }
        });
        users.push({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          username: user.username!,
          bio: null,
          avatarUrl: null,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString()
        });
      }
      const club = await prisma.club.create({
        data: {
          title: "Public cache fixture",
          linkName,
          visibility: "PUBLIC",
          category: "CUSTOM_TIMELINE",
          bans: { create: { userId: users[0]!.id } }
        }
      });
      clubId = club.id;
      const app = express();
      app.use(cookieParser());
      app.use("/api", apiCacheControlMiddleware);
      app.use(
        "/api/public/clubs",
        createPublicClubsRouter(undefined, {
          // Identity injection leaves real controllers, services, and PostgreSQL ban queries intact.
          loadCurrentUser: (req, _res, next) => {
            req.currentUser =
              users.find((user) => user.id === req.cookies.reader) ?? null;
            next();
          },
          requireUser: (_req, _res, next) => next()
        })
      );
      app.use("/sitemap.xml", createSitemapRouter());
      app.use(errorHandler);
      const readers = ["", `reader=${users[0]!.id}`, `reader=${users[1]!.id}`];
      const orders = [
        [0, 1, 2],
        [0, 2, 1],
        [1, 0, 2],
        [1, 2, 0],
        [2, 0, 1],
        [2, 1, 0]
      ];
      for (const url of [
        "/api/public/clubs?limit=50",
        `/api/public/clubs/${linkName}`
      ]) {
        for (const order of orders) {
          const cache = createSharedCache(app);
          for (const reader of [...order, ...order]) {
            const response = await cache.get(url, readers[reader]);
            const banned = reader === 1;
            expect(response.headers["cache-control"]).toBe("private, no-store");
            expect(response.headers.vary).toContain("Cookie");
            expect(response.headers.vary).toContain("Authorization");
            if (url.includes("?")) {
              expect(response.status).toBe(200);
              expect(
                response.body.clubs.some(
                  (entry: { id: string }) => entry.id === club.id
                )
              ).toBe(!banned);
            } else {
              expect(response.status).toBe(banned ? 404 : 200);
              if (!banned) expect(response.body.club.id).toBe(club.id);
            }
          }
          expect(cache.originRequests).toBe(6);
        }
      }
      // The sitemap intentionally ignores identity; prove the cache really reuses public responses.
      const sitemapCache = createSharedCache(app);
      for (const cookie of readers) {
        const response = await sitemapCache.get("/sitemap.xml", cookie);
        expect(response.status).toBe(200);
        expect(response.text).toContain(`/clubs/${linkName}`);
        expect(response.headers["cache-control"]).toBe(
          "public, max-age=300, s-maxage=3600"
        );
      }
      expect(sitemapCache.originRequests).toBe(1);
      const directSitemap = await request(app)
        .get("/sitemap.xml")
        .set("Cookie", readers[1]!);
      expect(directSitemap.text).toBe(
        (await sitemapCache.get("/sitemap.xml")).text
      );
    } finally {
      if (clubId) await prisma.club.deleteMany({ where: { id: clubId } });
      await prisma.user.deleteMany({
        where: { id: { in: users.map((user) => user.id) } }
      });
    }
  });
});
