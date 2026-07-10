import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { configureTrustedProxy } from "./trusted-proxy.js";

const createClientIpApp = (trustedProxyCidrs: string[]) => {
  const app = express();

  configureTrustedProxy(app, trustedProxyCidrs);
  app.get("/client-ip", (req, res) => {
    res.status(200).json({ ip: req.ip, ips: req.ips });
  });

  return app;
};

describe("trusted proxy configuration", () => {
  it("ignores forwarded addresses when the direct peer is not trusted", async () => {
    const response = await request(createClientIpApp([]))
      .get("/client-ip")
      .set("x-forwarded-for", "198.51.100.25");

    expect(response.status).toBe(200);
    expect(response.body.ip).not.toBe("198.51.100.25");
    expect(response.body.ips).toEqual([]);
  });

  it("uses the first untrusted address behind explicitly trusted proxies", async () => {
    const response = await request(
      createClientIpApp(["loopback", "uniquelocal"])
    )
      .get("/client-ip")
      .set("x-forwarded-for", "198.51.100.25, 10.0.0.12");

    expect(response.status).toBe(200);
    expect(response.body.ip).toBe("198.51.100.25");
    expect(response.body.ips).toEqual(["198.51.100.25", "10.0.0.12"]);
  });

  it("stops at an untrusted intermediary instead of accepting a spoofed client", async () => {
    const response = await request(createClientIpApp(["loopback"]))
      .get("/client-ip")
      .set("x-forwarded-for", "198.51.100.25, 203.0.113.10");

    expect(response.status).toBe(200);
    expect(response.body.ip).toBe("203.0.113.10");
  });
});
