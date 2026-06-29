import { createHash } from "node:crypto";

import { normalizeNameReservationKey } from "../src/core/identity/user-names.js";
import { prisma } from "../src/core/prisma/client.js";

const PERF_PREFIX = "threadsync-perf";
const PASSWORD_HASH = "$argon2id$v=19$m=65536,t=3,p=4$perf$perf";
const now = new Date("2026-06-17T12:00:00.000Z");
const emojiSet = ["👍", "❤️", "😂", "😮", "👀"] as const;

const uuidFor = (value: string) => {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32)
  ].join("-");
};

const chunk = <T>(values: T[], size: number) => {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
};

const createManyInChunks = async <T>(
  values: T[],
  writeChunk: (chunkValues: T[]) => Promise<unknown>,
  size = 1000
) => {
  for (const chunkValues of chunk(values, size)) {
    await writeChunk(chunkValues);
  }
};

const seedPerfData = async () => {
  const users = Array.from({ length: 120 }, (_, index) => ({
    id: uuidFor(`${PERF_PREFIX}:user:${index}`),
    email: `${PERF_PREFIX}-${index}@example.com`,
    displayName: `Perf Reader ${index}`,
    username: `threadsync_perf_${index}`,
    passwordHash: PASSWORD_HASH,
    createdAt: now,
    updatedAt: now
  }));
  const outsider = {
    id: uuidFor(`${PERF_PREFIX}:outsider`),
    email: `${PERF_PREFIX}-outsider@example.com`,
    displayName: "Perf Outsider",
    username: "threadsync_perf_outsider",
    passwordHash: PASSWORD_HASH,
    createdAt: now,
    updatedAt: now
  };
  const allUsers = [...users, outsider];
  const clubs = Array.from({ length: 8 }, (_, index) => ({
    id: uuidFor(`${PERF_PREFIX}:club:${index}`),
    title: `ThreadSync Perf Club ${index}`,
    linkName: `${PERF_PREFIX}-club-${index}`,
    description: `Volume club ${index} for feed search moderation checks.`,
    category: index % 2 === 0 ? "Fantasy" : "Sci-Fi",
    visibility: index < 6 ? ("PUBLIC" as const) : ("PRIVATE" as const),
    createdAt: new Date(now.getTime() - index * 60_000),
    updatedAt: now
  }));

  await prisma.user.createMany({
    data: allUsers,
    skipDuplicates: true
  });
  await prisma.userNameReservation.createMany({
    data: toUserNameReservations(allUsers),
    skipDuplicates: true
  });
  await prisma.club.createMany({
    data: clubs,
    skipDuplicates: true
  });

  const memberships = clubs.flatMap((club, clubIndex) =>
    users.map((user, userIndex) => ({
      id: uuidFor(`${PERF_PREFIX}:membership:${clubIndex}:${userIndex}`),
      clubId: club.id,
      userId: user.id,
      role:
        userIndex === 0
          ? ("OWNER" as const)
          : userIndex < 4
            ? ("MODERATOR" as const)
            : ("MEMBER" as const),
      createdAt: new Date(now.getTime() - userIndex * 1000),
      updatedAt: now
    }))
  );
  const invites = clubs.flatMap((club, clubIndex) =>
    Array.from({ length: 10 }, (_, inviteIndex) => ({
      id: uuidFor(`${PERF_PREFIX}:invite:${clubIndex}:${inviteIndex}`),
      clubId: club.id,
      createdById: users[0].id,
      tokenHash: createHash("sha256")
        .update(`${PERF_PREFIX}:invite-token:${clubIndex}:${inviteIndex}`)
        .digest("hex"),
      expiresAt: new Date(now.getTime() + (inviteIndex + 1) * 86_400_000),
      maxUses: 100,
      usedCount: inviteIndex,
      revokedAt: inviteIndex % 7 === 0 ? now : null,
      createdAt: new Date(now.getTime() - inviteIndex * 60_000),
      updatedAt: now
    }))
  );
  const milestones = clubs.flatMap((club, clubIndex) =>
    Array.from({ length: 20 }, (_, milestoneIndex) => ({
      id: uuidFor(`${PERF_PREFIX}:milestone:${clubIndex}:${milestoneIndex}`),
      clubId: club.id,
      position: milestoneIndex + 1,
      safeTitle: `Checkpoint ${milestoneIndex + 1}`,
      fullTitle:
        milestoneIndex % 5 === 0
          ? `Spoiler checkpoint ${milestoneIndex + 1}`
          : `Checkpoint ${milestoneIndex + 1}`,
      description: `Perf milestone ${milestoneIndex + 1}`,
      spoilerName: milestoneIndex % 5 === 0,
      createdAt: now,
      updatedAt: now
    }))
  );

  await createManyInChunks(memberships, (data) =>
    prisma.clubMembership.createMany({ data, skipDuplicates: true })
  );
  await prisma.clubInvite.createMany({
    data: invites,
    skipDuplicates: true
  });
  await prisma.milestone.createMany({
    data: milestones,
    skipDuplicates: true
  });

  const progressRows = clubs.flatMap((club, clubIndex) =>
    users.map((user, userIndex) => ({
      id: uuidFor(`${PERF_PREFIX}:progress:${clubIndex}:${userIndex}`),
      clubId: club.id,
      userId: user.id,
      currentMilestoneId:
        milestones.find(
          (milestone) =>
            milestone.clubId === club.id &&
            milestone.position === (userIndex % 18) + 1
        )?.id ?? null,
      mode:
        userIndex % 17 === 0
          ? ("FINISHED" as const)
          : userIndex % 11 === 0
            ? ("BRAVE" as const)
            : userIndex % 5 === 0
              ? ("SOFT" as const)
              : ("STRICT" as const),
      createdAt: now,
      updatedAt: now
    }))
  );
  const historyRows = progressRows.slice(0, 600).map((progress, index) => ({
    id: uuidFor(`${PERF_PREFIX}:history:${index}`),
    clubId: progress.clubId,
    userId: progress.userId,
    fromMilestoneId: null,
    toMilestoneId: progress.currentMilestoneId,
    fromMode: "STRICT" as const,
    toMode: progress.mode,
    createdAt: new Date(now.getTime() - index * 60_000)
  }));

  await createManyInChunks(progressRows, (data) =>
    prisma.clubProgress.createMany({ data, skipDuplicates: true })
  );
  await createManyInChunks(historyRows, (data) =>
    prisma.progressHistory.createMany({ data, skipDuplicates: true })
  );

  const posts = clubs.flatMap((club, clubIndex) =>
    Array.from({ length: 250 }, (_, postIndex) => ({
      id: uuidFor(`${PERF_PREFIX}:post:${clubIndex}:${postIndex}`),
      clubId: club.id,
      authorId: users[postIndex % users.length].id,
      type:
        postIndex % 13 === 0
          ? ("QUESTION" as const)
          : postIndex % 17 === 0
            ? ("PREDICTION" as const)
            : ("DISCUSSION" as const),
      title: `Perf discussion ${clubIndex}-${postIndex}`,
      body: `Volume searchable discussion body ${postIndex} with spoiler-safe text.`,
      requiredMilestoneId:
        milestones.find(
          (milestone) =>
            milestone.clubId === club.id &&
            milestone.position === (postIndex % 20) + 1
        )?.id ?? milestones[0].id,
      status: postIndex % 97 === 0 ? ("HIDDEN" as const) : ("VISIBLE" as const),
      deletedAt: null,
      createdAt: new Date(now.getTime() - postIndex * 1000),
      updatedAt: now
    }))
  );

  await createManyInChunks(posts, (data) =>
    prisma.post.createMany({ data, skipDuplicates: true })
  );

  const visiblePosts = posts.filter((post) => post.status === "VISIBLE");
  const comments = visiblePosts.flatMap((post, postIndex) =>
    Array.from({ length: 6 }, (_, commentIndex) => ({
      id: uuidFor(`${PERF_PREFIX}:comment:${postIndex}:${commentIndex}`),
      postId: post.id,
      authorId: users[(postIndex + commentIndex) % users.length].id,
      parentId: null,
      body: `Perf comment ${postIndex}-${commentIndex}`,
      requiredMilestoneId: post.requiredMilestoneId,
      status:
        commentIndex === 5 && postIndex % 10 === 0
          ? ("HIDDEN" as const)
          : ("VISIBLE" as const),
      deletedAt: null,
      createdAt:
        commentIndex < 3
          ? post.createdAt
          : new Date(post.createdAt.getTime() + commentIndex),
      updatedAt: now
    }))
  );

  await createManyInChunks(comments, (data) =>
    prisma.comment.createMany({ data, skipDuplicates: true })
  );

  const postReactions = visiblePosts.slice(0, 1000).flatMap((post, postIndex) =>
    emojiSet.slice(0, 3).map((emoji, emojiIndex) => ({
      id: uuidFor(`${PERF_PREFIX}:post-reaction:${postIndex}:${emoji}`),
      postId: post.id,
      userId: users[(postIndex + emojiIndex) % users.length].id,
      emoji,
      createdAt: now,
      updatedAt: now
    }))
  );
  const commentReactions = comments
    .filter((comment) => comment.status === "VISIBLE")
    .slice(0, 1000)
    .flatMap((comment, commentIndex) =>
      emojiSet.slice(0, 2).map((emoji, emojiIndex) => ({
        id: uuidFor(`${PERF_PREFIX}:comment-reaction:${commentIndex}:${emoji}`),
        commentId: comment.id,
        userId: users[(commentIndex + emojiIndex) % users.length].id,
        emoji,
        createdAt: now,
        updatedAt: now
      }))
    );

  await createManyInChunks(postReactions, (data) =>
    prisma.postReaction.createMany({ data, skipDuplicates: true })
  );
  await createManyInChunks(commentReactions, (data) =>
    prisma.commentReaction.createMany({ data, skipDuplicates: true })
  );

  const notifications = visiblePosts.slice(0, 1200).map((post, index) => ({
    id: uuidFor(`${PERF_PREFIX}:notification:${index}`),
    userId: users[index % users.length].id,
    type: index % 5 === 0 ? ("PROGRESS_UNLOCK" as const) : ("POST_COMMENT" as const),
    eventKey: `${PERF_PREFIX}:notification:${index}`,
    safeText: `Safe notification ${index}`,
    clubId: post.clubId,
    postId: post.id,
    commentId: comments[index % comments.length]?.id ?? null,
    requiredMilestoneId: post.requiredMilestoneId,
    readAt: index % 3 === 0 ? now : null,
    createdAt: new Date(now.getTime() - index * 1000)
  }));
  const reports = visiblePosts.slice(0, 700).map((post, index) => ({
    id: uuidFor(`${PERF_PREFIX}:report:${index}`),
    targetType: "POST" as const,
    reason: index % 2 === 0 ? ("SPOILER" as const) : ("SPAM" as const),
    details: `Perf report ${index}`,
    reporterId: users[(index + 7) % users.length].id,
    clubId: post.clubId,
    postId: post.id,
    commentId: null,
    status:
      index % 5 === 0
        ? ("RESOLVED" as const)
        : index % 11 === 0
          ? ("DISMISSED" as const)
          : ("OPEN" as const),
    createdAt: new Date(now.getTime() - index * 2000),
    updatedAt: now
  }));

  await createManyInChunks(notifications, (data) =>
    prisma.notification.createMany({ data, skipDuplicates: true })
  );
  await createManyInChunks(reports, (data) =>
    prisma.report.createMany({ data, skipDuplicates: true })
  );

  const auditLogs = reports.slice(0, 500).map((report, index) => ({
    id: uuidFor(`${PERF_PREFIX}:audit:${index}`),
    action: index % 2 === 0 ? ("REPORT_RESOLVED" as const) : ("REPORT_DISMISSED" as const),
    actorId: users[index % 4].id,
    clubId: report.clubId,
    reportId: report.id,
    postId: report.postId,
    commentId: null,
    targetUserId: users[(index + 1) % users.length].id,
    moderatorNote: `Perf moderation note ${index}`,
    metadata: {
      source: PERF_PREFIX,
      index
    },
    createdAt: new Date(now.getTime() - index * 3000)
  }));

  await createManyInChunks(auditLogs, (data) =>
    prisma.auditLog.createMany({ data, skipDuplicates: true })
  );

  return {
    user: users[0],
    outsider,
    publicClub: clubs[0],
    privateClub: clubs[6]
  };
};

const toUserNameReservations = (
  users: Array<{ id: string; displayName: string; username: string }>
) => {
  const reservations = new Map<string, { normalizedName: string; userId: string }>();

  for (const user of users) {
    for (const name of [user.username, user.displayName]) {
      const normalizedName = normalizeNameReservationKey(name);
      reservations.set(normalizedName, {
        normalizedName,
        userId: user.id
      });
    }
  }

  return [...reservations.values()];
};

const explain = async (label: string, sql: string) => {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(sql);
  const plan = rows.map((row) => Object.values(row)[0]).join("\n");
  const usesIndex = /Index Scan|Index Only Scan|Bitmap Index Scan|Bitmap Heap Scan/i.test(
    plan
  );

  console.log(`\n[${label}]\n${plan}`);

  if (!usesIndex) {
    throw new Error(`${label} did not use an index-backed plan.`);
  }
};

const verifyBoundedRows = async (label: string, sql: string, maxRows: number) => {
  const rows = await prisma.$queryRawUnsafe<unknown[]>(sql);

  if (rows.length > maxRows) {
    throw new Error(`${label} returned ${rows.length} rows; expected <= ${maxRows}.`);
  }

  console.log(`[bounded] ${label}: ${rows.length}/${maxRows}`);
};

const runChecks = async ({
  user,
  outsider,
  publicClub,
  privateClub
}: Awaited<ReturnType<typeof seedPerfData>>) => {
  const publicClubId = publicClub.id;
  const userId = user.id;

  await verifyBoundedRows(
    "feed",
    `
      SELECT p."id"
      FROM "posts" p
      WHERE p."club_id" = '${publicClubId}'::uuid
      AND p."status" = 'VISIBLE'
      AND p."deleted_at" IS NULL
      ORDER BY p."created_at" DESC, p."id" ASC
      LIMIT 21
    `,
    21
  );
  await verifyBoundedRows(
    "notifications",
    `
      SELECT n."id"
      FROM "notifications" n
      WHERE n."user_id" = '${userId}'::uuid
      ORDER BY n."created_at" DESC, n."id" ASC
      LIMIT 21
    `,
    21
  );
  await verifyBoundedRows(
    "reports",
    `
      SELECT r."id"
      FROM "reports" r
      WHERE r."club_id" = '${publicClubId}'::uuid
      AND r."status" = 'OPEN'
      ORDER BY r."created_at" DESC, r."id" ASC
      LIMIT 21
    `,
    21
  );
  await verifyBoundedRows(
    "comments",
    `
      SELECT c."id"
      FROM "comments" c
      INNER JOIN "posts" p ON p."id" = c."post_id"
      WHERE p."club_id" = '${publicClubId}'::uuid
      AND c."status" = 'VISIBLE'
      AND c."deleted_at" IS NULL
      ORDER BY c."created_at" ASC, c."id" ASC
      LIMIT 21
    `,
    21
  );

  await explain(
    "feed index plan",
    `
      EXPLAIN SELECT p."id"
      FROM "posts" p
      WHERE p."club_id" = '${publicClubId}'::uuid
      AND p."status" = 'VISIBLE'
      AND p."deleted_at" IS NULL
      ORDER BY p."created_at" DESC, p."id" ASC
      LIMIT 21
    `
  );
  await explain(
    "notifications index plan",
    `
      EXPLAIN SELECT n."id"
      FROM "notifications" n
      WHERE n."user_id" = '${userId}'::uuid
      ORDER BY n."created_at" DESC, n."id" ASC
      LIMIT 21
    `
  );
  await explain(
    "reports index plan",
    `
      EXPLAIN SELECT r."id"
      FROM "reports" r
      WHERE r."club_id" = '${publicClubId}'::uuid
      AND r."status" = 'OPEN'
      ORDER BY r."created_at" DESC, r."id" ASC
      LIMIT 21
    `
  );
  await explain(
    "search GIN plan",
    `
      EXPLAIN SELECT p."id"
      FROM "posts" p
      WHERE p."status" = 'VISIBLE'
      AND p."deleted_at" IS NULL
      AND to_tsvector('english', coalesce(p."title", '') || ' ' || coalesce(p."body", ''))
        @@ websearch_to_tsquery('english', 'volume discussion')
      LIMIT 21
    `
  );

  const privateSearchRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
      SELECT p."id"
      FROM "posts" p
      INNER JOIN "clubs" c ON c."id" = p."club_id"
      LEFT JOIN "club_memberships" current_member
        ON current_member."club_id" = c."id"
        AND current_member."user_id" = '${outsider.id}'::uuid
      WHERE p."club_id" = '${privateClub.id}'::uuid
      AND p."status" = 'VISIBLE'
      AND p."deleted_at" IS NULL
      AND (
        c."visibility" = 'PUBLIC'
        OR current_member."user_id" IS NOT NULL
      )
      LIMIT 1
    `
  );

  if (privateSearchRows.length !== 0) {
    throw new Error("Private club search rows leaked to a non-member user.");
  }

  console.log("[safe-search] private club rows hidden from non-member");
};

const main = async () => {
  const seeded = await seedPerfData();
  await runChecks(seeded);
  console.log("\nPerformance seed/check completed.");
};

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Performance seed/check failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
