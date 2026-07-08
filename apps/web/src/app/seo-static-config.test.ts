import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const canonicalOrigin = "https://loresafe.org";
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
    expect(html).toContain('<link rel="icon" href="/favicon.ico" sizes="any" />');
    expect(html).toContain('<link rel="icon" href="/icon.svg" type="image/svg+xml" />');
    expect(html).toContain(
      '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />'
    );
    expect(html).toContain(
      `<meta property="og:url" content="${canonicalOrigin}/" />`
    );
    expect(html).toContain(
      `<meta\n      property="og:image"\n      content="${canonicalOrigin}/og/loresafe-home.png"\n    />`
    );
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta property="og:image:height" content="630" />');
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain(`"url": "${canonicalOrigin}/"`);
    expect(html).toContain(
      [
        "<h1>",
        '            Lore<span style="color: #4f7fc0">S</span><span style="color: #4f7fc0">afe</span>',
        "          </h1>"
      ].join("\n")
    );
    expect(html).toContain(
      "Discuss books, shows, games, and courses without stumbling into"
    );
  });

  it("ships robots, manifest, icon, and stable social image assets", () => {
    const robots = readWebFile("public", "robots.txt");
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
    expect(existsSync(join(webRoot, "public", "sitemap.xml"))).toBe(false);
    expect(manifest.name).toBe("LoreSafe");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons).toContainEqual({
      src: "/icon.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any maskable"
    });
    expect(manifest.icons).toContainEqual({
      src: "/pwa-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable"
    });
    expect(manifest.icons).toContainEqual({
      src: "/pwa-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable"
    });
    expect(existsSync(join(webRoot, "public", "favicon.ico"))).toBe(true);
    expect(existsSync(join(webRoot, "public", "apple-touch-icon.png"))).toBe(
      true
    );
    expect(existsSync(join(webRoot, "public", "pwa-192.png"))).toBe(true);
    expect(existsSync(join(webRoot, "public", "pwa-512.png"))).toBe(true);
    expect(readWebFile("public", "icon.svg")).toContain("<title");
    expect(
      existsSync(join(webRoot, "public", "og", "loresafe-home.png"))
    ).toBe(true);
    expect(
      existsSync(join(webRoot, "public", "og", "loresafe-square.png"))
    ).toBe(true);
    expect(getPngDimensions("public", "og", "loresafe-home.png")).toEqual({
      width: 1200,
      height: 630
    });
    expect(getPngDimensions("public", "og", "loresafe-square.png")).toEqual({
      width: 512,
      height: 512
    });
    expect(getPngDimensions("public", "apple-touch-icon.png")).toEqual({
      width: 180,
      height: 180
    });
    expect(getPngDimensions("public", "pwa-192.png")).toEqual({
      width: 192,
      height: 192
    });
    expect(getPngDimensions("public", "pwa-512.png")).toEqual({
      width: 512,
      height: 512
    });
  });

  it("limits SPA rewrites and adds noindex headers to protected routes", () => {
    const vercelJson = readWebFile("vercel.json");
    const vercelConfig = JSON.parse(vercelJson) as {
      headers: Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>;
      redirects: Array<{
        source: string;
        has: Array<{ type: string; value: string }>;
        destination: string;
        permanent: boolean;
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

    expect(vercelJson.indexOf('"redirects"')).toBeLessThan(
      vercelJson.indexOf('"rewrites"')
    );
    expect(vercelConfig.redirects).toEqual([
      {
        source: "/",
        has: [
          {
            type: "host",
            value: "www.loresafe.org"
          }
        ],
        destination: "https://loresafe.org/",
        permanent: true
      },
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.loresafe.org"
          }
        ],
        destination: "https://loresafe.org/:path*",
        permanent: true
      },
      {
        source: "/",
        has: [
          {
            type: "host",
            value: "loresafe-web.vercel.app"
          }
        ],
        destination: "https://loresafe.org/",
        permanent: true
      },
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "loresafe-web.vercel.app"
          }
        ],
        destination: "https://loresafe.org/:path*",
        permanent: true
      }
    ]);
    expect(vercelConfig.rewrites).toContainEqual({
      source: "/api/:path*",
      destination: "https://api.loresafe.org/api/:path*"
    });
    expect(vercelConfig.rewrites).toContainEqual({
      source: "/sitemap.xml",
      destination: "https://api.loresafe.org/sitemap.xml"
    });
    expect(rewriteSources).toEqual([
      "/api/:path*",
      "/sitemap.xml",
      "/",
      "/clubs",
      "/clubs/:path*",
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

  it("keeps legacy hosts out of crawler-facing SEO files", () => {
    const seoSurfaceFiles = [
      "index.html",
      "public/robots.txt",
      "public/manifest.webmanifest",
      "src/shared/lib/public-site-origin.ts"
    ];

    for (const filePath of seoSurfaceFiles) {
      const content = readWebFile(...filePath.split("/"));

      expect(content).not.toContain("loresafe-web.vercel.app");
      expect(content).not.toContain("www.loresafe.org");
    }
  });
});

const getPngDimensions = (...pathSegments: string[]) => {
  const png = readFileSync(join(webRoot, ...pathSegments));

  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20)
  };
};
