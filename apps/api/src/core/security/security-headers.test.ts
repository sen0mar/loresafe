import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { securityHeadersMiddleware } from "./security-headers.js";

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
