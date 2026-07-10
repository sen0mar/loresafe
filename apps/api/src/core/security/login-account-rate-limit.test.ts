import { describe, expect, it } from "vitest";

import { createLoginAccountBucket } from "./rate-limit.js";

describe("login account rate-limit keys", () => {
  it("uses one non-reversible key for normalized forms of an account", () => {
    const canonical = createLoginAccountBucket({
      body: { email: "reader@example.com" }
    });
    const variant = createLoginAccountBucket({
      body: { email: " Reader@Example.com " }
    });

    expect(variant).toBe(canonical);
    expect(canonical).toMatch(/^[a-f0-9]{64}$/);
    expect(canonical).not.toContain("reader@example.com");
  });

  it("does not collapse distinct account identifiers", () => {
    expect(
      createLoginAccountBucket({ body: { email: "first@example.com" } })
    ).not.toBe(
      createLoginAccountBucket({ body: { email: "second@example.com" } })
    );
  });
});
