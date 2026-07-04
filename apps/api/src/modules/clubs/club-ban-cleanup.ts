import type { Prisma } from "../../generated/prisma/client.js";

type TransactionClient = Prisma.TransactionClient;

export const softDeleteAuthoredPostsForBan = async (
  transaction: TransactionClient,
  input: {
    actorId: string;
    banId: string;
    clubId: string;
    moderatorNote?: string | null;
    reportId?: string | null;
    targetUserId: string;
  }
) => {
  const deletedAt = new Date();
  const posts = await transaction.post.findMany({
    where: {
      clubId: input.clubId,
      authorId: input.targetUserId,
      deletedAt: null
    },
    select: {
      id: true
    }
  });

  if (posts.length === 0) {
    return 0;
  }

  const postIds = posts.map((post) => post.id);

  await transaction.post.updateMany({
    where: {
      id: {
        in: postIds
      },
      deletedAt: null
    },
    data: {
      deletedAt
    }
  });

  await transaction.auditLog.createMany({
    data: postIds.map((postId) => ({
      action: "POST_DELETED",
      actorId: input.actorId,
      clubId: input.clubId,
      reportId: input.reportId ?? null,
      postId,
      commentId: null,
      targetUserId: input.targetUserId,
      moderatorNote: input.moderatorNote ?? null,
      metadata: {
        banId: input.banId,
        previousDeletedAt: null,
        deletedAt: deletedAt.toISOString(),
        source: "BAN_CLEANUP"
      }
    }))
  });

  return postIds.length;
};
