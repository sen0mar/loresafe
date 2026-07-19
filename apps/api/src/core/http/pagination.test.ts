import { describe, expect, it } from "vitest";

import {
  boundedPageSchema,
  getBoundedPageOffset,
  maximumPageNumber
} from "./pagination.js";

describe("bounded page pagination", () => {
  it("rejects excessive page values", () => {
    expect(boundedPageSchema.safeParse(maximumPageNumber + 1).success).toBe(
      false
    );
  });

  it("keeps repository offsets within the explicit page bound", () => {
    expect(getBoundedPageOffset(maximumPageNumber, 50)).toBe(4_950);
    expect(() => getBoundedPageOffset(maximumPageNumber + 1, 50)).toThrow(
      RangeError
    );
  });
});
