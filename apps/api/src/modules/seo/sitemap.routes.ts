import { Router } from "express";

import { env, type AppEnv } from "../../config/env.js";
import { clubsService, type ClubsService } from "../clubs/clubs.service.js";

const sitemapUrlLimit = 50_000;
const staticSitemapPaths = ["/", "/clubs"] as const;
const publicClubSitemapLimit = sitemapUrlLimit - staticSitemapPaths.length;

export const createSitemapRouter = (
  service: ClubsService = clubsService,
  appEnv: AppEnv = env
) => {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      const clubEntries = await service.listPublicClubSitemapEntries(
        publicClubSitemapLimit
      );
      const sitemapEntries = [
        ...staticSitemapPaths.map((path) => ({
          path,
          lastmod: null
        })),
        ...clubEntries.map((entry) => ({
          path: `/clubs/${entry.linkName}`,
          lastmod: entry.updatedAt
        }))
      ];

      res
        .status(200)
        .type("application/xml")
        .set("Cache-Control", "public, max-age=300, s-maxage=3600")
        .send(renderSitemapXml(appEnv.PUBLIC_SITE_ORIGIN, sitemapEntries));
    } catch (error) {
      next(error);
    }
  });

  return router;
};

export const renderSitemapXml = (
  publicOrigin: string,
  entries: Array<{ path: string; lastmod: string | null }>
) => {
  const origin = publicOrigin.replace(/\/+$/, "");
  const urls = entries.map((entry) => {
    const loc = `${origin}${entry.path}`;
    const lastmod = entry.lastmod
      ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`
      : "";

    return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod}\n  </url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    ""
  ].join("\n");
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
