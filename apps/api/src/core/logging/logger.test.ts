import { describe, expect, it } from "vitest";

import { sanitizeError, sanitizePath } from "./logger.js";

describe("logger sanitization", () => {
  it("redacts sensitive URL path segments", () => {
    expect(
      sanitizePath(
        "/api/invites/abcdefghijklmnopqrstuvwxyz123456/accept"
      )
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
