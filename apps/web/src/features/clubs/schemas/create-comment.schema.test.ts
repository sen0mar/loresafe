import { describe, expect, it } from "vitest";

import { createCommentSchema } from "./create-comment.schema";

describe("createCommentSchema", () => {
  it("shows a clear message for empty comment bodies", () => {
    const result = createCommentSchema.safeParse({ body: "   " });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.body?.[0]).toBe(
        "Write a comment before posting."
      );
    }
  });
});
