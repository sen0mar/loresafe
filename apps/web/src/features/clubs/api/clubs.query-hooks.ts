import { type InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  BanClubMemberInput, BanReportedContentAuthorInput, ClubFeedTab,
  ClubMilestonesResponse, ClubMembersQueryInput, ClubPostCard,
  ClubPostsResponse, CreateClubMilestoneInput,
  CreateClubMilestoneTemplateInput, CreateClubPostInput,
  CreatePostCommentInput, JoinedClubsQueryInput, JoinedClubsQueryOptions,
  ModerationReport, ModerationReportNoteInput, ModerationReportsResponse,
  MoveClubMilestoneInput, PostCommentsResponse, PostDetailResponse,
  PublicClubsQueryInput, ResolveModerationReportInput,
  ToggleCommentReactionInput, TogglePostReactionInput,
  UpdateClubMemberRoleInput, UpdateClubMilestoneInput,
  UpdateClubProgressInput, UpdateClubSettingsInput,
  UpdateReportRequiredMilestoneInput
} from "./clubs.types.js";
import {
  advanceClubProgressToNextMilestone, banClubMember,
  banReportedContentAuthor, createClub, createClubMilestone,
  createClubMilestoneTemplate, createClubPost, createPostComment, createReport,
  deleteComment, deletePost, deleteReportedContent, getClubBans,
  getClubByLinkName, getClubDashboardStats, getClubMembers,
  getClubMilestones, getClubPosts, getClubProgress,
  getClubProgressSummary, getJoinedClubs, getModerationReports,
  getPopularDiscussions, getPostById, getPostComments, getPublicClubs,
  getRecentlyUnlockedPosts, getRecentlyUnlockedSummary, hideReportedContent,
  joinClub, leaveClub, moveClubMilestone, resolveModerationReport,
  revealModerationReport, revealPost, revealPostComment, toggleCommentReaction,
  togglePostReaction, unbanClubBan, updateClubMemberRole,
  updateClubMilestone, updateClubProgress, updateClubSettings,
  updateReportRequiredMilestone, warnReportedContentAuthor
} from "./clubs.requests.js";
import {
  removeCommentFromInfiniteData, removePostFromPostListQueries,
  toggleCommentReactionOnComment, togglePostReactionOnCard,
  updateCommentInInfiniteData, updatePostInInfiniteData
} from "./clubs.optimistic.js";
import { clubsQueryKeys } from "./clubs.query-keys.js";

export const usePublicClubsQuery = (
  enabled = true,
  input: PublicClubsQueryInput = {}
) =>
  useQuery({
    queryKey: clubsQueryKeys.discovery(input),
    queryFn: ({ signal }) => getPublicClubs(input, signal),
    enabled
  });

export const useClubQuery = (linkName: string) =>
  useQuery({
    queryKey: clubsQueryKeys.detail(linkName),
    queryFn: ({ signal }) => getClubByLinkName(linkName, signal),
    enabled: linkName.length > 0
  });

export const useClubMilestonesQuery = (
  linkName: string,
  page: number,
  enabled = true
) =>
  useQuery({
    queryKey: clubsQueryKeys.milestones(linkName, page),
    queryFn: ({ signal }) => getClubMilestones(linkName, page, signal),
    enabled: enabled && linkName.length > 0
  });

export const useClubProgressQuery = (linkName: string, enabled = true) =>
  useQuery({
    queryKey: clubsQueryKeys.progress(linkName),
    queryFn: ({ signal }) => getClubProgress(linkName, signal),
    enabled: enabled && linkName.length > 0
  });

export const useClubMembersQuery = (
  linkName: string,
  page: number,
  q = "",
  enabled = true
) =>
  useQuery({
    queryKey: clubsQueryKeys.members(linkName, { page, q }),
    queryFn: ({ signal }) => getClubMembers(linkName, { page, q }, signal),
    enabled: enabled && linkName.length > 0
  });

export const useClubBansQuery = (
  linkName: string,
  page: number,
  enabled = true
) =>
  useQuery({
    queryKey: clubsQueryKeys.bans(linkName, page),
    queryFn: ({ signal }) => getClubBans(linkName, page, signal),
    enabled: enabled && linkName.length > 0
  });

export const useClubPostsInfiniteQuery = (
  linkName: string,
  tab: ClubFeedTab
) =>
  useInfiniteQuery({
    queryKey: clubsQueryKeys.feed(linkName, tab),
    queryFn: ({ pageParam, signal }) => getClubPosts(linkName, tab, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    enabled: linkName.length > 0
  });

export const useRecentlyUnlockedQuery = (linkName: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: clubsQueryKeys.recentlyUnlocked(linkName),
    queryFn: ({ pageParam, signal }) => getRecentlyUnlockedPosts(linkName, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    enabled: enabled && linkName.length > 0
  });

export const useClubDashboardStatsQuery = (linkName: string, enabled = true) =>
  useQuery({
    queryKey: clubsQueryKeys.dashboardStats(linkName),
    queryFn: ({ signal }) => getClubDashboardStats(linkName, signal),
    enabled: enabled && linkName.length > 0
  });

export const useClubProgressSummaryQuery = (linkName: string, enabled = true) =>
  useQuery({
    queryKey: clubsQueryKeys.dashboardProgressSummary(linkName),
    queryFn: ({ signal }) => getClubProgressSummary(linkName, signal),
    enabled: enabled && linkName.length > 0
  });

export const usePopularDiscussionsQuery = (linkName: string, enabled = true) =>
  useQuery({
    queryKey: clubsQueryKeys.dashboardPopularDiscussions(linkName),
    queryFn: ({ signal }) => getPopularDiscussions(linkName, signal),
    enabled: enabled && linkName.length > 0
  });

export const useRecentlyUnlockedSummaryQuery = (
  linkName: string,
  enabled = true
) =>
  useQuery({
    queryKey: clubsQueryKeys.dashboardRecentlyUnlockedSummary(linkName),
    queryFn: ({ signal }) => getRecentlyUnlockedSummary(linkName, signal),
    enabled: enabled && linkName.length > 0
  });

export const usePostQuery = (postId: string) =>
  useQuery({
    queryKey: clubsQueryKeys.postDetail(postId),
    queryFn: ({ signal }) => getPostById(postId, signal),
    enabled: postId.length > 0
  });

export const usePostCommentsQuery = (postId: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: clubsQueryKeys.postComments(postId),
    queryFn: ({ pageParam, signal }) => getPostComments(postId, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor ?? undefined,
    enabled: enabled && postId.length > 0
  });

export const useJoinedClubsQuery = (
  options: boolean | JoinedClubsQueryOptions = true
) => {
  const queryOptions =
    typeof options === "boolean" ? { enabled: options } : options;
  const queryInput = {
    cursor: queryOptions.cursor,
    q: queryOptions.q,
    limit: queryOptions.limit
  };
  const hasCustomQuery =
    Boolean(queryInput.q?.trim()) || queryInput.cursor || queryInput.limit;

  return useQuery({
    queryKey: hasCustomQuery
      ? clubsQueryKeys.joinedList(queryInput)
      : clubsQueryKeys.joined,
    queryFn: ({ signal }) => getJoinedClubs(queryInput, signal),
    enabled: queryOptions.enabled ?? true
  });
};

export const useJoinedClubsInfiniteQuery = (
  options: Omit<JoinedClubsQueryOptions, "cursor"> = {}
) =>
  useInfiniteQuery({
    queryKey: clubsQueryKeys.joinedList({
      q: options.q,
      limit: options.limit
    }),
    queryFn: ({ pageParam, signal }) =>
      getJoinedClubs({
        q: options.q,
        limit: options.limit,
        cursor: pageParam ?? undefined
      }, signal),
    enabled: options.enabled ?? true,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.nextCursor ?? undefined
  });
