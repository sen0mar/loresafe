import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";

import { RETAINED_INFINITE_QUERY_PAGES } from "@/shared/api/infinite-query";

import type {
  BanClubMemberInput,
  BanReportedContentAuthorInput,
  ClubFeedTab,
  ClubMilestonesResponse,
  ClubMembersQueryInput,
  ClubPostCard,
  ClubPostsResponse,
  CreateClubMilestoneInput,
  CreateClubMilestoneTemplateInput,
  CreateClubPostInput,
  CreatePostCommentInput,
  JoinedClubsQueryInput,
  JoinedClubsQueryOptions,
  ModerationReport,
  ModerationReportNoteInput,
  ModerationReportsResponse,
  MoveClubMilestoneInput,
  PostCommentsResponse,
  PostDetailResponse,
  PublicClubsQueryInput,
  ResolveModerationReportInput,
  ToggleCommentReactionInput,
  TogglePostReactionInput,
  UpdateClubMemberRoleInput,
  UpdateClubMilestoneInput,
  UpdateClubProgressInput,
  UpdateClubSettingsInput,
  UpdateReportRequiredMilestoneInput
} from "./clubs.types.js";
import {
  advanceClubProgressToNextMilestone,
  banClubMember,
  banReportedContentAuthor,
  createClub,
  createClubMilestone,
  createClubMilestoneTemplate,
  createClubPost,
  createPostComment,
  createReport,
  deleteComment,
  deletePost,
  deleteReportedContent,
  getClubBans,
  getClubByLinkName,
  getClubDashboardStats,
  getClubMembers,
  getClubMilestones,
  getClubPosts,
  getClubProgress,
  getClubProgressSummary,
  getJoinedClubs,
  getModerationReports,
  getPopularDiscussions,
  getPostById,
  getPostComments,
  getPublicClubs,
  getRecentlyUnlockedPosts,
  getRecentlyUnlockedSummary,
  hideReportedContent,
  joinClub,
  leaveClub,
  moveClubMilestone,
  resolveModerationReport,
  revealModerationReport,
  revealPost,
  revealPostComment,
  toggleCommentReaction,
  togglePostReaction,
  unbanClubBan,
  updateClubMemberRole,
  updateClubMilestone,
  updateClubProgress,
  updateClubSettings,
  updateReportRequiredMilestone,
  warnReportedContentAuthor
} from "./clubs.requests.js";
import {
  removeCommentFromInfiniteData,
  removePostFromPostListQueries,
  toggleCommentReactionOnComment,
  togglePostReactionOnCard,
  updateCommentInInfiniteData,
  updatePostInInfiniteData
} from "./clubs.optimistic.js";
import { clubsQueryKeys } from "./clubs.query-keys.js";

export const refreshClubAssetQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  linkName: string
) => {
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.detail(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.discoveryRoot
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.joined
  });
};

export const refreshClubMemberManagementQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  linkName: string
) => {
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.detail(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.membersRoot(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.bansRoot(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.joined
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.feedRoot(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.dashboardRoot(linkName)
  });
  void queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) && query.queryKey.includes("comments")
  });
};

export const refreshClubSettingsQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  linkName: string
) => {
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.detail(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.discoveryRoot
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.joined
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.dashboardRoot(linkName)
  });
  void queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) && query.queryKey.includes("search")
  });
};

const reconcileModerationReportMutation = (
  queryClient: ReturnType<typeof useQueryClient>,
  linkName: string,
  report: ModerationReport
) => {
  queryClient.setQueryData<InfiniteData<ModerationReportsResponse>>(
    clubsQueryKeys.moderationReports(linkName),
    (currentResponse) => {
      if (!currentResponse) {
        return currentResponse;
      }

      return {
        ...currentResponse,
        pages: currentResponse.pages.map((page) => ({
          ...page,
          reports:
            report.status === "OPEN"
              ? page.reports.map((currentReport) =>
                  currentReport.id === report.id ? report : currentReport
                )
              : page.reports.filter(
                  (currentReport) => currentReport.id !== report.id
                )
        }))
      };
    }
  );
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.feedRoot(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.moderationReports(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.postDetail(report.target.id)
  });
  void queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) && query.queryKey.includes("comments")
  });
};
export const useCreateClubMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createClub,
    onSuccess: (response) => {
      queryClient.setQueryData(
        clubsQueryKeys.detail(response.club.linkName),
        response
      );
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.discoveryRoot
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.joined
      });
    }
  });
};

export const useCreateClubMilestoneMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClubMilestoneInput) =>
      createClubMilestone(linkName, input),
    onSuccess: (response) => {
      queryClient.setQueriesData<ClubMilestonesResponse>(
        {
          queryKey: clubsQueryKeys.milestonesRoot(linkName)
        },
        (currentResponse) => {
          if (!currentResponse) {
            return currentResponse;
          }

          return {
            ...currentResponse,
            milestones: currentResponse.milestones.map((milestone) =>
              milestone.id === response.milestone.id
                ? response.milestone
                : milestone
            )
          };
        }
      );
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.milestonesRoot(linkName)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(linkName)
      });
    }
  });
};

export const useCreateClubPostMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClubPostInput) => createClubPost(linkName, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.feedRoot(linkName)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(linkName)
      });
    }
  });
};

export const useCreatePostCommentMutation = (postId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePostCommentInput) =>
      createPostComment(postId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.postComments(postId)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.postDetail(postId)
      });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes("feed")
      });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes("dashboard")
      });
    }
  });
};

export const useCreateReportMutation = () =>
  useMutation({
    mutationFn: createReport
  });

export const useUpdateClubSettingsMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateClubSettingsInput) =>
      updateClubSettings(linkName, input),
    onSuccess: (response) => {
      queryClient.setQueryData(clubsQueryKeys.detail(linkName), response);
      refreshClubSettingsQueries(queryClient, linkName);
    }
  });
};

export const useUpdateClubMemberRoleMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      membershipId,
      input
    }: {
      membershipId: string;
      input: UpdateClubMemberRoleInput;
    }) => updateClubMemberRole(linkName, membershipId, input),
    onSuccess: () => {
      refreshClubMemberManagementQueries(queryClient, linkName);
    }
  });
};

export const useBanClubMemberMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      membershipId,
      input = {}
    }: {
      membershipId: string;
      input?: BanClubMemberInput;
    }) => banClubMember(linkName, membershipId, input),
    onSuccess: () => {
      refreshClubMemberManagementQueries(queryClient, linkName);
    }
  });
};

export const useUnbanClubBanMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (banId: string) => unbanClubBan(linkName, banId),
    onSuccess: () => {
      refreshClubMemberManagementQueries(queryClient, linkName);
    }
  });
};

export const useModerationReportsQuery = (linkName: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: clubsQueryKeys.moderationReports(linkName),
    queryFn: ({ pageParam, signal }) =>
      getModerationReports(linkName, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    maxPages: RETAINED_INFINITE_QUERY_PAGES,
    enabled: enabled && linkName.length > 0
  });

export const useRevealModerationReportMutation = (linkName: string) =>
  useMutation({
    mutationFn: (reportId: string) => revealModerationReport(linkName, reportId)
  });

export const useUpdateReportRequiredMilestoneMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: UpdateReportRequiredMilestoneInput;
    }) => updateReportRequiredMilestone(linkName, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, linkName, response.report);
    }
  });
};

export const useHideReportedContentMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: ModerationReportNoteInput;
    }) => hideReportedContent(linkName, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, linkName, response.report);
    }
  });
};

export const useDeleteReportedContentMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: ModerationReportNoteInput;
    }) => deleteReportedContent(linkName, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, linkName, response.report);
    }
  });
};

export const useWarnReportedContentAuthorMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: ModerationReportNoteInput;
    }) => warnReportedContentAuthor(linkName, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, linkName, response.report);
      void queryClient.invalidateQueries({
        queryKey: ["notifications"]
      });
    }
  });
};

export const useBanReportedContentAuthorMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: BanReportedContentAuthorInput;
    }) => banReportedContentAuthor(linkName, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, linkName, response.report);
      refreshClubMemberManagementQueries(queryClient, linkName);
    }
  });
};

export const useResolveModerationReportMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: ResolveModerationReportInput;
    }) => resolveModerationReport(linkName, reportId, input),
    onSuccess: (response) => {
      reconcileModerationReportMutation(queryClient, linkName, response.report);
    }
  });
};

export const useRevealPostMutation = (postId: string) =>
  useMutation({
    mutationFn: () => revealPost(postId)
  });

export const useDeletePostMutation = (postId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      removePostFromPostListQueries(queryClient, postId);
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.postsRoot
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.postDetail(postId)
      });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes("dashboard")
      });
    }
  });
};

export const useTogglePostReactionMutation = (
  postId: string,
  options: {
    onOptimisticPost?: (post: ClubPostCard) => void;
    onReconciledPost?: (post: ClubPostCard) => void;
    onRollbackPost?: (post: ClubPostCard | null) => void;
  } = {}
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TogglePostReactionInput) =>
      togglePostReaction(postId, input),
    onMutate: (input) => {
      const previousPostDetail =
        queryClient.getQueryData<PostDetailResponse>(
          clubsQueryKeys.postDetail(postId)
        ) ?? null;
      const previousFeeds = queryClient
        .getQueriesData<InfiniteData<ClubPostsResponse>>({
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey.includes("feed")
        })
        .map(([queryKey, value]) => [queryKey, value] as const);
      const optimisticPost = previousPostDetail
        ? togglePostReactionOnCard(
            previousPostDetail.post,
            input.emoji,
            input.active
          )
        : null;

      if (previousPostDetail && optimisticPost) {
        queryClient.setQueryData<PostDetailResponse>(
          clubsQueryKeys.postDetail(postId),
          {
            ...previousPostDetail,
            post: optimisticPost
          }
        );
        options.onOptimisticPost?.(optimisticPost);
      }

      queryClient.setQueriesData<InfiniteData<ClubPostsResponse>>(
        {
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey.includes("feed")
        },
        (currentData) =>
          updatePostInInfiniteData(currentData, (post) =>
            post.id === postId
              ? togglePostReactionOnCard(post, input.emoji, input.active)
              : post
          )
      );

      void queryClient.cancelQueries(
        {
          queryKey: clubsQueryKeys.postDetail(postId)
        },
        {
          revert: false
        }
      );
      void queryClient.cancelQueries(
        {
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey.includes("feed")
        },
        {
          revert: false
        }
      );

      return {
        previousPostDetail,
        previousFeeds
      };
    },
    onError: (_error, _input, context) => {
      if (context?.previousPostDetail) {
        queryClient.setQueryData(
          clubsQueryKeys.postDetail(postId),
          context.previousPostDetail
        );
        options.onRollbackPost?.(context.previousPostDetail.post);
      } else {
        options.onRollbackPost?.(null);
      }

      for (const [queryKey, value] of context?.previousFeeds ?? []) {
        queryClient.setQueryData(queryKey, value);
      }
    },
    onSuccess: (response) => {
      queryClient.setQueryData<PostDetailResponse>(
        clubsQueryKeys.postDetail(postId),
        (currentResponse) =>
          currentResponse
            ? {
                ...currentResponse,
                post: response.post
              }
            : currentResponse
      );
      queryClient.setQueriesData<InfiniteData<ClubPostsResponse>>(
        {
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey.includes("feed")
        },
        (currentData) =>
          updatePostInInfiniteData(currentData, (post) =>
            post.id === postId ? response.post : post
          )
      );
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes("dashboard")
      });
      options.onReconciledPost?.(response.post);
    }
  });
};

export const useToggleCommentReactionMutation = (
  postId: string,
  commentId: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ToggleCommentReactionInput) =>
      toggleCommentReaction(commentId, input),
    onMutate: (input) => {
      const previousComments =
        queryClient.getQueryData<InfiniteData<PostCommentsResponse>>(
          clubsQueryKeys.postComments(postId)
        ) ?? null;

      queryClient.setQueryData<InfiniteData<PostCommentsResponse>>(
        clubsQueryKeys.postComments(postId),
        (currentData) =>
          updateCommentInInfiniteData(currentData, (comment) =>
            comment.id === commentId
              ? toggleCommentReactionOnComment(
                  comment,
                  input.emoji,
                  input.active
                )
              : comment
          )
      );

      void queryClient.cancelQueries(
        {
          queryKey: clubsQueryKeys.postComments(postId)
        },
        {
          revert: false
        }
      );

      return {
        previousComments
      };
    },
    onError: (_error, _input, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(
          clubsQueryKeys.postComments(postId),
          context.previousComments
        );
      }
    },
    onSuccess: (response) => {
      queryClient.setQueryData<InfiniteData<PostCommentsResponse>>(
        clubsQueryKeys.postComments(postId),
        (currentData) =>
          updateCommentInInfiniteData(currentData, (comment) =>
            comment.id === response.comment.id ? response.comment : comment
          )
      );
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes("dashboard")
      });
    }
  });
};

export const useDeleteCommentMutation = (postId: string, commentId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteComment(commentId),
    onSuccess: () => {
      queryClient.setQueryData<InfiniteData<PostCommentsResponse>>(
        clubsQueryKeys.postComments(postId),
        (currentData) => removeCommentFromInfiniteData(currentData, commentId)
      );
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.postDetail(postId)
      });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          (query.queryKey.includes("feed") ||
            query.queryKey.includes("dashboard"))
      });
    }
  });
};

export const useRevealPostCommentMutation = (postId: string) =>
  useMutation({
    mutationFn: (commentId: string) => revealPostComment(postId, commentId)
  });

export const useCreateClubMilestoneTemplateMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClubMilestoneTemplateInput) =>
      createClubMilestoneTemplate(linkName, input),
    onSuccess: (response) => {
      queryClient.setQueriesData<ClubMilestonesResponse>(
        {
          queryKey: clubsQueryKeys.milestonesRoot(linkName)
        },
        (currentResponse) => {
          if (!currentResponse) {
            return currentResponse;
          }

          const { page, limit } = currentResponse.pagination;
          const start = (page - 1) * limit;

          return {
            milestones: response.milestones.slice(start, start + limit),
            pagination: {
              ...currentResponse.pagination,
              total: response.milestones.length,
              pageCount: Math.ceil(response.milestones.length / limit)
            }
          };
        }
      );
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.milestonesRoot(linkName)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(linkName)
      });
    }
  });
};

export const useUpdateClubMilestoneMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      milestoneId,
      input
    }: {
      milestoneId: string;
      input: UpdateClubMilestoneInput;
    }) => updateClubMilestone(linkName, milestoneId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.milestonesRoot(linkName)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(linkName)
      });
    }
  });
};

export const useMoveClubMilestoneMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MoveClubMilestoneInput) =>
      moveClubMilestone(linkName, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.milestonesRoot(linkName)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(linkName)
      });
    }
  });
};

export const useUpdateClubProgressMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateClubProgressInput) =>
      updateClubProgress(linkName, input),
    onSuccess: (response) => {
      queryClient.setQueryData(clubsQueryKeys.progress(linkName), response);
      invalidateClubProgressDependencies(queryClient, linkName);
    }
  });
};

export const useAdvanceClubProgressMutation = (linkName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => advanceClubProgressToNextMilestone(linkName),
    onSuccess: (response) => {
      queryClient.setQueryData(clubsQueryKeys.progress(linkName), response);
      invalidateClubProgressDependencies(queryClient, linkName);
    }
  });
};

export const invalidateClubProgressDependencies = (
  queryClient: ReturnType<typeof useQueryClient>,
  linkName: string
) => {
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.progress(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.detail(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.milestonesRoot(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.joined
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.feedRoot(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.recentlyUnlocked(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.dashboardRoot(linkName)
  });
  void queryClient.invalidateQueries({
    queryKey: clubsQueryKeys.postsRoot
  });
};

export const useJoinClubMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: joinClub,
    onSuccess: (response) => {
      queryClient.setQueryData(
        clubsQueryKeys.detail(response.club.linkName),
        response
      );
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.discoveryRoot
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.joined
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(response.club.linkName)
      });
    }
  });
};

export const useLeaveClubMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leaveClub,
    onSuccess: (response) => {
      queryClient.removeQueries({
        queryKey: clubsQueryKeys.detail(response.club.linkName)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.discoveryRoot
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.joined
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.dashboardRoot(response.club.linkName)
      });
      void queryClient.invalidateQueries({
        queryKey: clubsQueryKeys.feedRoot(response.club.linkName)
      });
    }
  });
};
