import type { ShowcaseClubKey, ShowcaseUserKey } from "./showcase.types.js";

export type ShowcaseNotificationFixture = {
  clubKey: ShowcaseClubKey;
  commentKey?: string;
  daysAgo: number;
  key: string;
  milestonePosition: number;
  postKey?: string;
  read: boolean;
  safeText: string;
  type:
    "POST_COMMENT" | "COMMENT_REPLY" | "PROGRESS_UNLOCK" | "MODERATION_WARNING";
  userKey: ShowcaseUserKey;
};

export type ShowcaseReportFixture = {
  clubKey: ShowcaseClubKey;
  details: string;
  key: string;
  reason: "SPOILER" | "OFF_TOPIC";
  reporterKey: ShowcaseUserKey;
  status: "OPEN" | "RESOLVED";
  targetKey: string;
  targetType: "POST" | "COMMENT";
};

export const showcaseNotifications: ShowcaseNotificationFixture[] = [
  {
    key: "notification-hp-final-comment",
    userKey: "maya",
    clubKey: "harryPotter",
    type: "POST_COMMENT",
    safeText: "New comment in Hogwarts Reading Circle",
    postKey: "hp_final",
    commentKey: "hp_final_c1",
    milestonePosition: 7,
    daysAgo: 1,
    read: false
  },
  {
    key: "notification-got-unlock",
    userKey: "maya",
    clubKey: "gameOfThrones",
    type: "PROGRESS_UNLOCK",
    safeText: "New discussions unlocked in The Realm Remembers",
    postKey: "got_hardhome",
    milestonePosition: 5,
    daysAgo: 2,
    read: false
  },
  {
    key: "notification-sw-comment",
    userKey: "maya",
    clubKey: "starWars",
    type: "POST_COMMENT",
    safeText: "New comment in Galactic Saga Archive",
    postKey: "sw_trench",
    commentKey: "sw_trench_c1",
    milestonePosition: 4,
    daysAgo: 4,
    read: true
  },
  {
    key: "notification-lotr-comment",
    userKey: "maya",
    clubKey: "lordOfTheRings",
    type: "POST_COMMENT",
    safeText: "New comment in The Fellowship Reading Room",
    postKey: "lotr_moria",
    commentKey: "lotr_moria_c1",
    milestonePosition: 4,
    daysAgo: 5,
    read: true
  },
  {
    key: "notification-warning",
    userKey: "jordan",
    clubKey: "harryPotter",
    type: "MODERATION_WARNING",
    safeText: "A moderator sent you a club safety warning",
    milestonePosition: 1,
    daysAgo: 6,
    read: false
  }
];

export const showcaseReports: ShowcaseReportFixture[] = [
  {
    key: "report-open-hp",
    reporterKey: "elena",
    clubKey: "harryPotter",
    targetType: "POST",
    targetKey: "hp_tower",
    reason: "SPOILER",
    details:
      "The title may reveal too much about the tower scene for readers who have not finished year six.",
    status: "OPEN"
  },
  {
    key: "report-resolved-got",
    reporterKey: "maya",
    clubKey: "gameOfThrones",
    targetType: "COMMENT",
    targetKey: "got_red_c1",
    reason: "OFF_TOPIC",
    details:
      "The original version wandered into a later-season comparison; the discussion has been corrected.",
    status: "RESOLVED"
  }
];
