import { describe, expect, it, vi } from "vitest";

import { logger, sanitizeError, sanitizePath } from "./logger.js";

describe("logger sanitization", () => {
  it("redacts sensitive URL path segments", () => {
    expect(
      sanitizePath("/api/invites/abcdefghijklmnopqrstuvwxyz123456/accept")
    ).toBe("/api/invites/:redacted/accept");
  });

  it("redacts bearer tokens, JWTs, and private signed URLs from errors", () => {
    const error = new Error(
      [
        "failed with Bearer abc.def.ghi",
        "jwt abc.def.ghi",
        "url https://bucket.example/file?X-Amz-Signature=secret"
      ].join(" ")
    );

    expect(sanitizeError(error)).toEqual({
      name: "Error",
      message:
        "failed with Bearer [redacted] jwt [redacted-jwt] url [redacted-url]"
    });
  });
});

it("scrubs reset/verification URLs and nested referrers in actual log output", () => {
  const output = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const token = "LOG_SENTINEL_TOKEN_112233";
  logger.info(`Failed /reset-password?token=${token}`, {
    nested: {
      headers: { Referer: `/verify-email?token=${token}` },
      args: [`/invite/${token}`]
    }
  });
  const serialized = String(output.mock.calls[0]?.[0]);
  expect(serialized).not.toContain(token);
  expect(JSON.parse(serialized).level).toBe("info");
  output.mockRestore();
});
