import {
  showcaseNotifications,
  showcaseReports
} from "./showcase.activities.js";
import { showcaseClubs } from "./showcase.clubs.js";
import { showcaseComments, showcasePosts } from "./showcase.discussions.js";
import {
  showcaseBan,
  showcaseMemberships,
  showcaseProgress,
  showcaseUsers
} from "./showcase.users.js";
import type { ShowcaseClubKey, ShowcaseUserKey } from "./showcase.types.js";

export type ShowcaseFixtureSummary = {
  clubs: number;
  comments: number;
  memberships: number;
  milestones: number;
  posts: number;
  users: number;
};

export const validateShowcaseFixtures = (): ShowcaseFixtureSummary => {
  assertUnique(
    showcaseUsers.map((user) => user.key),
    "user keys"
  );
  assertUnique(
    showcaseUsers.map((user) => user.username),
    "usernames"
  );
  assertUnique(
    showcaseUsers.map((user) => user.email),
    "user emails"
  );
  assertUnique(
    showcaseClubs.map((club) => club.key),
    "club keys"
  );
  assertUnique(
    showcaseClubs.map((club) => club.linkName),
    "club link names"
  );
  assertUnique(
    showcasePosts.map((post) => post.key),
    "post keys"
  );
  assertUnique(
    showcaseComments.map((comment) => comment.key),
    "comment keys"
  );
  assertUnique(
    showcaseNotifications.map((notification) => notification.key),
    "notification keys"
  );
  assertUnique(
    showcaseReports.map((report) => report.key),
    "report keys"
  );

  const userKeys = new Set(showcaseUsers.map((user) => user.key));
  const clubs = new Map(showcaseClubs.map((club) => [club.key, club]));
  const memberships = new Set(
    showcaseMemberships.map(({ clubKey, userKey }) => `${userKey}:${clubKey}`)
  );
  const progress = new Map(
    showcaseProgress.map((row) => [`${row.userKey}:${row.clubKey}`, row])
  );
  const posts = new Map(showcasePosts.map((post) => [post.key, post]));
  const comments = new Map(
    showcaseComments.map((comment) => [comment.key, comment])
  );

  assertUnique([...memberships], "memberships");
  assertUnique([...progress.keys()], "progress rows");

  for (const club of showcaseClubs) {
    const positions = club.milestones.map((milestone) => milestone.position);
    assertUnique(positions, `${club.key} milestone positions`);
    assert(
      positions.every((position, index) => position === index + 1),
      `${club.key} milestones must be contiguous from position one`
    );
  }

  for (const membership of showcaseMemberships) {
    assertReference(userKeys, membership.userKey, "membership user");
    assertReference(clubs, membership.clubKey, "membership club");
  }

  for (const row of showcaseProgress) {
    assert(
      memberships.has(`${row.userKey}:${row.clubKey}`),
      `Progress requires membership for ${row.userKey}:${row.clubKey}`
    );
    assertMilestonePosition(clubs, row.clubKey, row.milestonePosition);
  }

  assert(
    !memberships.has(`${showcaseBan.userKey}:${showcaseBan.clubKey}`),
    "The banned showcase user must not retain a membership in the banned club"
  );

  for (const post of showcasePosts) {
    assertReference(userKeys, post.authorKey, "post author");
    assertReference(clubs, post.clubKey, "post club");
    assertMilestonePosition(clubs, post.clubKey, post.milestonePosition);
    assertUserCanReach(
      memberships,
      progress,
      post.authorKey,
      post.clubKey,
      post.milestonePosition,
      "post author"
    );

    if (post.type === "PREDICTION") {
      assert(
        post.predictionRevealPosition !== undefined &&
          post.predictionRevealPosition >= post.milestonePosition,
        `Prediction ${post.key} requires a valid reveal position`
      );
      assertMilestonePosition(
        clubs,
        post.clubKey,
        post.predictionRevealPosition
      );
    } else {
      assert(
        post.predictionRevealPosition === undefined,
        `Non-prediction ${post.key} cannot have a reveal position`
      );
    }

    for (const userKey of post.reactionUserKeys) {
      assertUserCanReach(
        memberships,
        progress,
        userKey,
        post.clubKey,
        post.milestonePosition,
        "post reactor"
      );
    }
  }

  for (const comment of showcaseComments) {
    const post = posts.get(comment.postKey);
    assert(post, `Comment ${comment.key} references a missing post`);
    assert(
      comment.milestonePosition >= post.milestonePosition,
      `Comment ${comment.key} cannot require an earlier milestone than its post`
    );
    assertMilestonePosition(clubs, post.clubKey, comment.milestonePosition);
    assertUserCanReach(
      memberships,
      progress,
      comment.authorKey,
      post.clubKey,
      comment.milestonePosition,
      "comment author"
    );

    if (comment.parentKey) {
      const parent = comments.get(comment.parentKey);
      assert(parent, `Comment ${comment.key} references a missing parent`);
      assert(
        parent.postKey === comment.postKey,
        `Comment ${comment.key} parent must belong to the same post`
      );
    }

    for (const userKey of comment.reactionUserKeys) {
      assertUserCanReach(
        memberships,
        progress,
        userKey,
        post.clubKey,
        comment.milestonePosition,
        "comment reactor"
      );
    }
  }

  for (const notification of showcaseNotifications) {
    assertReference(userKeys, notification.userKey, "notification user");
    assertMilestonePosition(
      clubs,
      notification.clubKey,
      notification.milestonePosition
    );

    if (notification.postKey) {
      const post = posts.get(notification.postKey);
      assert(
        post,
        `Notification ${notification.key} references a missing post`
      );
      assert(
        post.clubKey === notification.clubKey,
        `Notification ${notification.key} post must belong to its club`
      );
    }

    if (notification.commentKey) {
      assert(
        comments.has(notification.commentKey),
        `Notification ${notification.key} references a missing comment`
      );
    }
  }

  for (const report of showcaseReports) {
    const milestonePosition =
      report.targetType === "POST"
        ? requirePost(posts, report.targetKey).milestonePosition
        : requireComment(comments, report.targetKey).milestonePosition;
    assertUserCanReach(
      memberships,
      progress,
      report.reporterKey,
      report.clubKey,
      milestonePosition,
      "reporter"
    );
  }

  assertCoverage();

  return {
    users: showcaseUsers.length,
    clubs: showcaseClubs.length,
    memberships: showcaseMemberships.length,
    milestones: showcaseClubs.reduce(
      (total, club) => total + club.milestones.length,
      0
    ),
    posts: showcasePosts.length,
    comments: showcaseComments.length
  };
};

const assertCoverage = () => {
  const roles = new Set(showcaseMemberships.map(({ role }) => role));
  const modes = new Set(showcaseProgress.map(({ mode }) => mode));
  const visibilities = new Set(
    showcaseClubs.map(({ visibility }) => visibility)
  );

  assert(
    roles.size === 3,
    "Showcase fixtures must cover every membership role"
  );
  assert(modes.size === 3, "Showcase fixtures must cover every progress mode");
  assert(
    visibilities.size === 3,
    "Showcase fixtures must cover every club visibility"
  );
  assert(
    showcaseUsers.some((user) => user.recruiter),
    "Showcase fixtures require a recruiter persona"
  );
  assert(
    showcaseUsers.some(
      (user) =>
        !showcaseMemberships.some(
          (membership) => membership.userKey === user.key
        )
    ),
    "Showcase fixtures require a non-member persona"
  );
};

const requirePost = (
  posts: Map<string, (typeof showcasePosts)[number]>,
  key: string
) => {
  const post = posts.get(key);
  assert(post, `Report references missing post ${key}`);
  return post;
};

const requireComment = (
  comments: Map<string, (typeof showcaseComments)[number]>,
  key: string
) => {
  const comment = comments.get(key);
  assert(comment, `Report references missing comment ${key}`);
  return comment;
};

const assertUserCanReach = (
  memberships: Set<string>,
  progress: Map<string, (typeof showcaseProgress)[number]>,
  userKey: ShowcaseUserKey,
  clubKey: ShowcaseClubKey,
  milestonePosition: number,
  context: string
) => {
  const relationKey = `${userKey}:${clubKey}`;
  const row = progress.get(relationKey);

  assert(memberships.has(relationKey), `${context} must be a club member`);
  assert(row, `${context} requires a progress row`);
  assert(
    row.mode === "FINISHED" || row.milestonePosition >= milestonePosition,
    `${context} ${userKey} cannot access milestone ${milestonePosition} in ${clubKey}`
  );
};

const assertMilestonePosition = (
  clubs: Map<ShowcaseClubKey, (typeof showcaseClubs)[number]>,
  clubKey: ShowcaseClubKey,
  position: number
) => {
  const club = clubs.get(clubKey);
  assert(club, `Unknown showcase club ${clubKey}`);
  assert(
    club.milestones.some((milestone) => milestone.position === position),
    `Unknown milestone ${position} for ${clubKey}`
  );
};

const assertReference = <Key>(
  values: Set<Key> | Map<Key, unknown>,
  key: Key,
  context: string
) => {
  assert(values.has(key), `Unknown ${context}: ${String(key)}`);
};

const assertUnique = <Value>(values: Value[], context: string) => {
  assert(new Set(values).size === values.length, `Duplicate ${context}`);
};

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message
) => {
  if (!condition) {
    throw new Error(`Invalid showcase fixtures: ${message}`);
  }
};
