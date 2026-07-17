import { describe, expect, it } from "vitest";

import { projectMilestoneSpoilerTitle } from "./milestone-title-projection.js";

describe("milestone spoiler-title projection", () => {
  it("hides spoiler titles beyond strict progress", () => {
    expect(
      projectMilestoneSpoilerTitle({
        currentMilestonePosition: 2,
        fullTitle: "The hidden reveal",
        mode: "STRICT",
        position: 3,
        spoilerName: true
      })
    ).toEqual({ fullTitle: null, isFullTitleHidden: true });
  });

  it("keeps safe and authorized titles visible", () => {
    expect(
      projectMilestoneSpoilerTitle({
        currentMilestonePosition: 3,
        fullTitle: "The reveal",
        mode: "STRICT",
        position: 3,
        spoilerName: true
      })
    ).toEqual({ fullTitle: "The reveal", isFullTitleHidden: false });

    expect(
      projectMilestoneSpoilerTitle({
        currentMilestonePosition: null,
        fullTitle: "Safe opening",
        mode: "STRICT",
        position: 1,
        spoilerName: false
      })
    ).toEqual({ fullTitle: "Safe opening", isFullTitleHidden: false });
  });
});
