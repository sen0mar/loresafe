import type {
  AuditLogAction,
  Prisma
} from "../../generated/prisma/client.js";

type TransactionClient = Prisma.TransactionClient;

type AuditLogRecordInput = {
  action: AuditLogAction;
  reportId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  targetUserId?: string | null;
  moderatorNote?: string | null;
  metadata: Prisma.InputJsonObject;
};

type AuditLogInput = AuditLogRecordInput & {
  actorId: string;
  clubId: string;
};

const findAuditSubjectSnapshots = async (
  transaction: TransactionClient,
  actorId: string,
  clubId: string
) => {
  const [actor, club] = await Promise.all([
    transaction.user.findUniqueOrThrow({
      where: {
        id: actorId
      },
      select: {
        displayName: true,
        username: true
      }
    }),
    transaction.club.findUniqueOrThrow({
      where: {
        id: clubId
      },
      select: {
        title: true,
        linkName: true
      }
    })
  ]);

  return {
    actorDisplayName: actor.displayName,
    actorUsername: actor.username,
    clubTitle: club.title,
    clubLinkName: club.linkName
  };
};

export const createAuditLogInTransaction = async (
  transaction: TransactionClient,
  input: AuditLogInput
) => {
  const snapshots = await findAuditSubjectSnapshots(
    transaction,
    input.actorId,
    input.clubId
  );

  return transaction.auditLog.create({
    data: {
      action: input.action,
      actorId: input.actorId,
      clubId: input.clubId,
      ...snapshots,
      reportId: input.reportId ?? null,
      postId: input.postId ?? null,
      commentId: input.commentId ?? null,
      targetUserId: input.targetUserId ?? null,
      moderatorNote: input.moderatorNote ?? null,
      metadata: input.metadata
    },
    select: {
      id: true
    }
  });
};

export const createAuditLogsInTransaction = async (
  transaction: TransactionClient,
  input: {
    actorId: string;
    clubId: string;
    records: AuditLogRecordInput[];
  }
) => {
  if (input.records.length === 0) {
    return {
      count: 0
    };
  }

  const snapshots = await findAuditSubjectSnapshots(
    transaction,
    input.actorId,
    input.clubId
  );

  return transaction.auditLog.createMany({
    data: input.records.map((record) => ({
      action: record.action,
      actorId: input.actorId,
      clubId: input.clubId,
      ...snapshots,
      reportId: record.reportId ?? null,
      postId: record.postId ?? null,
      commentId: record.commentId ?? null,
      targetUserId: record.targetUserId ?? null,
      moderatorNote: record.moderatorNote ?? null,
      metadata: record.metadata
    }))
  });
};
