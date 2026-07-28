import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import {
  apiCacheControlMiddleware,
  securityHeadersMiddleware
} from "./security-headers.js";

describe("securityHeadersMiddleware", () => {
  it("applies the production browser security policy", async () => {
    const app = express();
    app.use(securityHeadersMiddleware);
    app.get("/", (_req, res) => res.send("ok"));

    const response = await request(app).get("/").expect(200);

    expect(response.headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'"
    );
    expect(response.headers["content-security-policy"]).toContain(
      "https://*.ingest.sentry.io"
    );
    expect(response.headers["content-security-policy"]).toContain(
      "https://*.ingest.de.sentry.io"
    );
    expect(response.headers["strict-transport-security"]).toContain(
      "max-age=63072000"
    );
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(response.headers["permissions-policy"]).toContain("camera=()");
    expect(response.headers["x-frame-options"]).toBe("DENY");
  });
});

describe("apiCacheControlMiddleware", () => {
  it("prevents sensitive API responses from being stored", async () => {
    const app = express();
    app.use("/api", apiCacheControlMiddleware);
    app.get("/api/auth/me", (_req, res) => res.json({ user: null }));

    const response = await request(app).get("/api/auth/me").expect(200);

    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.vary).toContain("Authorization");
    expect(response.headers.vary).toContain("Cookie");
  });

  it("gives explicitly public API responses a bounded shared policy", async () => {
    const app = express();
    app.use("/api", apiCacheControlMiddleware);
    app.get("/api/public/clubs", (_req, res) => res.json({ clubs: [] }));

    const response = await request(app).get("/api/public/clubs").expect(200);

    expect(response.headers["cache-control"]).toBe(
      "public, max-age=60, s-maxage=300"
    );
    expect(response.headers.vary).toBeUndefined();
  });
});
