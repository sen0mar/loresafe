import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const canonicalOrigin = "https://loresafe-web.vercel.app";
const webRoot = process.cwd();

const readWebFile = (...pathSegments: string[]) =>
  readFileSync(join(webRoot, ...pathSegments), "utf8");

describe("static SEO configuration", () => {
  it("ships homepage metadata and crawlable public copy in initial HTML", () => {
    const html = readWebFile("index.html");

    expect(html).toContain(
      "<title>LoreSafe | Spoiler-safe clubs for books, shows, games, and courses</title>"
    );
    expect(html).toContain('name="description"');
    expect(html).toContain(
      `content="Discuss stories without accidental spoilers. LoreSafe matches every club conversation to each member's progress."`
    );
    expect(html).toContain(
      `<link rel="canonical" href="${canonicalOrigin}/" />`
    );
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<link rel="icon" href="/icon.svg" type="image/svg+xml" />');
    expect(html).toContain(
      `<meta property="og:url" content="${canonicalOrigin}/" />`
    );
    expect(html).toContain(
      `<meta\n      property="og:image"\n      content="${canonicalOrigin}/og/loresafe-home.png"\n    />`
    );
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain(`"url": "${canonicalOrigin}/"`);
    expect(html).toContain("<h1>LoreSafe</h1>");
    expect(html).toContain(
      "Discuss books, shows, games, and courses without stumbling into"
    );
  });

  it("ships robots, sitemap, manifest, icon, and stable OG image assets", () => {
    const robots = readWebFile("public", "robots.txt");
    const sitemap = readWebFile("public", "sitemap.xml");
    const manifest = JSON.parse(
      readWebFile("public", "manifest.webmanifest")
    ) as {
      icons: Array<{ src: string; sizes: string; type: string }>;
      name: string;
      start_url: string;
    };

    expect(robots).toContain(
      `Sitemap: ${canonicalOrigin}/sitemap.xml`
    );
    expect(robots).not.toContain("Disallow: /app");
    expect(robots).not.toContain("Disallow: /api");
    expect(sitemap).toContain(`<loc>${canonicalOrigin}/</loc>`);
    expect(sitemap).not.toContain(`${canonicalOrigin}/app`);
    expect(sitemap).not.toContain(`${canonicalOrigin}/login`);
    expect(manifest.name).toBe("LoreSafe");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons).toContainEqual({
      src: "/icon.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any maskable"
    });
    expect(readWebFile("public", "icon.svg")).toContain("<title");
    expect(
      existsSync(join(webRoot, "public", "og", "loresafe-home.png"))
    ).toBe(true);
  });

  it("limits SPA rewrites and adds noindex headers to protected routes", () => {
    const vercelConfig = JSON.parse(readWebFile("vercel.json")) as {
      headers: Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>;
      rewrites: Array<{ source: string; destination: string }>;
    };
    const rewriteSources = vercelConfig.rewrites.map((rewrite) => rewrite.source);
    const noindexSources = vercelConfig.headers
      .filter((headerConfig) =>
        headerConfig.headers.some(
          (header) =>
            header.key === "X-Robots-Tag" &&
            header.value === "noindex, nofollow"
        )
      )
      .map((headerConfig) => headerConfig.source);

    expect(vercelConfig.rewrites).toContainEqual({
      source: "/api/:path*",
      destination: "https://loresafe-api.onrender.com/api/:path*"
    });
    expect(rewriteSources).toEqual([
      "/api/:path*",
      "/",
      "/app",
      "/app/:path*",
      "/invite/:path*",
      "/login",
      "/signup"
    ]);
    expect(rewriteSources).not.toContain("/(.*)");
    expect(rewriteSources).not.toContain("/:path*");
    expect(noindexSources).toEqual([
      "/api/:path*",
      "/app",
      "/app/:path*",
      "/invite/:path*",
      "/login",
      "/signup"
    ]);
  });
});
