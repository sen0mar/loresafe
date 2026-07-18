import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve("src/styles.css"), "utf8");

describe("responsive design scale", () => {
  it("keeps a 16px baseline and scales by the viewport's limiting dimension", () => {
    expect(styles).toContain(
      "font-size: clamp(16px, min(1.041667vw, 1.851852svh), 40px);"
    );
  });
});
