import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { activeUserBanWhere } from "../clubs/club-bans.js";
import {
  postSelect,
  toClubPostRecord,
  userReactionMapForPostIds,
  type ClubFeedRecord,
  type ClubPostRecord
} from "../posts/posts.repository.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import {
  progressRepository,
  type RecentlyUnlockedRecord
} from "../progress/progress.repository.js";

type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type DashboardClubRecord = ClubFeedRecord;

export type ClubDashboardStatsRecord = {
  memberCount: number;
  milestoneCount: number;
  visiblePostCount: number;
  visibleCommentCount: number;
  postReactionCount: number;
  safePostCount: number;
  lockedPostCount: number;
};

export type ProgressSummaryRecord = {
  mode: ProgressMode;
  currentMilestone: {
    id: string;
    position: number;
    safeTitle: string;
  } | null;
  totalMilestones: number;
  updatedAt: Date | null;
};

export type PopularDiscussionRecord = {
  post: ClubPostRecord;
  engagementScore: number;
};

export type RecentlyUnlockedSummaryRecord = Omit<
  RecentlyUnlockedRecord,
  "nextCursor" | "hasMore"
>;

type PopularDiscussionRankRow = {
  id: string;
  engagement_score: number | bigint;
};

export type DashboardRepository = {
  findClubForDashboard: (
    slug: string,
    userId: string
  ) => Promise<DashboardClubRecord | null>;
  getClubDashboardStats: (
    userId: string,
    club: DashboardClubRecord
  ) => Promise<ClubDashboardStatsRecord>;
  getPopularDiscussions: (
    userId: string,
    clubId: string,
    limit: number
  ) => Promise<PopularDiscussionRecord[]>;
  getProgressSummary: (
    userId: string,
    clubId: string
  ) => Promise<ProgressSummaryRecord>;
  getRecentlyUnlockedSummary: (
    userId: string,
    clubId: string,
    limit: number
  ) => Promise<RecentlyUnlockedSummaryRecord>;
};

export const dashboardRepository: DashboardRepository = {
  findClubForDashboard: async (slug, userId) => {
    const now = new Date();
    const club = await prisma.club.findUnique({
      where: {
        slug
      },
      select: {
        id: true,
        visibility: true,
        memberships: {
          where: {
            userId
          },
          select: {
            role: true
          },
          take: 1
        },
        bans: {
          where: activeUserBanWhere(userId, now),
          select: {
            id: true
          },
          take: 1
        },
        progress: {
          where: {
            userId
          },
          select: {
            mode: true,
            currentMilestone: {
              select: {
                position: true
              }
            }
          },
          take: 1
        }
      }
    });

    if (!club) {
      return null;
    }

    const progress = club.progress[0];

    return {
      id: club.id,
      visibility: club.visibility,
      currentUserRole: (club.memberships[0]?.role ?? null) as
        | ClubMembershipRole
        | null,
      isCurrentUserBanned: club.bans.length > 0,
      progress: {
        mode: (progress?.mode ?? "STRICT") as ProgressMode,
        currentMilestonePosition:
          progress?.currentMilestone?.position ?? null
      }
    };
  },

  getClubDashboardStats: async (_userId, club) => {
    const progressPosition = club.progress.currentMilestonePosition ?? 0;
    const safePostWhere: Prisma.PostWhereInput =
      club.progress.mode === "FINISHED"
        ? {}
        : {
            requiredMilestone: {
              position: {
                lte: progressPosition
              }
            }
          };
    const [
      memberCount,
      milestoneCount,
      visiblePostCount,
      visibleCommentCount,
      postReactionCount,
      safePostCount
    ] = await prisma.$transaction([
      prisma.clubMembership.count({
        where: {
          clubId: club.id
        }
      }),
      prisma.milestone.count({
        where: {
          clubId: club.id
        }
      }),
      prisma.post.count({
        where: visiblePostWhere(club.id)
      }),
      prisma.comment.count({
        where: {
          status: "VISIBLE",
          deletedAt: null,
          post: visiblePostWhere(club.id)
        }
      }),
      prisma.postReaction.count({
        where: {
          post: visiblePostWhere(club.id)
        }
      }),
      prisma.post.count({
        where: {
          ...visiblePostWhere(club.id),
          ...safePostWhere
        }
      })
    ]);

    return {
      memberCount,
      milestoneCount,
      visiblePostCount,
      visibleCommentCount,
      postReactionCount,
      safePostCount,
      lockedPostCount: Math.max(0, visiblePostCount - safePostCount)
    };
  },

  getPopularDiscussions: async (userId, clubId, limit) => {
    const rankedRows = await prisma.$queryRaw<PopularDiscussionRankRow[]>`
      SELECT
        p.id,
        (
          COALESCE(comment_counts.comment_count, 0) +
          COALESCE(reaction_counts.reaction_count, 0)
        ) AS engagement_score
      FROM posts p
      LEFT JOIN (
        SELECT post_id, COUNT(*)::int AS comment_count
        FROM comments
        WHERE status = 'VISIBLE' AND deleted_at IS NULL
        GROUP BY post_id
      ) comment_counts ON comment_counts.post_id = p.id
      LEFT JOIN (
        SELECT post_id, COUNT(*)::int AS reaction_count
        FROM post_reactions
        GROUP BY post_id
      ) reaction_counts ON reaction_counts.post_id = p.id
      WHERE p.club_id = ${clubId}::uuid
        AND p.status = 'VISIBLE'
        AND p.deleted_at IS NULL
      ORDER BY engagement_score DESC, p.created_at DESC, p.id ASC
      LIMIT ${limit}
    `;
    const postIds = rankedRows.map((row) => row.id);

    if (postIds.length === 0) {
      return [];
    }

    const posts = await prisma.post.findMany({
      where: {
        id: {
          in: postIds
        }
      },
      select: postSelect
    });
    const postById = new Map(posts.map((post) => [post.id, post]));
    const reactionMap = await userReactionMapForPostIds(postIds, userId);

    return rankedRows.flatMap((row) => {
      const post = postById.get(row.id);

      if (!post) {
        return [];
      }

      return {
        post: toClubPostRecord(post, reactionMap),
        engagementScore: Number(row.engagement_score)
      };
    });
  },

  getProgressSummary: async (userId, clubId) => {
    const [progress, totalMilestones] = await prisma.$transaction([
      prisma.clubProgress.findUnique({
        where: {
          userId_clubId: {
            userId,
            clubId
          }
        },
        select: {
          mode: true,
          currentMilestone: {
            select: {
              id: true,
              position: true,
              safeTitle: true
            }
          },
          updatedAt: true
        }
      }),
      prisma.milestone.count({
        where: {
          clubId
        }
      })
    ]);

    return {
      mode: (progress?.mode ?? "STRICT") as ProgressMode,
      currentMilestone: progress?.currentMilestone ?? null,
      totalMilestones,
      updatedAt: progress?.updatedAt ?? null
    };
  },

  getRecentlyUnlockedSummary: async (userId, clubId, limit) => {
    const result = await progressRepository.listRecentlyUnlockedPostsForUserClub(
      userId,
      clubId,
      {
        cursor: null,
        limit
      }
    );

    return {
      unlock: result.unlock,
      posts: result.posts,
      currentProgress: result.currentProgress
    };
  }
};

const visiblePostWhere = (clubId: string): Prisma.PostWhereInput => ({
  clubId,
  status: "VISIBLE",
  deletedAt: null
});
