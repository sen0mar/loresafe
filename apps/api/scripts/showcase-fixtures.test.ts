import { describe, expect, it } from "vitest";

import { showcaseClubs } from "../prisma/showcase/showcase.clubs.js";
import { showcaseUsers } from "../prisma/showcase/showcase.users.js";
import { validateShowcaseFixtures } from "../prisma/showcase/showcase.validation.js";

describe("showcase fixtures", () => {
  it("forms a complete internally consistent showcase dataset", () => {
    expect(validateShowcaseFixtures()).toEqual({
      users: 9,
      clubs: 4,
      memberships: 24,
      milestones: 33,
      posts: 24,
      comments: 28
    });
  });

  it("uses the requested franchise and visibility mix", () => {
    expect(
      showcaseClubs.map(({ title, visibility }) => ({ title, visibility }))
    ).toEqual([
      { title: "Hogwarts Reading Circle", visibility: "PUBLIC" },
      { title: "The Realm Remembers", visibility: "PUBLIC" },
      { title: "Galactic Saga Archive", visibility: "PRIVATE" },
      {
        title: "The Fellowship Reading Room",
        visibility: "INVITE_ONLY"
      }
    ]);
  });

  it("keeps natural usernames free of scenario labels", () => {
    const scenarioLabels =
      /owner|moderator|member|behind|ahead|strict|brave|finished|banned|outsider/i;

    for (const user of showcaseUsers) {
      expect(user.username).not.toMatch(scenarioLabels);
      expect(user.displayName).not.toMatch(scenarioLabels);
    }
  });
});
