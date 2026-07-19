import type {
  ClubFeedTab,
  ClubMembersQueryInput,
  JoinedClubsQueryInput,
  PublicClubsQueryInput
} from "./clubs.types.js";

export const clubsQueryKeys = {
  discoveryRoot: ["clubs", "discovery"] as const,
  discovery: (input: PublicClubsQueryInput = {}) =>
    [
      "clubs",
      "discovery",
      {
        limit: input.limit ?? 20,
        cursor: input.cursor ?? null,
        sort: input.sort ?? "newest"
      }
    ] as const,
  joined: ["users", "me", "clubs"] as const,
  joinedList: ({ cursor, limit, q }: JoinedClubsQueryInput) =>
    ["users", "me", "clubs", { cursor, limit, q: q?.trim() ?? "" }] as const,
  detail: (linkName: string) => ["clubs", "detail", linkName] as const,
  milestonesRoot: (linkName: string) =>
    ["clubs", "detail", linkName, "milestones"] as const,
  milestones: (linkName: string, page: number) =>
    ["clubs", "detail", linkName, "milestones", page] as const,
  progress: (linkName: string) =>
    ["clubs", "detail", linkName, "progress"] as const,
  membersRoot: (linkName: string) =>
    ["clubs", "detail", linkName, "members"] as const,
  members: (linkName: string, { page = 1, q = "" }: ClubMembersQueryInput) =>
    ["clubs", "detail", linkName, "members", { page, q: q.trim() }] as const,
  bansRoot: (linkName: string) =>
    ["clubs", "detail", linkName, "bans"] as const,
  bans: (linkName: string, page: number) =>
    ["clubs", "detail", linkName, "bans", page] as const,
  feedRoot: (linkName: string) =>
    ["clubs", "detail", linkName, "feed"] as const,
  feed: (linkName: string, tab: ClubFeedTab) =>
    ["clubs", "detail", linkName, "feed", tab] as const,
  dashboardRoot: (linkName: string) =>
    ["clubs", "detail", linkName, "dashboard"] as const,
  dashboardStats: (linkName: string) =>
    ["clubs", "detail", linkName, "dashboard", "stats"] as const,
  dashboardProgressSummary: (linkName: string) =>
    ["clubs", "detail", linkName, "dashboard", "progress-summary"] as const,
  recentlyUnlocked: (linkName: string) =>
    ["clubs", "detail", linkName, "recently-unlocked"] as const,
  moderationReports: (linkName: string) =>
    ["clubs", "detail", linkName, "moderation", "reports"] as const,
  postsRoot: ["posts"] as const,
  postDetail: (postId: string) => ["posts", "detail", postId] as const,
  postComments: (postId: string) =>
    ["posts", "detail", postId, "comments"] as const
};
