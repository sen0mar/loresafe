import { Fragment } from "react";
import userEvent from "@testing-library/user-event";
import { screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";

import { LoginForm } from "@/features/auth/components/login-form";
import { SignupForm } from "@/features/auth/components/signup-form";
import { ClubFeedTab } from "@/features/clubs/components/club-feed-tab";
import { ClubProgressPanel } from "@/features/clubs/components/club-progress-panel";
import { CreateClubForm } from "@/features/clubs/components/create-club-form";
import { ReportDialog } from "@/features/clubs/components/report-dialog";
import { ExplorePage } from "@/features/clubs/pages/explore-page";
import { PostDetailPage } from "@/features/clubs/pages/post-detail-page";
import { SearchResultsPage } from "@/features/search/pages/search-results-page";
import {
  getJsonRequestBody,
  mockFetchRoutes,
  renderWithProviders
} from "@/test/render";

import type {
  Club,
  ClubPostCard,
  ClubProgress,
  ClubMilestone,
  Comment
} from "./clubs/api/clubs";

const now = "2026-01-01T12:00:00.000Z";
const userId = "00000000-0000-4000-8000-000000000001";
const clubId = "00000000-0000-4000-8000-000000000010";
const firstMilestoneId = "00000000-0000-4000-8000-000000000011";
const secondMilestoneId = "00000000-0000-4000-8000-000000000012";
const postId = "00000000-0000-4000-8000-000000000020";
const commentId = "00000000-0000-4000-8000-000000000030";

describe("frontend regression smoke", () => {
  it("submits signup and login through credentialed API requests", async () => {
    const signupFetch = mockFetchRoutes([
      {
        method: "POST",
        path: "/api/auth/signup",
        response: {
          user: authUser
        }
      }
    ]);
    const signupPathChanges: string[] = [];
    const signupRender = renderWithProviders(<SignupForm />, {
      initialEntries: ["/signup?redirectTo=/app/explore"],
      routeObserver: (path) => signupPathChanges.push(path)
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Display name"), "New Reader");
    await user.type(screen.getByLabelText("Password"), "supersecret12");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(signupPathChanges.at(-1)).toBe("/app/explore"));
    expect(signupFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/signup",
      expect.objectContaining({
        credentials: "include",
        method: "POST"
      })
    );
    expect(getJsonRequestBody(signupFetch.mock.calls[0])).toMatchObject({
      email: "new@example.com",
      displayName: "New Reader"
    });
    signupRender.unmount();

    const loginFetch = mockFetchRoutes([
      {
        method: "POST",
        path: "/api/auth/login",
        response: {
          user: authUser
        }
      }
    ]);
    const loginPathChanges: string[] = [];
    renderWithProviders(<LoginForm />, {
      initialEntries: ["/login?redirectTo=/app/clubs/safe-club"],
      routeObserver: (path) => loginPathChanges.push(path)
    });

    await user.type(screen.getByLabelText("Email"), "reader@example.com");
    await user.type(screen.getByLabelText("Password"), "supersecret12");
    await user.click(screen.getByRole("button", { name: /^log in/i }));

    await waitFor(() =>
      expect(loginPathChanges.at(-1)).toBe("/app/clubs/safe-club")
    );
    expect(loginFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/login",
      expect.objectContaining({
        credentials: "include",
        method: "POST"
      })
    );
  });

  it("submits club creation and navigates to the new club", async () => {
    const fetchMock = mockFetchRoutes([
      {
        method: "POST",
        path: "/api/clubs",
        response: {
          club: {
            ...club,
            title: "Nebula Readers",
            slug: "nebula-readers"
          }
        }
      }
    ]);
    const pathChanges: string[] = [];
    renderWithProviders(<CreateClubForm />, {
      initialEntries: ["/app/clubs/new"],
      routeObserver: (path) => pathChanges.push(path)
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Title"), "Nebula Readers");
    await user.type(screen.getByLabelText("Slug"), "nebula-readers");
    await user.type(screen.getByLabelText("Description"), "Spoiler-safe space.");
    await user.type(screen.getByLabelText("Category"), "Books");
    await user.click(screen.getByRole("radio", { name: /private/i }));
    await user.click(screen.getByRole("button", { name: /create club/i }));

    await waitFor(() =>
      expect(pathChanges.at(-1)).toBe("/app/clubs/nebula-readers")
    );
    expect(getJsonRequestBody(fetchMock.mock.calls[0])).toMatchObject({
      title: "Nebula Readers",
      slug: "nebula-readers",
      visibility: "PRIVATE"
    });
  });

  it("updates progress while locked feed cards omit unsafe body text", async () => {
    const fetchMock = mockFetchRoutes([
      shellRoute("/api/auth/me", { user: authUser }),
      shellRoute("/api/users/me/clubs", joinedClubsResponse),
      shellRoute("/api/notifications", notificationsResponse),
      shellRoute("/api/clubs/safe-club/progress", {
        progress
      }),
      shellRoute("/api/clubs/safe-club/milestones", milestonesResponse),
      shellRoute("/api/clubs/safe-club/posts", {
        posts: [lockedPost],
        pagination: {
          limit: 20,
          nextCursor: null,
          hasMore: false
        }
      }),
      {
        method: "PATCH",
        path: "/api/clubs/safe-club/progress",
        response: {
          progress: {
            ...progress,
            currentMilestone: milestoneTwo,
            completedMilestones: 2,
            percentage: 100,
            updatedAt: now
          }
        }
      }
    ]);
    renderWithProviders(
      <Fragment>
        <ClubProgressPanel slug="safe-club" clubTitle="Safe Club" />
        <ClubFeedTab club={club} />
      </Fragment>
    );
    const user = userEvent.setup();

    expect(await screen.findByText("Locked discussion")).toBeInTheDocument();
    expect(screen.queryByText("LOCKED_POST_BODY_SHOULD_NOT_RENDER")).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Current milestone"),
      secondMilestoneId
    );
    await user.click(screen.getByRole("button", { name: /save progress/i }));

    await waitFor(() =>
      expect(findFetchCall(fetchMock, "PATCH", "/api/clubs/safe-club/progress"))
        .toBeTruthy()
    );
    expect(
      getJsonRequestBody(
        findFetchCall(fetchMock, "PATCH", "/api/clubs/safe-club/progress")!
      )
    ).toEqual({
      currentMilestoneId: secondMilestoneId,
      mode: "STRICT"
    });
  });

  it("creates posts from the feed dialog", async () => {
    const fetchMock = mockFetchRoutes([
      shellRoute("/api/clubs/safe-club/posts", {
        posts: [],
        pagination: {
          limit: 20,
          nextCursor: null,
          hasMore: false
        }
      }),
      shellRoute("/api/clubs/safe-club/milestones", milestonesResponse),
      {
        method: "POST",
        path: "/api/clubs/safe-club/posts",
        response: {
          post: visiblePost
        }
      }
    ]);
    renderWithProviders(<ClubFeedTab club={club} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /new post/i }));
    await user.type(screen.getByLabelText("Title"), "Opening theory");
    await user.type(screen.getByLabelText("Body"), "This is safe to discuss.");
    await user.click(screen.getByRole("button", { name: /create post/i }));

    await waitFor(() =>
      expect(findFetchCall(fetchMock, "POST", "/api/clubs/safe-club/posts"))
        .toBeTruthy()
    );
    expect(
      getJsonRequestBody(
        findFetchCall(fetchMock, "POST", "/api/clubs/safe-club/posts")!
      )
    ).toMatchObject({
      title: "Opening theory",
      body: "This is safe to discuss.",
      requiredMilestoneId: firstMilestoneId
    });
  });

  it("creates comments while locked comment bodies remain absent", async () => {
    const fetchMock = mockFetchRoutes([
      shellRoute("/api/auth/me", { user: authUser }),
      shellRoute("/api/users/me/clubs", joinedClubsResponse),
      shellRoute("/api/notifications", notificationsResponse),
      shellRoute("/api/posts/00000000-0000-4000-8000-000000000020", {
        post: visiblePost,
        club: {
          id: club.id,
          slug: club.slug
        }
      }),
      shellRoute("/api/posts/00000000-0000-4000-8000-000000000020/comments", {
        comments: [visibleComment, lockedComment]
      }),
      shellRoute("/api/clubs/safe-club/milestones", milestonesResponse),
      {
        method: "POST",
        path: "/api/posts/00000000-0000-4000-8000-000000000020/comments",
        response: {
          comment: {
            ...visibleComment,
            id: "00000000-0000-4000-8000-000000000032",
            body: "New comment body"
          }
        }
      }
    ]);
    renderWithProviders(
      <Routes>
        <Route path="/app/posts/:postId" element={<PostDetailPage />} />
      </Routes>,
      {
      initialEntries: [`/app/posts/${postId}`]
      }
    );
    const user = userEvent.setup();

    expect(await screen.findByText("Visible post title")).toBeInTheDocument();
    expect(await screen.findByText("Visible comment body")).toBeInTheDocument();
    expect(await screen.findByText("Locked comment")).toBeInTheDocument();
    expect(screen.queryByText("LOCKED_COMMENT_BODY_SHOULD_NOT_RENDER")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Add a comment"), "New comment body");
    await user.click(screen.getByRole("button", { name: /post comment/i }));

    await waitFor(() =>
      expect(
        findFetchCall(
          fetchMock,
          "POST",
          "/api/posts/00000000-0000-4000-8000-000000000020/comments"
        )
      ).toBeTruthy()
    );
  });

  it("submits reports without rendering locked target content", async () => {
    const fetchMock = mockFetchRoutes([
      {
        method: "POST",
        path: "/api/reports",
        response: {
          report: {
            id: "00000000-0000-4000-8000-000000000040",
            targetType: "POST",
            targetId: postId,
            reason: "SPOILER",
            details: "Needs a later milestone.",
            status: "OPEN",
            createdAt: now,
            updatedAt: now
          }
        }
      }
    ]);
    renderWithProviders(
      <Fragment>
        <ReportDialog targetId={postId} targetType="POST" />
        <span>Locked discussion</span>
      </Fragment>
    );
    const user = userEvent.setup();

    expect(screen.queryByText("LOCKED_TARGET_BODY_SHOULD_NOT_RENDER")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /report/i }));
    await user.type(
      screen.getByLabelText("Details"),
      "Needs a later milestone."
    );
    await user.click(screen.getByRole("button", { name: /submit report/i }));

    expect(await screen.findByText("Report submitted")).toBeInTheDocument();
    expect(getJsonRequestBody(fetchMock.mock.calls[0])).toMatchObject({
      targetType: "POST",
      targetId: postId,
      reason: "SPOILER",
      details: "Needs a later milestone."
    });
  });

  it("keeps private clubs out of discovery and non-member search results", async () => {
    mockFetchRoutes([
      shellRoute("/api/auth/me", { user: authUser }),
      shellRoute("/api/users/me/clubs", joinedClubsResponse),
      shellRoute("/api/notifications", notificationsResponse),
      shellRoute("/api/clubs", {
        clubs: [
          {
            id: clubId,
            title: "Public Story Club",
            slug: "public-story-club",
            description: "Public discussion.",
            category: "Books",
            coverUrl: null,
            visibility: "PUBLIC",
            memberCount: 12,
            createdAt: now,
            updatedAt: now
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pageCount: 1
        }
      })
    ]);
    const discovery = renderWithProviders(<ExplorePage />, {
      initialEntries: ["/app/explore"]
    });

    expect(await screen.findByText("Public Story Club")).toBeInTheDocument();
    expect(screen.queryByText("PRIVATE_CLUB_SHOULD_NOT_RENDER")).not.toBeInTheDocument();
    discovery.unmount();

    mockFetchRoutes([
      shellRoute("/api/auth/me", { user: authUser }),
      shellRoute("/api/users/me/clubs", joinedClubsResponse),
      shellRoute("/api/notifications", notificationsResponse),
      shellRoute("/api/search", {
        query: "nebula",
        scope: "clubs",
        clubs: [
          {
            id: clubId,
            title: "Public Nebula Club",
            slug: "public-nebula-club",
            description: "Visible result.",
            category: "Books",
            coverUrl: null,
            visibility: "PUBLIC",
            memberCount: 7,
            createdAt: now,
            updatedAt: now
          }
        ],
        posts: [],
        pagination: {
          limit: 10,
          nextCursor: null,
          hasMore: false
        }
      })
    ]);
    renderWithProviders(<SearchResultsPage />, {
      initialEntries: ["/app/search?q=nebula&scope=clubs"]
    });

    expect(await screen.findByText("Public Nebula Club")).toBeInTheDocument();
    expect(screen.queryByText("PRIVATE_SEARCH_CLUB_SHOULD_NOT_RENDER")).not.toBeInTheDocument();
  });
});

const authUser = {
  id: userId,
  email: "reader@example.com",
  displayName: "Reader",
  username: null,
  bio: null,
  avatarUrl: null,
  createdAt: now,
  updatedAt: now
};

const club: Club = {
  id: clubId,
  title: "Safe Club",
  slug: "safe-club",
  description: "Spoiler-safe space.",
  category: "Books",
  coverUrl: null,
  rules: null,
  visibility: "PUBLIC",
  memberCount: 3,
  currentUserRole: "MEMBER",
  membership: {
    isMember: true,
    role: "MEMBER"
  },
  settings: {
    visibility: "PUBLIC",
    rules: null
  },
  createdAt: now,
  updatedAt: now
};

const milestoneOne: ClubMilestone = {
  id: firstMilestoneId,
  position: 1,
  safeTitle: "Opening",
  fullTitle: null,
  description: null,
  spoilerName: false,
  isFullTitleHidden: false
};

const milestoneTwo: ClubMilestone = {
  id: secondMilestoneId,
  position: 2,
  safeTitle: "Twist-safe checkpoint",
  fullTitle: null,
  description: null,
  spoilerName: false,
  isFullTitleHidden: false
};

const progress: ClubProgress = {
  id: "00000000-0000-4000-8000-000000000050",
  mode: "STRICT",
  currentMilestone: milestoneOne,
  totalMilestones: 2,
  completedMilestones: 1,
  percentage: 50,
  updatedAt: now,
  history: []
};

const emptyCounts = {
  commentCount: 0,
  reactionCount: 0,
  unreadCommentCount: 0,
  reactions: [
    { emoji: "👍" as const, count: 0, reactedByMe: false },
    { emoji: "❤️" as const, count: 0, reactedByMe: false },
    { emoji: "😂" as const, count: 0, reactedByMe: false },
    { emoji: "😮" as const, count: 0, reactedByMe: false },
    { emoji: "👀" as const, count: 0, reactedByMe: false }
  ]
};

const visiblePost: ClubPostCard = {
  id: postId,
  visibility: "VISIBLE",
  type: "DISCUSSION",
  status: "VISIBLE",
  title: "Visible post title",
  bodyPreview: "Visible post body.",
  author: {
    id: userId,
    displayName: "Reader",
    username: null
  },
  requiredMilestone: {
    id: firstMilestoneId,
    position: 1,
    label: "Opening"
  },
  counts: {
    ...emptyCounts,
    commentCount: 2
  },
  createdAt: now,
  updatedAt: now
};

const lockedPost: ClubPostCard = {
  id: "00000000-0000-4000-8000-000000000021",
  visibility: "LOCKED",
  type: "DISCUSSION",
  status: "VISIBLE",
  requiredMilestone: {
    id: secondMilestoneId,
    position: 2,
    label: "Twist-safe checkpoint"
  },
  counts: emptyCounts,
  lockReason: "Reach milestone 2 to unlock this discussion.",
  createdAt: now,
  updatedAt: now
};

const visibleComment: Comment = {
  id: commentId,
  visibility: "VISIBLE",
  status: "VISIBLE",
  body: "Visible comment body",
  author: {
    id: userId,
    displayName: "Reader",
    username: null
  },
  parentId: null,
  requiredMilestone: {
    id: firstMilestoneId,
    position: 1,
    label: "Opening"
  },
  counts: emptyCounts,
  createdAt: now,
  updatedAt: now
};

const lockedComment: Comment = {
  id: "00000000-0000-4000-8000-000000000031",
  visibility: "LOCKED",
  status: "VISIBLE",
  parentId: null,
  requiredMilestone: {
    id: secondMilestoneId,
    position: 2,
    label: "Twist-safe checkpoint"
  },
  counts: emptyCounts,
  lockReason: "Reach milestone 2 to unlock this comment.",
  createdAt: now,
  updatedAt: now
};

const milestonesResponse = {
  milestones: [milestoneOne, milestoneTwo],
  pagination: {
    page: 1,
    limit: 100,
    total: 2,
    pageCount: 1
  }
};

const joinedClubsResponse = {
  clubs: [
    {
      id: club.id,
      title: club.title,
      slug: club.slug,
      coverUrl: null,
      visibility: club.visibility,
      role: "MEMBER",
      memberCount: club.memberCount,
      joinedAt: now
    }
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    pageCount: 1
  }
};

const notificationsResponse = {
  notifications: [],
  unreadCount: 0,
  pagination: {
    limit: 1,
    nextCursor: null,
    hasMore: false
  }
};

const shellRoute = (path: string, response: unknown) => ({
  method: "GET",
  path,
  response
});

const findFetchCall = (
  fetchMock: ReturnType<typeof mockFetchRoutes>,
  method: string,
  path: string
) =>
  fetchMock.mock.calls.find((call) => {
    const url = new URL(String(call[0]));
    const init = call[1] as RequestInit | undefined;

    return init?.method === method && url.pathname === path;
  });
