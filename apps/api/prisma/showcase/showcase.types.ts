export type ShowcaseUserKey =
  | "maya"
  | "theo"
  | "nadia"
  | "liam"
  | "priya"
  | "owen"
  | "elena"
  | "jordan"
  | "samira";

export type ShowcaseClubKey =
  "harryPotter" | "gameOfThrones" | "starWars" | "lordOfTheRings";

export type ShowcasePostType =
  | "DISCUSSION"
  | "QUESTION"
  | "THEORY"
  | "PREDICTION"
  | "POLL"
  | "REACTION"
  | "REVIEW"
  | "QUOTE_COMMENTARY"
  | "JUST_REACHED";

export type ShowcaseUserFixture = {
  bio: string;
  displayName: string;
  email: string;
  key: ShowcaseUserKey;
  recruiter?: boolean;
  username: string;
};

export type ShowcaseMilestoneFixture = {
  description: string;
  fullTitle: string;
  position: number;
  safeTitle: string;
  spoilerName: boolean;
};

export type ShowcaseClubFixture = {
  category: "BOOKS" | "TV_SHOWS" | "MOVIES";
  description: string;
  key: ShowcaseClubKey;
  linkName: string;
  milestones: ShowcaseMilestoneFixture[];
  rules: string;
  title: string;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
};

export type ShowcaseMembershipFixture = {
  clubKey: ShowcaseClubKey;
  role: "OWNER" | "MODERATOR" | "MEMBER";
  userKey: ShowcaseUserKey;
};

export type ShowcaseProgressFixture = {
  clubKey: ShowcaseClubKey;
  milestonePosition: number;
  mode: "STRICT" | "BRAVE" | "FINISHED";
  userKey: ShowcaseUserKey;
};

export type ShowcasePostFixture = {
  authorKey: ShowcaseUserKey;
  body: string;
  clubKey: ShowcaseClubKey;
  daysAgo: number;
  key: string;
  milestonePosition: number;
  predictionRevealPosition?: number;
  reactionUserKeys: ShowcaseUserKey[];
  title: string;
  type: ShowcasePostType;
};

export type ShowcaseCommentFixture = {
  authorKey: ShowcaseUserKey;
  body: string;
  hoursAfterPost: number;
  key: string;
  milestonePosition: number;
  parentKey?: string;
  postKey: string;
  reactionUserKeys: ShowcaseUserKey[];
};
