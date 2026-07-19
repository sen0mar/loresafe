import type { Prisma } from "../../src/generated/prisma/client.js";
import {
  normalizeNameReservationKey,
  normalizeUsername
} from "../../src/core/identity/user-names.js";
import { hashInviteToken } from "../../src/modules/invites/invites.token.js";
import {
  showcaseNotifications,
  showcaseReports
} from "./showcase.activities.js";
import { showcaseClubs } from "./showcase.clubs.js";
import { showcaseComments, showcasePosts } from "./showcase.discussions.js";
import type { ShowcaseClubKey, ShowcaseUserKey } from "./showcase.types.js";
import {
  showcaseBan,
  showcaseMemberships,
  showcaseProgress,
  showcaseUsers
} from "./showcase.users.js";

type TransactionClient = Prisma.TransactionClient;

type WriteContext = {
  clubIds: Map<ShowcaseClubKey, string>;
  commentIds: Map<string, string>;
  milestoneIds: Map<string, string>;
  postIds: Map<string, string>;
  reportIds: Map<string, string>;
  seededAt: Date;
  userIds: Map<ShowcaseUserKey, string>;
};

export type ShowcaseWriteInput = {
  inviteToken: string;
  passwordHash: string;
  recruiterEmail: string;
  seededAt: Date;
};

export const writeShowcaseData = async (
  transaction: TransactionClient,
  input: ShowcaseWriteInput
) => {
  await assertEmptyShowcaseTarget(transaction);
  const userIds = await createUsers(transaction, input);
  const clubIds = await createClubs(transaction, input.seededAt);
  const milestoneIds = await createMilestones(
    transaction,
    clubIds,
    input.seededAt
  );
  const context: WriteContext = {
    clubIds,
    commentIds: new Map(),
    milestoneIds,
    postIds: new Map(),
    reportIds: new Map(),
    seededAt: input.seededAt,
    userIds
  };

  await createMembershipsAndProgress(transaction, context);
  await createBanAndInvite(transaction, context, input.inviteToken);
  await createPosts(transaction, context);
  await createComments(transaction, context);
  await createReactions(transaction, context);
  await createNotifications(transaction, context);
  await createReportsAndAuditLogs(transaction, context);
};

export const assertEmptyShowcaseTarget = async (
  transaction: TransactionClient
) => {
  const [users, clubs, storageDeletions] = await Promise.all([
    transaction.user.count(),
    transaction.club.count(),
    transaction.storageObjectDeletion.count()
  ]);

  if (users !== 0 || clubs !== 0 || storageDeletions !== 0) {
    throw new Error(
      "Showcase seed requires an empty application database. Wipe development or stop before touching production."
    );
  }
};

const createUsers = async (
  transaction: TransactionClient,
  { passwordHash, recruiterEmail, seededAt }: ShowcaseWriteInput
) => {
  await transaction.user.createMany({
    data: showcaseUsers.map((user, index) => ({
      email: user.recruiter ? recruiterEmail : user.email,
      displayName: user.displayName,
      username: normalizeUsername(user.username),
      bio: user.bio,
      passwordHash,
      createdAt: daysAgo(seededAt, 100 - index)
    }))
  });

  const users = await transaction.user.findMany({
    select: { id: true, username: true }
  });
  const userIds = new Map<ShowcaseUserKey, string>();

  for (const fixture of showcaseUsers) {
    const user = users.find(
      (candidate) => candidate.username === normalizeUsername(fixture.username)
    );
    userIds.set(fixture.key, requireValue(user?.id, `user ${fixture.key}`));
  }

  await transaction.userNameReservation.createMany({
    data: showcaseUsers.flatMap((user) => {
      const userId = requireMapValue(userIds, user.key, "user");
      const names = [user.username, user.displayName].map(
        normalizeNameReservationKey
      );

      return [...new Set(names)].map((normalizedName) => ({
        normalizedName,
        userId
      }));
    })
  });

  return userIds;
};

const createClubs = async (transaction: TransactionClient, seededAt: Date) => {
  await transaction.club.createMany({
    data: showcaseClubs.map((club, index) => ({
      title: club.title,
      linkName: club.linkName,
      description: club.description,
      category: club.category,
      visibility: club.visibility,
      rules: club.rules,
      createdAt: daysAgo(seededAt, 80 - index * 4)
    }))
  });

  const clubs = await transaction.club.findMany({
    select: { id: true, linkName: true }
  });

  return new Map(
    showcaseClubs.map((fixture) => [
      fixture.key,
      requireValue(
        clubs.find((club) => club.linkName === fixture.linkName)?.id,
        `club ${fixture.key}`
      )
    ])
  );
};

const createMilestones = async (
  transaction: TransactionClient,
  clubIds: Map<ShowcaseClubKey, string>,
  seededAt: Date
) => {
  await transaction.milestone.createMany({
    data: showcaseClubs.flatMap((club) =>
      club.milestones.map((milestone) => ({
        clubId: requireMapValue(clubIds, club.key, "club"),
        position: milestone.position,
        safeTitle: milestone.safeTitle,
        fullTitle: milestone.fullTitle,
        description: milestone.description,
        spoilerName: milestone.spoilerName,
        createdAt: daysAgo(seededAt, 75)
      }))
    )
  });

  const milestones = await transaction.milestone.findMany({
    select: { clubId: true, id: true, position: true }
  });
  const clubKeysById = new Map(
    [...clubIds].map(([clubKey, clubId]) => [clubId, clubKey])
  );

  return new Map(
    milestones.map((milestone) => {
      const clubKey = requireMapValue(
        clubKeysById,
        milestone.clubId,
        "club key"
      );
      return [milestoneKey(clubKey, milestone.position), milestone.id];
    })
  );
};

const createMembershipsAndProgress = async (
  transaction: TransactionClient,
  context: WriteContext
) => {
  await transaction.clubMembership.createMany({
    data: showcaseMemberships.map((membership, index) => ({
      userId: userId(context, membership.userKey),
      clubId: clubId(context, membership.clubKey),
      role: membership.role,
      createdAt: daysAgo(context.seededAt, 65 - (index % 8))
    }))
  });

  await transaction.clubProgress.createMany({
    data: showcaseProgress.map((progress) => ({
      userId: userId(context, progress.userKey),
      clubId: clubId(context, progress.clubKey),
      currentMilestoneId: milestoneId(
        context,
        progress.clubKey,
        progress.milestonePosition
      ),
      mode: progress.mode,
      version: 1,
      onboardingCompletedAt: daysAgo(context.seededAt, 30),
      createdAt: daysAgo(context.seededAt, 60)
    }))
  });

  await transaction.progressHistory.createMany({
    data: showcaseProgress.map((progress, index) => ({
      userId: userId(context, progress.userKey),
      clubId: clubId(context, progress.clubKey),
      fromMilestoneId: null,
      toMilestoneId: milestoneId(
        context,
        progress.clubKey,
        progress.milestonePosition
      ),
      fromMode: "STRICT",
      toMode: progress.mode,
      version: 1,
      createdAt: daysAgo(context.seededAt, 20 - (index % 12))
    }))
  });
};

const createBanAndInvite = async (
  transaction: TransactionClient,
  context: WriteContext,
  inviteToken: string
) => {
  await transaction.clubBan.create({
    data: {
      userId: userId(context, showcaseBan.userKey),
      clubId: clubId(context, showcaseBan.clubKey),
      roleAtBan: "MEMBER",
      reason: showcaseBan.reason,
      createdAt: daysAgo(context.seededAt, 6)
    }
  });

  await createShowcaseInvite(transaction, {
    clubId: clubId(context, "lordOfTheRings"),
    createdById: userId(context, "liam"),
    inviteToken,
    seededAt: context.seededAt
  });
};

type ShowcaseInviteWriteInput = {
  clubId: string;
  createdById: string;
  inviteToken: string;
  seededAt: Date;
};

export const createShowcaseInvite = async (
  transaction: TransactionClient,
  input: ShowcaseInviteWriteInput
) => {
  await transaction.clubInvite.create({
    data: {
      clubId: input.clubId,
      createdById: input.createdById,
      tokenHash: hashInviteToken(input.inviteToken),
      expiresAt: daysFrom(input.seededAt, 30),
      maxUses: 100,
      createdAt: daysAgo(input.seededAt, 2)
    }
  });
};

const createPosts = async (
  transaction: TransactionClient,
  context: WriteContext
) => {
  for (const post of showcasePosts) {
    const created = await transaction.post.create({
      data: {
        clubId: clubId(context, post.clubKey),
        authorId: userId(context, post.authorKey),
        type: post.type,
        title: post.title,
        body: post.body,
        requiredMilestoneId: milestoneId(
          context,
          post.clubKey,
          post.milestonePosition
        ),
        createdAt: daysAgo(context.seededAt, post.daysAgo)
      },
      select: { id: true }
    });
    context.postIds.set(post.key, created.id);

    if (post.predictionRevealPosition !== undefined) {
      await transaction.prediction.create({
        data: {
          postId: created.id,
          revealMilestoneId: milestoneId(
            context,
            post.clubKey,
            post.predictionRevealPosition
          )
        }
      });
    }
  }
};

const createComments = async (
  transaction: TransactionClient,
  context: WriteContext
) => {
  const postsByKey = new Map(showcasePosts.map((post) => [post.key, post]));

  for (const comment of showcaseComments) {
    const post = requireMapValue(postsByKey, comment.postKey, "post fixture");
    const created = await transaction.comment.create({
      data: {
        postId: postId(context, comment.postKey),
        authorId: userId(context, comment.authorKey),
        parentId: comment.parentKey
          ? commentId(context, comment.parentKey)
          : null,
        body: comment.body,
        requiredMilestoneId: milestoneId(
          context,
          post.clubKey,
          comment.milestonePosition
        ),
        createdAt: hoursAfter(
          daysAgo(context.seededAt, post.daysAgo),
          comment.hoursAfterPost
        )
      },
      select: { id: true }
    });
    context.commentIds.set(comment.key, created.id);
  }
};

const createReactions = async (
  transaction: TransactionClient,
  context: WriteContext
) => {
  const emojis = ["👍", "❤️", "😂", "😮", "👀"];

  await transaction.postReaction.createMany({
    data: showcasePosts.flatMap((post, postIndex) =>
      post.reactionUserKeys.map((userKey, reactionIndex) => ({
        postId: postId(context, post.key),
        userId: userId(context, userKey),
        emoji: emojis[(postIndex + reactionIndex) % emojis.length] ?? "👍",
        createdAt: daysAgo(context.seededAt, Math.max(post.daysAgo - 1, 0))
      }))
    )
  });

  await transaction.commentReaction.createMany({
    data: showcaseComments.flatMap((comment, commentIndex) =>
      comment.reactionUserKeys.map((userKey, reactionIndex) => ({
        commentId: commentId(context, comment.key),
        userId: userId(context, userKey),
        emoji: emojis[(commentIndex + reactionIndex) % emojis.length] ?? "👍",
        createdAt: daysAgo(context.seededAt, commentIndex % 5)
      }))
    )
  });
};

const createNotifications = async (
  transaction: TransactionClient,
  context: WriteContext
) => {
  await transaction.notification.createMany({
    data: showcaseNotifications.map((notification) => ({
      userId: userId(context, notification.userKey),
      type: notification.type,
      eventKey: `showcase:${notification.key}`,
      safeText: notification.safeText,
      clubId: clubId(context, notification.clubKey),
      postId: notification.postKey
        ? postId(context, notification.postKey)
        : null,
      commentId: notification.commentKey
        ? commentId(context, notification.commentKey)
        : null,
      requiredMilestoneId: milestoneId(
        context,
        notification.clubKey,
        notification.milestonePosition
      ),
      readAt: notification.read
        ? daysAgo(context.seededAt, notification.daysAgo - 0.25)
        : null,
      createdAt: daysAgo(context.seededAt, notification.daysAgo)
    }))
  });
};

const createReportsAndAuditLogs = async (
  transaction: TransactionClient,
  context: WriteContext
) => {
  for (const report of showcaseReports) {
    const created = await transaction.report.create({
      data: {
        reporterId: userId(context, report.reporterKey),
        clubId: clubId(context, report.clubKey),
        targetType: report.targetType,
        postId:
          report.targetType === "POST"
            ? postId(context, report.targetKey)
            : null,
        commentId:
          report.targetType === "COMMENT"
            ? commentId(context, report.targetKey)
            : null,
        reason: report.reason,
        details: report.details,
        status: report.status,
        createdAt: daysAgo(context.seededAt, 5)
      },
      select: { id: true }
    });
    context.reportIds.set(report.key, created.id);
  }

  await transaction.auditLog.createMany({
    data: [
      auditLog(context, {
        action: "REPORT_RESOLVED",
        actorKey: "maya",
        clubKey: "gameOfThrones",
        reportKey: "report-resolved-got",
        commentKey: "got_red_c1",
        moderatorNote:
          "Removed the later-season comparison and kept the season-three observation."
      }),
      auditLog(context, {
        action: "USER_WARNED",
        actorKey: "theo",
        clubKey: "harryPotter",
        targetUserKey: "jordan",
        moderatorNote:
          "Asked the member to stop placing finale details in early-year titles."
      }),
      auditLog(context, {
        action: "USER_BANNED",
        actorKey: "maya",
        clubKey: "harryPotter",
        targetUserKey: "jordan",
        moderatorNote: showcaseBan.reason
      })
    ]
  });
};

const auditLog = (
  context: WriteContext,
  input: {
    action: "REPORT_RESOLVED" | "USER_WARNED" | "USER_BANNED";
    actorKey: ShowcaseUserKey;
    clubKey: ShowcaseClubKey;
    commentKey?: string;
    moderatorNote: string;
    reportKey?: string;
    targetUserKey?: ShowcaseUserKey;
  }
) => {
  const actor = requireValue(
    showcaseUsers.find((user) => user.key === input.actorKey),
    "audit actor fixture"
  );
  const club = requireValue(
    showcaseClubs.find((fixture) => fixture.key === input.clubKey),
    "audit club fixture"
  );

  return {
    action: input.action,
    actorId: userId(context, input.actorKey),
    actorDisplayName: actor.displayName,
    actorUsername: actor.username,
    clubId: clubId(context, input.clubKey),
    clubTitle: club.title,
    clubLinkName: club.linkName,
    reportId: input.reportKey
      ? requireMapValue(context.reportIds, input.reportKey, "report")
      : null,
    commentId: input.commentKey ? commentId(context, input.commentKey) : null,
    targetUserId: input.targetUserKey
      ? userId(context, input.targetUserKey)
      : null,
    moderatorNote: input.moderatorNote,
    createdAt: daysAgo(context.seededAt, input.action === "USER_BANNED" ? 6 : 4)
  };
};

const userId = (context: WriteContext, key: ShowcaseUserKey) =>
  requireMapValue(context.userIds, key, "user");

const clubId = (context: WriteContext, key: ShowcaseClubKey) =>
  requireMapValue(context.clubIds, key, "club");

const milestoneId = (
  context: WriteContext,
  clubKey: ShowcaseClubKey,
  position: number
) =>
  requireMapValue(
    context.milestoneIds,
    milestoneKey(clubKey, position),
    "milestone"
  );

const postId = (context: WriteContext, key: string) =>
  requireMapValue(context.postIds, key, "post");

const commentId = (context: WriteContext, key: string) =>
  requireMapValue(context.commentIds, key, "comment");

const milestoneKey = (clubKey: ShowcaseClubKey, position: number) =>
  `${clubKey}:${position}`;

const requireMapValue = <Key, Value>(
  values: Map<Key, Value>,
  key: Key,
  label: string
) => requireValue(values.get(key), `${label} ${String(key)}`);

const requireValue = <Value>(
  value: Value | null | undefined,
  label: string
): Value => {
  if (value === null || value === undefined) {
    throw new Error(`Missing showcase ${label}`);
  }

  return value;
};

const daysAgo = (from: Date, days: number) =>
  new Date(from.getTime() - days * 24 * 60 * 60 * 1000);

const daysFrom = (from: Date, days: number) =>
  new Date(from.getTime() + days * 24 * 60 * 60 * 1000);

const hoursAfter = (from: Date, hours: number) =>
  new Date(from.getTime() + hours * 60 * 60 * 1000);
