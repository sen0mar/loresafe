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
import { visiblePostAccessWhere } from "../posts/post-access-where.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import { progressQueryRepository } from "../progress/progress-query.repository.js";
import type { RecentlyUnlockedRecord } from "../progress/progress.repository.types.js";

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
  viewer: {
    joinedAt: Date | null;
    postCount: number;
    commentCount: number;
  };
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
  viewer: {
    mode: ProgressMode;
    currentMilestonePosition: number | null;
    currentUserRole: ClubMembershipRole | null;
  };
};

export type RecentlyUnlockedSummaryRecord = Omit<
  RecentlyUnlockedRecord,
  "nextCursor" | "hasMore"
>;

type PopularDiscussionRankRow = {
  id: string;
  engagement_score: number | bigint;
};

type ClubDashboardStatsRow = {
  member_count: number | bigint;
  milestone_count: number | bigint;
  visible_post_count: number | bigint;
  visible_comment_count: number | bigint;
  post_reaction_count: number | bigint;
  safe_post_count: number | bigint;
  viewer_joined_at: Date | null;
  viewer_post_count: number | bigint;
  viewer_comment_count: number | bigint;
};

type SelectedPopularPost = Prisma.PostGetPayload<{
  select: ReturnType<typeof popularPostSelect>;
}>;

export type DashboardRepository = {
  findClubForDashboard: (
    linkName: string,
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
  findClubForDashboard: async (linkName, userId) => {
    const now = new Date();
    const club = await prisma.club.findUnique({
      where: {
        linkName
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
      currentUserRole: (club.memberships[0]?.role ??
        null) as ClubMembershipRole | null,
      isCurrentUserBanned: club.bans.length > 0,
      progress: {
        mode: (progress?.mode ?? "STRICT") as ProgressMode,
        currentMilestonePosition: progress?.currentMilestone?.position ?? null
      }
    };
  },

  getClubDashboardStats: async (userId, club) => {
    const progressPosition = club.progress.currentMilestonePosition ?? 0;
    const rows = await prisma.$queryRaw<ClubDashboardStatsRow[]>`
      WITH membership_stats AS (
        SELECT
          COUNT(*)::int AS member_count,
          MIN(created_at) FILTER (WHERE user_id = ${userId}::uuid) AS viewer_joined_at
        FROM club_memberships
        WHERE club_id = ${club.id}::uuid
      ),
      milestone_stats AS (
        SELECT COUNT(*)::int AS milestone_count
        FROM milestones
        WHERE club_id = ${club.id}::uuid
      ),
      visible_posts AS MATERIALIZED (
        SELECT p.id, p.author_id, m.position AS milestone_position
        FROM posts p
        INNER JOIN milestones m ON m.id = p.required_milestone_id
        WHERE p.club_id = ${club.id}::uuid
          AND p.status = 'VISIBLE'
          AND p.deleted_at IS NULL
      ),
      post_stats AS (
        SELECT
          COUNT(*)::int AS visible_post_count,
          COUNT(*) FILTER (WHERE author_id = ${userId}::uuid)::int AS viewer_post_count,
          COUNT(*) FILTER (
            WHERE ${club.progress.mode === "FINISHED"}
              OR milestone_position <= ${progressPosition}
          )::int AS safe_post_count
        FROM visible_posts
      ),
      visible_comments AS MATERIALIZED (
        SELECT c.id, c.author_id
        FROM comments c
        INNER JOIN visible_posts p ON p.id = c.post_id
        WHERE c.status = 'VISIBLE'
          AND c.deleted_at IS NULL
      ),
      comment_stats AS (
        SELECT
          COUNT(*)::int AS visible_comment_count,
          COUNT(*) FILTER (WHERE author_id = ${userId}::uuid)::int AS viewer_comment_count
        FROM visible_comments
      ),
      reaction_stats AS (
        SELECT COUNT(*)::int AS post_reaction_count
        FROM post_reactions r
        INNER JOIN visible_posts p ON p.id = r.post_id
      )
      SELECT
        membership_stats.member_count,
        membership_stats.viewer_joined_at,
        milestone_stats.milestone_count,
        post_stats.visible_post_count,
        post_stats.viewer_post_count,
        post_stats.safe_post_count,
        comment_stats.visible_comment_count,
        comment_stats.viewer_comment_count,
        reaction_stats.post_reaction_count
      FROM membership_stats, milestone_stats, post_stats, comment_stats, reaction_stats
    `;
    const stats = rows[0];

    if (!stats) {
      throw new Error("Dashboard aggregate query returned no row.");
    }

    const memberCount = Number(stats.member_count);
    const milestoneCount = Number(stats.milestone_count);
    const visiblePostCount = Number(stats.visible_post_count);
    const visibleCommentCount = Number(stats.visible_comment_count);
    const postReactionCount = Number(stats.post_reaction_count);
    const safePostCount = Number(stats.safe_post_count);
    const viewerPostCount = Number(stats.viewer_post_count);
    const viewerCommentCount = Number(stats.viewer_comment_count);

    return {
      memberCount,
      milestoneCount,
      visiblePostCount,
      visibleCommentCount,
      postReactionCount,
      safePostCount,
      lockedPostCount: Math.max(0, visiblePostCount - safePostCount),
      viewer: {
        joinedAt: stats.viewer_joined_at,
        postCount: viewerPostCount,
        commentCount: viewerCommentCount
      }
    };
  },

  getPopularDiscussions: async (userId, clubId, limit) => {
    const createdAfter = new Date(Date.now() - popularDiscussionWindowMs);
    const rankedRows = await prisma.$queryRaw<PopularDiscussionRankRow[]>`
      WITH candidate_posts AS MATERIALIZED (
        SELECT id, created_at
        FROM posts
        WHERE club_id = ${clubId}::uuid
          AND status = 'VISIBLE'
          AND deleted_at IS NULL
          AND created_at >= ${createdAfter}
      ),
      comment_counts AS (
        SELECT c.post_id, COUNT(*)::int AS comment_count
        FROM comments c
        INNER JOIN candidate_posts p ON p.id = c.post_id
        WHERE c.status = 'VISIBLE' AND c.deleted_at IS NULL
        GROUP BY c.post_id
      ),
      reaction_counts AS (
        SELECT r.post_id, COUNT(*)::int AS reaction_count
        FROM post_reactions r
        INNER JOIN candidate_posts p ON p.id = r.post_id
        GROUP BY r.post_id
      )
      SELECT
        p.id,
        (
          COALESCE(comment_counts.comment_count, 0) +
          COALESCE(reaction_counts.reaction_count, 0)
        ) AS engagement_score
      FROM candidate_posts p
      LEFT JOIN comment_counts ON comment_counts.post_id = p.id
      LEFT JOIN reaction_counts ON reaction_counts.post_id = p.id
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
        },
        clubId,
        ...visiblePostAccessWhere(userId)
      },
      select: popularPostSelect(userId)
    });
    const postById = new Map(posts.map((post) => [post.id, post]));
    const reactionMap = await userReactionMapForPostIds(
      posts.map((post) => post.id),
      userId
    );

    return rankedRows.flatMap((row) => {
      const post = postById.get(row.id);

      if (!post) {
        return [];
      }

      return {
        post: toClubPostRecord(post, reactionMap),
        engagementScore: Number(row.engagement_score),
        viewer: toPopularDiscussionViewer(post)
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
    const result =
      await progressQueryRepository.listRecentlyUnlockedPostsForUserClub(
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

const popularDiscussionWindowMs = 30 * 24 * 60 * 60 * 1000;

const popularPostSelect = (userId: string) => ({
  ...postSelect,
  club: {
    select: {
      memberships: {
        where: {
          userId
        },
        select: {
          role: true
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
  }
});

const toPopularDiscussionViewer = (
  post: SelectedPopularPost
): PopularDiscussionRecord["viewer"] => {
  const progress = post.club.progress[0];

  return {
    mode: (progress?.mode ?? "STRICT") as ProgressMode,
    currentMilestonePosition: progress?.currentMilestone?.position ?? null,
    currentUserRole: (post.club.memberships[0]?.role ??
      null) as ClubMembershipRole | null
  };
};
