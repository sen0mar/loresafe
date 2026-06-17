import { prisma } from "../../core/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import {
  postSelect,
  toClubPostRecord,
  type ClubPostRecord,
  userReactionMapForPostIds
} from "../posts/posts.repository.js";

type ClubVisibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type SearchClubRecord = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
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
    slug: string;
    title: string;
    visibility: ClubVisibility;
    currentUserRole: ClubMembershipRole | null;
    progress: {
      mode: ProgressMode;
      currentMilestonePosition: number | null;
    };
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
    input: SearchPageInput
  ) => Promise<SearchResult<SearchPostRecord>>;
};

type SearchPageInput = {
  offset: number;
  limit: number;
};

type SearchClubRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
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
  select: typeof searchPostSelect;
}>;

const searchPostSelect = {
  ...postSelect,
  club: {
    select: {
      id: true,
      slug: true,
      title: true,
      visibility: true,
      memberships: {
        select: {
          role: true
        },
        take: 1
      },
      progress: {
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
} as const;

export const searchRepository: SearchRepository = {
  searchClubs: async (query, userId, { limit, offset }) => {
    const rows = await prisma.$queryRaw<SearchClubRow[]>`
      WITH search AS (
        SELECT websearch_to_tsquery('english', ${query}) AS query
      )
      SELECT
        c."id",
        c."title",
        c."slug",
        c."description",
        c."category",
        c."visibility"::text AS "visibility",
        cover."object_key" AS "coverObjectKey",
        cover."status"::text AS "coverStatus",
        COUNT(member_count."id")::int AS "memberCount",
        c."created_at" AS "createdAt",
        c."updated_at" AS "updatedAt"
      FROM "clubs" c
      CROSS JOIN search
      LEFT JOIN "file_assets" cover ON cover."id" = c."cover_asset_id"
      LEFT JOIN "club_memberships" current_member
        ON current_member."club_id" = c."id"
        AND current_member."user_id" = ${userId}::uuid
      LEFT JOIN "club_memberships" member_count
        ON member_count."club_id" = c."id"
      WHERE (
        c."visibility" = 'PUBLIC'
        OR current_member."user_id" IS NOT NULL
      )
      AND to_tsvector(
        'english',
        coalesce(c."title", '') || ' ' ||
        coalesce(c."description", '') || ' ' ||
        coalesce(c."category", '') || ' ' ||
        coalesce(c."slug", '')
      ) @@ search.query
      GROUP BY c."id", cover."object_key", cover."status", search.query
      ORDER BY ts_rank_cd(
        to_tsvector(
          'english',
          coalesce(c."title", '') || ' ' ||
          coalesce(c."description", '') || ' ' ||
          coalesce(c."category", '') || ' ' ||
          coalesce(c."slug", '')
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

  searchPosts: async (query, userId, { limit, offset }) => {
    const rows = await prisma.$queryRaw<SearchPostRow[]>`
      WITH search AS (
        SELECT websearch_to_tsquery('english', ${query}) AS query
      )
      SELECT p."id"
      FROM "posts" p
      CROSS JOIN search
      INNER JOIN "clubs" c ON c."id" = p."club_id"
      LEFT JOIN "club_memberships" current_member
        ON current_member."club_id" = c."id"
        AND current_member."user_id" = ${userId}::uuid
      WHERE p."status" = 'VISIBLE'
      AND p."deleted_at" IS NULL
      AND (
        c."visibility" = 'PUBLIC'
        OR current_member."user_id" IS NOT NULL
      )
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
        }
      },
      select: searchPostSelect
    });
    const postOrder = new Map(postIds.map((postId, index) => [postId, index]));
    const reactionMap = await userReactionMapForPostIds(postIds, userId);

    return {
      records: posts
        .sort(
          (left, right) =>
            (postOrder.get(left.id) ?? 0) - (postOrder.get(right.id) ?? 0)
        )
        .map((post) => toSearchPostRecord(post, reactionMap)),
      hasMore: rows.length > limit
    };
  }
};

const toSearchClubRecord = (row: SearchClubRow): SearchClubRecord => ({
  id: row.id,
  title: row.title,
  slug: row.slug,
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
      slug: post.club.slug,
      title: post.club.title,
      visibility: post.club.visibility as ClubVisibility,
      currentUserRole: post.club.memberships[0]?.role ?? null,
      progress: {
        mode: (progress?.mode ?? "STRICT") as ProgressMode,
        currentMilestonePosition:
          progress?.currentMilestone?.position ?? null
      }
    }
  };
};
