import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut
} from "@/shared/api/api-client";

import type {
  BanClubMemberInput,
  BanReportedContentAuthorInput,
  ClubBanResponse,
  ClubBansResponse,
  ClubDashboardStatsResponse,
  ClubFeedTab,
  ClubMemberResponse,
  ClubMembersQueryInput,
  ClubMembersResponse,
  ClubMilestonesResponse,
  ClubPostsResponse,
  ClubProgressResponse,
  ClubResponse,
  ClubsDiscoveryResponse,
  CreateClubInput,
  CreateClubMilestoneInput,
  CreateClubMilestoneResponse,
  CreateClubMilestoneTemplateInput,
  CreateClubMilestoneTemplateResponse,
  CreateClubPostInput,
  CreateClubPostResponse,
  CreatePostCommentInput,
  CreatePostCommentResponse,
  CreateReportInput,
  CreateReportResponse,
  DeleteCommentResponse,
  DeletePostResponse,
  JoinedClubsQueryInput,
  JoinedClubsResponse,
  LeaveClubResponse,
  ModerationReportActionResponse,
  ModerationReportNoteInput,
  ModerationReportsResponse,
  MoveClubMilestoneInput,
  MoveClubMilestoneResponse,
  PostCommentsResponse,
  PostDetailResponse,
  ProgressSummaryResponse,
  PublicClubsQueryInput,
  RecentlyUnlockedResponse,
  ResolveModerationReportInput,
  RevealCommentResponse,
  RevealModerationReportResponse,
  RevealPostResponse,
  ToggleCommentReactionInput,
  ToggleCommentReactionResponse,
  TogglePostReactionInput,
  TogglePostReactionResponse,
  UpdateClubMemberRoleInput,
  UpdateClubMilestoneInput,
  UpdateClubMilestoneResponse,
  UpdateClubProgressInput,
  UpdateClubSettingsInput,
  UpdateReportRequiredMilestoneInput
} from "./clubs.types.js";

export const getPublicClubs = (
  input: PublicClubsQueryInput = {},
  signal?: AbortSignal
) => {
  const params = new URLSearchParams();

  if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  if (input.sort) {
    params.set("sort", input.sort);
  }

  const query = params.toString();

  return apiGet<ClubsDiscoveryResponse>(
    query ? `/api/clubs?${query}` : "/api/clubs",
    { signal }
  );
};

export const getClubByLinkName = (linkName: string, signal?: AbortSignal) =>
  apiGet<ClubResponse>(`/api/clubs/${linkName}`, { signal });

export const getClubMembers = (
  linkName: string,
  { page = 1, q = "" }: ClubMembersQueryInput = {},
  signal?: AbortSignal
) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: "20"
  });
  const normalizedQuery = q.trim();

  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  return apiGet<ClubMembersResponse>(
    `/api/clubs/${linkName}/members?${params.toString()}`,
    { signal }
  );
};

export const getClubBans = (linkName: string, page = 1, signal?: AbortSignal) =>
  apiGet<ClubBansResponse>(
    `/api/clubs/${linkName}/bans?page=${page}&limit=20`,
    { signal }
  );

export const getClubMilestones = (
  linkName: string,
  page = 1,
  signal?: AbortSignal
) =>
  apiGet<ClubMilestonesResponse>(
    `/api/clubs/${linkName}/milestones?page=${page}&limit=100`,
    { signal }
  );

export const getClubProgress = (linkName: string, signal?: AbortSignal) =>
  apiGet<ClubProgressResponse>(`/api/clubs/${linkName}/progress`, { signal });

export const getClubPosts = (
  linkName: string,
  tab: ClubFeedTab,
  cursor: string | null = null,
  signal?: AbortSignal
) => {
  const params = new URLSearchParams({
    tab,
    limit: "20"
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return apiGet<ClubPostsResponse>(`/api/clubs/${linkName}/posts?${params}`, {
    signal
  });
};

export const getRecentlyUnlockedPosts = (
  linkName: string,
  cursor: string | null = null,
  signal?: AbortSignal
) => {
  const params = new URLSearchParams({
    limit: "20"
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return apiGet<RecentlyUnlockedResponse>(
    `/api/clubs/${linkName}/recently-unlocked?${params}`,
    { signal }
  );
};

export const getClubDashboardStats = (linkName: string, signal?: AbortSignal) =>
  apiGet<ClubDashboardStatsResponse>(`/api/clubs/${linkName}/stats`, {
    signal
  });

export const getClubProgressSummary = (
  linkName: string,
  signal?: AbortSignal
) =>
  apiGet<ProgressSummaryResponse>(`/api/clubs/${linkName}/progress/summary`, {
    signal
  });

export const getPostById = (postId: string, signal?: AbortSignal) =>
  apiGet<PostDetailResponse>(`/api/posts/${postId}`, { signal });

export const getPostComments = (
  postId: string,
  cursor?: string,
  signal?: AbortSignal
) => {
  const params = new URLSearchParams({
    limit: "20"
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return apiGet<PostCommentsResponse>(
    `/api/posts/${postId}/comments?${params.toString()}`,
    { signal }
  );
};

export const revealPost = (postId: string) =>
  apiPost<RevealPostResponse>(`/api/posts/${postId}/reveal`);

export const togglePostReaction = (
  postId: string,
  input: TogglePostReactionInput
) => {
  const path = `/api/posts/${postId}/reactions/${encodeURIComponent(input.emoji)}`;

  return input.active
    ? apiPut<TogglePostReactionResponse>(path)
    : apiDelete<TogglePostReactionResponse>(path);
};

export const deletePost = (postId: string) =>
  apiPost<DeletePostResponse>(`/api/posts/${postId}/delete`);

export const toggleCommentReaction = (
  commentId: string,
  input: ToggleCommentReactionInput
) => {
  const path = `/api/comments/${commentId}/reactions/${encodeURIComponent(input.emoji)}`;

  return input.active
    ? apiPut<ToggleCommentReactionResponse>(path)
    : apiDelete<ToggleCommentReactionResponse>(path);
};

export const deleteComment = (commentId: string) =>
  apiPost<DeleteCommentResponse>(`/api/comments/${commentId}/delete`);

export const revealPostComment = (postId: string, commentId: string) =>
  apiPost<RevealCommentResponse>(
    `/api/posts/${postId}/comments/${commentId}/reveal`
  );

export const getJoinedClubs = (
  input: JoinedClubsQueryInput = {},
  signal?: AbortSignal
) => {
  const params = new URLSearchParams();
  const query = input.q?.trim();

  if (query) {
    params.set("q", query);
  }

  if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  const queryString = params.toString();

  return apiGet<JoinedClubsResponse>(
    queryString ? `/api/users/me/clubs?${queryString}` : "/api/users/me/clubs",
    { signal }
  );
};

export const createClub = (input: CreateClubInput) =>
  apiPost<ClubResponse, CreateClubInput>("/api/clubs", input);

export const createClubPost = (linkName: string, input: CreateClubPostInput) =>
  apiPost<CreateClubPostResponse, CreateClubPostInput>(
    `/api/clubs/${linkName}/posts`,
    input
  );

export const createPostComment = (
  postId: string,
  input: CreatePostCommentInput
) =>
  apiPost<CreatePostCommentResponse, CreatePostCommentInput>(
    `/api/posts/${postId}/comments`,
    input
  );

export const createReport = (input: CreateReportInput) =>
  apiPost<CreateReportResponse, CreateReportInput>("/api/reports", input);

export const updateClubSettings = (
  linkName: string,
  input: UpdateClubSettingsInput
) =>
  apiPatch<ClubResponse, UpdateClubSettingsInput>(
    `/api/clubs/${linkName}/settings`,
    input
  );

export const updateClubMemberRole = (
  linkName: string,
  membershipId: string,
  input: UpdateClubMemberRoleInput
) =>
  apiPatch<ClubMemberResponse, UpdateClubMemberRoleInput>(
    `/api/clubs/${linkName}/members/${membershipId}/role`,
    input
  );

export const banClubMember = (
  linkName: string,
  membershipId: string,
  input: BanClubMemberInput = {}
) =>
  apiPost<ClubBanResponse, BanClubMemberInput>(
    `/api/clubs/${linkName}/members/${membershipId}/ban`,
    input
  );

export const unbanClubBan = (linkName: string, banId: string) =>
  apiPost<ClubBanResponse>(`/api/clubs/${linkName}/bans/${banId}/unban`);

export const getModerationReports = (
  linkName: string,
  cursor: string | null = null,
  signal?: AbortSignal
) => {
  const params = new URLSearchParams({
    status: "OPEN",
    limit: "20"
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return apiGet<ModerationReportsResponse>(
    `/api/clubs/${linkName}/moderation/reports?${params}`,
    { signal }
  );
};

export const revealModerationReport = (linkName: string, reportId: string) =>
  apiPost<RevealModerationReportResponse>(
    `/api/clubs/${linkName}/moderation/reports/${reportId}/reveal`
  );

export const updateReportRequiredMilestone = (
  linkName: string,
  reportId: string,
  input: UpdateReportRequiredMilestoneInput
) =>
  apiPatch<ModerationReportActionResponse, UpdateReportRequiredMilestoneInput>(
    `/api/clubs/${linkName}/moderation/reports/${reportId}/required-milestone`,
    input
  );

export const hideReportedContent = (
  linkName: string,
  reportId: string,
  input: ModerationReportNoteInput
) =>
  apiPost<ModerationReportActionResponse, ModerationReportNoteInput>(
    `/api/clubs/${linkName}/moderation/reports/${reportId}/hide`,
    input
  );

export const deleteReportedContent = (
  linkName: string,
  reportId: string,
  input: ModerationReportNoteInput
) =>
  apiPost<ModerationReportActionResponse, ModerationReportNoteInput>(
    `/api/clubs/${linkName}/moderation/reports/${reportId}/delete`,
    input
  );

export const warnReportedContentAuthor = (
  linkName: string,
  reportId: string,
  input: ModerationReportNoteInput
) =>
  apiPost<ModerationReportActionResponse, ModerationReportNoteInput>(
    `/api/clubs/${linkName}/moderation/reports/${reportId}/warn`,
    input
  );

export const banReportedContentAuthor = (
  linkName: string,
  reportId: string,
  input: BanReportedContentAuthorInput
) =>
  apiPost<ModerationReportActionResponse, BanReportedContentAuthorInput>(
    `/api/clubs/${linkName}/moderation/reports/${reportId}/ban`,
    input
  );

export const resolveModerationReport = (
  linkName: string,
  reportId: string,
  input: ResolveModerationReportInput
) =>
  apiPatch<ModerationReportActionResponse, ResolveModerationReportInput>(
    `/api/clubs/${linkName}/moderation/reports/${reportId}/resolve`,
    input
  );

export const createClubMilestone = (
  linkName: string,
  input: CreateClubMilestoneInput
) =>
  apiPost<CreateClubMilestoneResponse, CreateClubMilestoneInput>(
    `/api/clubs/${linkName}/milestones`,
    input
  );

export const updateClubMilestone = (
  linkName: string,
  milestoneId: string,
  input: UpdateClubMilestoneInput
) =>
  apiPatch<UpdateClubMilestoneResponse, UpdateClubMilestoneInput>(
    `/api/clubs/${linkName}/milestones/${milestoneId}`,
    input
  );

export const moveClubMilestone = (
  linkName: string,
  input: MoveClubMilestoneInput
) =>
  apiPost<
    MoveClubMilestoneResponse,
    { direction: MoveClubMilestoneInput["direction"] }
  >(`/api/clubs/${linkName}/milestones/${input.milestoneId}/move`, {
    direction: input.direction
  });

export const createClubMilestoneTemplate = (
  linkName: string,
  input: CreateClubMilestoneTemplateInput
) =>
  apiPost<
    CreateClubMilestoneTemplateResponse,
    CreateClubMilestoneTemplateInput
  >(`/api/clubs/${linkName}/milestones/templates`, input);

export const joinClub = (linkName: string) =>
  apiPost<ClubResponse>(`/api/clubs/${linkName}/join`);

export const leaveClub = (linkName: string) =>
  apiPost<LeaveClubResponse>(`/api/clubs/${linkName}/leave`);

export const updateClubProgress = (
  linkName: string,
  input: UpdateClubProgressInput
) =>
  apiPatch<ClubProgressResponse, UpdateClubProgressInput>(
    `/api/clubs/${linkName}/progress`,
    input,
    {
      headers: {
        "Idempotency-Key": crypto.randomUUID()
      }
    }
  );

export const advanceClubProgressToNextMilestone = (linkName: string) =>
  apiPost<ClubProgressResponse>(
    `/api/clubs/${linkName}/progress/next`,
    undefined,
    {
      headers: {
        "Idempotency-Key": crypto.randomUUID()
      }
    }
  );
