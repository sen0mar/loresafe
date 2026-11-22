import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "../../core/logging/logger.js";
import {
  createEmailDelivery,
  createResendTransport,
  EmailDeliveryError,
  type OutgoingEmail
} from "./email-delivery.js";

const token = "a".repeat(43);
const inOneDay = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

describe("email delivery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends one Resend request with the API key and a single recipient", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const transport = createResendTransport({
      apiKey: "re_test_key",
      from: "LoreSafe <noreply@loresafe.example>",
      fetchImpl
    });

    await transport({
      to: "reader@example.com",
      subject: "Subject",
      text: "Text",
      html: "<p>Html</p>"
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      Authorization: "Bearer re_test_key",
      "Content-Type": "application/json"
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init.body))).toEqual({
      from: "LoreSafe <noreply@loresafe.example>",
      to: ["reader@example.com"],
      subject: "Subject",
      text: "Text",
      html: "<p>Html</p>"
    });
  });

  it("rejects non-success provider responses with only the status", async () => {
    const transport = createResendTransport({
      apiKey: "re_test_key",
      from: "noreply@loresafe.example",
      fetchImpl: async () => new Response("quota", { status: 429 })
    });

    await expect(
      transport({ to: "r@example.com", subject: "s", text: "t", html: "h" })
    ).rejects.toEqual(new EmailDeliveryError(429));
  });

  it.each([
    [
      "sendEmailVerification",
      "/verify-email",
      "Verify your email for LoreSafe"
    ],
    ["sendPasswordReset", "/reset-password", "Reset your LoreSafe password"]
  ] as const)(
    "%s links to %s on the configured site origin",
    async (method, path, subject) => {
      const sent: OutgoingEmail[] = [];
      const delivery = createEmailDelivery({
        transport: async (email) => {
          sent.push(email);
        },
        linkOrigin: "https://www.loresafe.example",
        appName: "LoreSafe"
      });

      await delivery[method]({
        email: "reader@example.com",
        token,
        expiresAt: inOneDay()
      });

      const link = `https://www.loresafe.example${path}?token=${token}`;
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ to: "reader@example.com", subject });
      expect(sent[0]?.text).toContain(link);
      expect(sent[0]?.html).toContain(`href="${link}"`);
    }
  );

  it("logs failed deliveries without the recipient, link, or token", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const delivery = createEmailDelivery({
      transport: async () => {
        throw new EmailDeliveryError(401);
      },
      linkOrigin: "https://www.loresafe.example",
      appName: "LoreSafe"
    });

    await expect(
      delivery.sendEmailVerification({
        email: "reader@example.com",
        token,
        expiresAt: inOneDay()
      })
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith("Email delivery failed", {
      emailKind: "verification",
      providerStatus: 401,
      errorName: "EmailDeliveryError"
    });
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain("reader@example.com");
    expect(logged).not.toContain(token);
  });
});
