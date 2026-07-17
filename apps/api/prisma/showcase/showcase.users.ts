import type {
  ShowcaseMembershipFixture,
  ShowcaseProgressFixture,
  ShowcaseUserFixture
} from "./showcase.types.js";

export const showcaseUsers: ShowcaseUserFixture[] = [
  {
    key: "maya",
    recruiter: true,
    email: "recruiter.demo@loresafe.org",
    displayName: "Maya Chen",
    username: "maya_chen",
    bio: "Fantasy reader, patient theory-builder, and enthusiastic rereader."
  },
  {
    key: "theo",
    email: "theo.bennett@demo.loresafe.org",
    displayName: "Theo Bennett",
    username: "theo_bennett",
    bio: "Here for careful episode breakdowns and wildly specific predictions."
  },
  {
    key: "nadia",
    email: "nadia.flores@demo.loresafe.org",
    displayName: "Nadia Flores",
    username: "nadia_flores",
    bio: "Usually a few chapters behind, always taking notes."
  },
  {
    key: "liam",
    email: "liam.carter@demo.loresafe.org",
    displayName: "Liam Carter",
    username: "liam_carter",
    bio: "Finished the books, rewatching the adaptations, comparing everything."
  },
  {
    key: "priya",
    email: "priya.shah@demo.loresafe.org",
    displayName: "Priya Shah",
    username: "priya_shah",
    bio: "No hints, no winks, no suspiciously specific encouragement."
  },
  {
    key: "owen",
    email: "owen.brooks@demo.loresafe.org",
    displayName: "Owen Brooks",
    username: "owen_brooks",
    bio: "Occasionally brave enough to peek beyond the current checkpoint."
  },
  {
    key: "elena",
    email: "elena.rossi@demo.loresafe.org",
    displayName: "Elena Rossi",
    username: "elena_rossi",
    bio: "A serial finisher who loves revisiting the clues that were hiding in plain sight."
  },
  {
    key: "jordan",
    email: "jordan.blake@demo.loresafe.org",
    displayName: "Jordan Blake",
    username: "jordan_blake",
    bio: "Movie marathons, midnight premieres, and strong opinions about finales."
  },
  {
    key: "samira",
    email: "samira.khan@demo.loresafe.org",
    displayName: "Samira Khan",
    username: "samira_khan",
    bio: "Browsing for a new club and trying very hard not to read the locked cards."
  }
];

export const showcaseMemberships: ShowcaseMembershipFixture[] = [
  { userKey: "maya", clubKey: "harryPotter", role: "OWNER" },
  { userKey: "theo", clubKey: "harryPotter", role: "MODERATOR" },
  { userKey: "nadia", clubKey: "harryPotter", role: "MEMBER" },
  { userKey: "liam", clubKey: "harryPotter", role: "MEMBER" },
  { userKey: "priya", clubKey: "harryPotter", role: "MEMBER" },
  { userKey: "owen", clubKey: "harryPotter", role: "MEMBER" },
  { userKey: "elena", clubKey: "harryPotter", role: "MEMBER" },

  { userKey: "theo", clubKey: "gameOfThrones", role: "OWNER" },
  { userKey: "maya", clubKey: "gameOfThrones", role: "MODERATOR" },
  { userKey: "nadia", clubKey: "gameOfThrones", role: "MEMBER" },
  { userKey: "liam", clubKey: "gameOfThrones", role: "MEMBER" },
  { userKey: "owen", clubKey: "gameOfThrones", role: "MEMBER" },
  { userKey: "elena", clubKey: "gameOfThrones", role: "MEMBER" },
  { userKey: "jordan", clubKey: "gameOfThrones", role: "MEMBER" },

  { userKey: "elena", clubKey: "starWars", role: "OWNER" },
  { userKey: "liam", clubKey: "starWars", role: "MODERATOR" },
  { userKey: "maya", clubKey: "starWars", role: "MEMBER" },
  { userKey: "priya", clubKey: "starWars", role: "MEMBER" },
  { userKey: "owen", clubKey: "starWars", role: "MEMBER" },

  { userKey: "liam", clubKey: "lordOfTheRings", role: "OWNER" },
  { userKey: "theo", clubKey: "lordOfTheRings", role: "MODERATOR" },
  { userKey: "maya", clubKey: "lordOfTheRings", role: "MEMBER" },
  { userKey: "nadia", clubKey: "lordOfTheRings", role: "MEMBER" },
  { userKey: "elena", clubKey: "lordOfTheRings", role: "MEMBER" }
];

export const showcaseProgress: ShowcaseProgressFixture[] = [
  {
    userKey: "maya",
    clubKey: "harryPotter",
    milestonePosition: 7,
    mode: "FINISHED"
  },
  {
    userKey: "theo",
    clubKey: "harryPotter",
    milestonePosition: 6,
    mode: "BRAVE"
  },
  {
    userKey: "nadia",
    clubKey: "harryPotter",
    milestonePosition: 2,
    mode: "STRICT"
  },
  {
    userKey: "liam",
    clubKey: "harryPotter",
    milestonePosition: 6,
    mode: "STRICT"
  },
  {
    userKey: "priya",
    clubKey: "harryPotter",
    milestonePosition: 3,
    mode: "STRICT"
  },
  {
    userKey: "owen",
    clubKey: "harryPotter",
    milestonePosition: 4,
    mode: "BRAVE"
  },
  {
    userKey: "elena",
    clubKey: "harryPotter",
    milestonePosition: 7,
    mode: "FINISHED"
  },

  {
    userKey: "theo",
    clubKey: "gameOfThrones",
    milestonePosition: 8,
    mode: "FINISHED"
  },
  {
    userKey: "maya",
    clubKey: "gameOfThrones",
    milestonePosition: 5,
    mode: "STRICT"
  },
  {
    userKey: "nadia",
    clubKey: "gameOfThrones",
    milestonePosition: 2,
    mode: "STRICT"
  },
  {
    userKey: "liam",
    clubKey: "gameOfThrones",
    milestonePosition: 7,
    mode: "STRICT"
  },
  {
    userKey: "owen",
    clubKey: "gameOfThrones",
    milestonePosition: 4,
    mode: "BRAVE"
  },
  {
    userKey: "elena",
    clubKey: "gameOfThrones",
    milestonePosition: 8,
    mode: "FINISHED"
  },
  {
    userKey: "jordan",
    clubKey: "gameOfThrones",
    milestonePosition: 3,
    mode: "STRICT"
  },

  {
    userKey: "elena",
    clubKey: "starWars",
    milestonePosition: 9,
    mode: "FINISHED"
  },
  {
    userKey: "liam",
    clubKey: "starWars",
    milestonePosition: 9,
    mode: "FINISHED"
  },
  {
    userKey: "maya",
    clubKey: "starWars",
    milestonePosition: 4,
    mode: "STRICT"
  },
  {
    userKey: "priya",
    clubKey: "starWars",
    milestonePosition: 2,
    mode: "STRICT"
  },
  { userKey: "owen", clubKey: "starWars", milestonePosition: 6, mode: "BRAVE" },

  {
    userKey: "liam",
    clubKey: "lordOfTheRings",
    milestonePosition: 9,
    mode: "FINISHED"
  },
  {
    userKey: "theo",
    clubKey: "lordOfTheRings",
    milestonePosition: 9,
    mode: "FINISHED"
  },
  {
    userKey: "maya",
    clubKey: "lordOfTheRings",
    milestonePosition: 4,
    mode: "STRICT"
  },
  {
    userKey: "nadia",
    clubKey: "lordOfTheRings",
    milestonePosition: 2,
    mode: "STRICT"
  },
  {
    userKey: "elena",
    clubKey: "lordOfTheRings",
    milestonePosition: 9,
    mode: "FINISHED"
  }
];

export const showcaseBan = {
  userKey: "jordan",
  clubKey: "harryPotter",
  reason:
    "Repeatedly posted unmarked finale spoilers after a moderator warning."
} as const;
