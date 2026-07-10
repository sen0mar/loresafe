import { prisma } from "../../core/prisma/client.js";
import { Prisma } from "../../generated/prisma/client.js";
import { activeUserBanWhere } from "../clubs/club-bans.js";
import type { ClubCategory } from "../clubs/clubs.schema.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import {
  postSelect,
  toClubPostRecord,
  type ClubPostRecord,
  userReactionMapForPostIds
} from "../posts/posts.repository.js";
import { visiblePostAccessWhere } from "../posts/post-access-where.js";

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type SearchClubRecord = {
  id: string;
  title: string;
  linkName: string;
  description: string | null;
  category: ClubCategory;
  coverAsset: {
    objectKey: string;
    status: "PENDING" | "READY" | "FAILED";
  } | null;
  visibility: ClubVisibility;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SearchPostRecord = {
  post: ClubPostRecord;
  club: {
    id: string;
    linkName: string;
    title: string;
    visibility: ClubVisibility;
    currentUserRole: ClubMembershipRole | null;
    progress: {
      mode: ProgressMode;
      currentMilestonePosition: number | null;
    };
    isCurrentUserBanned: boolean;
  };
};

export type SearchResult<TRecord> = {
  records: TRecord[];
  hasMore: boolean;
};

export type SearchRepository = {
  searchClubs: (
    query: string,
    userId: string,
    input: SearchPageInput
  ) => Promise<SearchResult<SearchClubRecord>>;
  searchPosts: (
    query: string,
    userId: string,
    input: SearchPostPageInput
  ) => Promise<SearchResult<SearchPostRecord>>;
};

type SearchPageInput = {
  offset: number;
  limit: number;
};

type SearchPostPageInput = SearchPageInput & {
  includeSafe: boolean;
  includeSpoiler: boolean;
};

type SearchClubRow = {
  id: string;
  title: string;
  linkName: string;
  description: string | null;
  category: ClubCategory;
  visibility: ClubVisibility;
  coverObjectKey: string | null;
  coverStatus: "PENDING" | "READY" | "FAILED" | null;
  memberCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
};

type SearchPostRow = {
  id: string;
};

type SelectedSearchPost = Prisma.PostGetPayload<{
  select: ReturnType<typeof searchPostSelect>;
}>;

const searchPostSelect = (userId: string) => {
  const now = new Date();

  return {
    ...postSelect,
    club: {
      select: {
        id: true,
        linkName: true,
        title: true,
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
        },
        bans: {
          where: activeUserBanWhere(userId, now),
          select: {
            id: true
          },
          take: 1
        },
      }
    }
  } as const;
};

export const searchRepository: SearchRepository = {
  searchClubs: async (query, userId, { limit, offset }) => {
    const rows = await prisma.$queryRaw<SearchClubRow[]>`
      WITH search AS (
        SELECT websearch_to_tsquery('english', ${query}) AS query
      )
      SELECT
        c."id",
        c."title",
        c."link_name" AS "linkName",
        c."description",
        c."category",
        c."visibility"::text AS "visibility",
        cover."object_key" AS "coverObjectKey",
        cover."status"::text AS "coverStatus",
        COUNT(DISTINCT member_count."id")::int AS "memberCount",
        c."created_at" AS "createdAt",
        c."updated_at" AS "updatedAt"
      FROM "clubs" c
      CROSS JOIN search
      LEFT JOIN "file_assets" cover ON cover."id" = c."cover_asset_id"
      LEFT JOIN "club_memberships" current_member
        ON current_member."club_id" = c."id"
        AND current_member."user_id" = ${userId}::uuid
      LEFT JOIN "club_bans" current_ban
        ON current_ban."club_id" = c."id"
        AND current_ban."user_id" = ${userId}::uuid
        AND current_ban."revoked_at" IS NULL
        AND (
          current_ban."expires_at" IS NULL
          OR current_ban."expires_at" > now()
        )
      LEFT JOIN "club_memberships" member_count
        ON member_count."club_id" = c."id"
      WHERE (
        c."visibility" = 'PUBLIC'
        OR current_member."user_id" IS NOT NULL
      )
      AND current_ban."id" IS NULL
      AND to_tsvector(
        'english',
        coalesce(c."title", '') || ' ' ||
        coalesce(c."description", '') || ' ' ||
        CASE c."category"
          WHEN 'BOOKS' THEN 'Books'
          WHEN 'TV_SHOWS' THEN 'TV Shows'
          WHEN 'ANIME' THEN 'Anime'
          WHEN 'MANGA' THEN 'Manga'
          WHEN 'MOVIES' THEN 'Movies'
          WHEN 'GAMES' THEN 'Games'
          WHEN 'PODCASTS' THEN 'Podcasts'
          WHEN 'COURSES' THEN 'Courses'
          WHEN 'COMICS_GRAPHIC_NOVELS' THEN 'Comics Graphic Novels'
          WHEN 'WEB_SERIALS' THEN 'Web Serials'
          WHEN 'CUSTOM_TIMELINE' THEN 'Custom Timeline'
        END || ' ' ||
        coalesce(c."link_name", '')
      ) @@ search.query
      GROUP BY c."id", cover."object_key", cover."status", search.query
      ORDER BY ts_rank_cd(
        to_tsvector(
          'english',
          coalesce(c."title", '') || ' ' ||
          coalesce(c."description", '') || ' ' ||
          CASE c."category"
            WHEN 'BOOKS' THEN 'Books'
            WHEN 'TV_SHOWS' THEN 'TV Shows'
            WHEN 'ANIME' THEN 'Anime'
            WHEN 'MANGA' THEN 'Manga'
            WHEN 'MOVIES' THEN 'Movies'
            WHEN 'GAMES' THEN 'Games'
            WHEN 'PODCASTS' THEN 'Podcasts'
            WHEN 'COURSES' THEN 'Courses'
            WHEN 'COMICS_GRAPHIC_NOVELS' THEN 'Comics Graphic Novels'
            WHEN 'WEB_SERIALS' THEN 'Web Serials'
            WHEN 'CUSTOM_TIMELINE' THEN 'Custom Timeline'
          END || ' ' ||
          coalesce(c."link_name", '')
        ),
        search.query
      ) DESC, c."updated_at" DESC, c."id" ASC
      OFFSET ${offset}
      LIMIT ${limit + 1}
    `;
    const pageRows = rows.slice(0, limit);

    return {
      records: pageRows.map(toSearchClubRecord),
      hasMore: rows.length > limit
    };
  },

  searchPosts: async (
    query,
    userId,
    { includeSafe, includeSpoiler, limit, offset }
  ) => {
    const visibilityCondition = searchPostVisibilityCondition({
      includeSafe,
      includeSpoiler
    });
    const rows = await prisma.$queryRaw<SearchPostRow[]>`
      WITH search AS (
        SELECT websearch_to_tsquery('english', ${query}) AS query
      )
      SELECT p."id"
      FROM "posts" p
      CROSS JOIN search
      INNER JOIN "clubs" c ON c."id" = p."club_id"
      INNER JOIN "milestones" required_milestone
        ON required_milestone."id" = p."required_milestone_id"
      LEFT JOIN "club_memberships" current_member
        ON current_member."club_id" = c."id"
        AND current_member."user_id" = ${userId}::uuid
      LEFT JOIN "club_progress" current_progress
        ON current_progress."club_id" = c."id"
        AND current_progress."user_id" = ${userId}::uuid
      LEFT JOIN "milestones" current_milestone
        ON current_milestone."id" = current_progress."current_milestone_id"
      LEFT JOIN "club_bans" current_ban
        ON current_ban."club_id" = c."id"
        AND current_ban."user_id" = ${userId}::uuid
        AND current_ban."revoked_at" IS NULL
        AND (
          current_ban."expires_at" IS NULL
          OR current_ban."expires_at" > now()
        )
      WHERE p."status" = 'VISIBLE'
      AND p."deleted_at" IS NULL
      AND (
        c."visibility" = 'PUBLIC'
        OR current_member."user_id" IS NOT NULL
      )
      AND current_ban."id" IS NULL
      ${visibilityCondition}
      AND to_tsvector(
        'english',
        coalesce(p."title", '') || ' ' || coalesce(p."body", '')
      ) @@ search.query
      ORDER BY ts_rank_cd(
        to_tsvector(
          'english',
          coalesce(p."title", '') || ' ' || coalesce(p."body", '')
        ),
        search.query
      ) DESC, p."created_at" DESC, p."id" ASC
      OFFSET ${offset}
      LIMIT ${limit + 1}
    `;
    const pageRows = rows.slice(0, limit);
    const postIds = pageRows.map((row) => row.id);
    const posts = await prisma.post.findMany({
      where: {
        id: {
          in: postIds
        },
        ...visiblePostAccessWhere(userId)
      },
      select: searchPostSelect(userId)
    });
    const authorizedPosts = posts.filter((post) =>
      matchesSearchSafetyFilter(post, { includeSafe, includeSpoiler })
    );
    const authorizedPostIds = authorizedPosts.map((post) => post.id);
    const postOrder = new Map(postIds.map((postId, index) => [postId, index]));
    const reactionMap = await userReactionMapForPostIds(
      authorizedPostIds,
      userId
    );

    return {
      records: authorizedPosts
        .sort(
          (left, right) =>
            (postOrder.get(left.id) ?? 0) - (postOrder.get(right.id) ?? 0)
        )
        .map((post) => toSearchPostRecord(post, reactionMap)),
      hasMore: rows.length > limit
    };
  }
};

const searchPostVisibilityCondition = ({
  includeSafe,
  includeSpoiler
}: {
  includeSafe: boolean;
  includeSpoiler: boolean;
}) => {
  if (includeSafe && includeSpoiler) {
    return Prisma.empty;
  }

  const safeCondition = Prisma.sql`(
    current_progress."mode" = 'FINISHED'
    OR required_milestone."position" <= coalesce(current_milestone."position", 0)
  )`;

  if (includeSafe) {
    return Prisma.sql`AND ${safeCondition}`;
  }

  return Prisma.sql`AND NOT ${safeCondition}`;
};

const matchesSearchSafetyFilter = (
  post: SelectedSearchPost,
  {
    includeSafe,
    includeSpoiler
  }: {
    includeSafe: boolean;
    includeSpoiler: boolean;
  }
) => {
  if (includeSafe && includeSpoiler) {
    return true;
  }

  const progress = post.club.progress[0];
  const isSafe =
    progress?.mode === "FINISHED" ||
    post.requiredMilestone.position <=
      (progress?.currentMilestone?.position ?? 0);

  return includeSafe ? isSafe : !isSafe;
};

const toSearchClubRecord = (row: SearchClubRow): SearchClubRecord => ({
  id: row.id,
  title: row.title,
  linkName: row.linkName,
  description: row.description,
  category: row.category,
  coverAsset:
    row.coverObjectKey && row.coverStatus
      ? {
          objectKey: row.coverObjectKey,
          status: row.coverStatus
        }
      : null,
  visibility: row.visibility,
  memberCount: Number(row.memberCount),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

const toSearchPostRecord = (
  post: SelectedSearchPost,
  reactionMap: Parameters<typeof toClubPostRecord>[1]
): SearchPostRecord => {
  const progress = post.club.progress[0];

  return {
    post: toClubPostRecord(post, reactionMap),
    club: {
      id: post.club.id,
      linkName: post.club.linkName,
      title: post.club.title,
      visibility: post.club.visibility as ClubVisibility,
      currentUserRole: post.club.memberships[0]?.role ?? null,
      isCurrentUserBanned: post.club.bans.length > 0,
      progress: {
        mode: (progress?.mode ?? "STRICT") as ProgressMode,
        currentMilestonePosition:
          progress?.currentMilestone?.position ?? null
      }
    }
  };
};
