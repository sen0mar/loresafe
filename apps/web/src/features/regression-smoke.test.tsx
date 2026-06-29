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
import { ClubDetailPage } from "@/features/clubs/pages/club-detail-page";
import { ClubModerationReportsPage } from "@/features/clubs/pages/club-moderation-reports-page";
import { ExplorePage } from "@/features/clubs/pages/explore-page";
import { PostDetailPage } from "@/features/clubs/pages/post-detail-page";
import { HomePage } from "@/features/home/pages/home-page";
import { ProfileSettingsForm } from "@/features/profile/components/profile-settings-form";
import { ProfileSettingsPage } from "@/features/profile/pages/profile-settings-page";
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
  Comment,
  ModerationReport,
  RevealedModerationReport
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
    await user.type(screen.getByLabelText("Username"), "New_Reader");
    const signupPasswordInput = screen.getByLabelText("Password");

    await user.type(signupPasswordInput, "supersecret12");
    expect(signupPasswordInput).toHaveAttribute("type", "password");

    await user.click(screen.getAllByRole("button", { name: "Show password" })[0]);
    expect(signupPasswordInput).toHaveAttribute("type", "text");

    await user.type(screen.getByLabelText("Confirm password"), "supersecret12");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(signupPathChanges.at(-1)).toBe("/app/explore"));
    expect(signupFetch).toHaveBeenCalledWith(
      "/api/auth/signup",
      expect.objectContaining({
        credentials: "include",
        method: "POST"
      })
    );
    expect(getJsonRequestBody(signupFetch.mock.calls[0])).toEqual({
      email: "new@example.com",
      username: "new_reader",
      password: "supersecret12"
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
    const loginPasswordInput = screen.getByLabelText("Password");

    await user.type(loginPasswordInput, "supersecret12");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(loginPasswordInput).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: /^log in/i }));

    await waitFor(() =>
      expect(loginPathChanges.at(-1)).toBe("/app/clubs/safe-club")
    );
    expect(loginFetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        credentials: "include",
        method: "POST"
      })
    );
  });

  it("blocks signup when password confirmation does not match", async () => {
    const signupFetch = mockFetchRoutes([]);
    renderWithProviders(<SignupForm />, {
      initialEntries: ["/signup"]
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Username"), "new_reader");
    await user.type(screen.getByLabelText("Password"), "supersecret12");
    await user.type(screen.getByLabelText("Confirm password"), "supersecret13");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Passwords do not match.")).toBeVisible();
    expect(signupFetch).not.toHaveBeenCalled();
  });

  it("submits profile settings without changing the locked username", async () => {
    const fetchMock = mockFetchRoutes([
      {
        method: "PATCH",
        path: "/api/users/me",
        response: {
          user: {
            ...authUser,
            displayName: "Updated Reader",
            bio: "No spoilers."
          }
        }
      }
    ]);
    renderWithProviders(<ProfileSettingsForm currentUser={authUser} />);
    const user = userEvent.setup();
    const usernameInput = screen.getByLabelText("Username");
    const displayNameInput = screen.getByLabelText("Display name");
    const bioInput = screen.getByLabelText("Bio");

    expect(usernameInput).toHaveValue("reader");
    expect(usernameInput).toHaveAttribute("readonly");
    expect(screen.getByText("Locked after signup.")).toBeVisible();

    await user.clear(displayNameInput);
    await user.type(displayNameInput, "Updated Reader");
    await user.clear(bioInput);
    await user.type(bioInput, "No spoilers.");
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(getJsonRequestBody(fetchMock.mock.calls[0])).toEqual({
      displayName: "Updated Reader",
      bio: "No spoilers."
    });
  });

  it("links settings directly to report queues for moderated clubs", async () => {
    mockFetchRoutes([
      shellRoute("/api/auth/me", { user: authUser }),
      shellRoute("/api/users/me/clubs", moderatedJoinedClubsResponse),
      shellRoute("/api/notifications", notificationsResponse)
    ]);

    renderWithProviders(<ProfileSettingsPage />, {
      initialEntries: ["/app/settings/profile"]
    });

    const reportLinks = await screen.findAllByRole("link", {
      name: /open reports/i
    });
    const settingsMain = within(screen.getByRole("main"));

    expect(settingsMain.getByText("Safe Club")).toBeVisible();
    expect(settingsMain.getByText("Mod Club")).toBeVisible();
    expect(settingsMain.queryByText("Member Club")).not.toBeInTheDocument();
    expect(settingsMain.queryByLabelText("Club")).not.toBeInTheDocument();
    expect(reportLinks[0]).toHaveAttribute(
      "href",
      "/app/clubs/safe-club/settings/moderation"
    );
  });

  it("shows an empty moderation settings state without moderated clubs", async () => {
    mockFetchRoutes([
      shellRoute("/api/auth/me", { user: authUser }),
      shellRoute("/api/users/me/clubs", joinedClubsResponse),
      shellRoute("/api/notifications", notificationsResponse)
    ]);

    renderWithProviders(<ProfileSettingsPage />, {
      initialEntries: ["/app/settings/profile"]
    });

    expect(await screen.findByText("No moderation clubs yet")).toBeVisible();
    expect(screen.queryByLabelText("Club")).not.toBeInTheDocument();
  });

  it("shows a clear banned state on club detail load", async () => {
    mockFetchRoutes([
      shellRoute("/api/auth/me", { user: authUser }),
      shellRoute("/api/users/me/clubs", joinedClubsResponse),
      shellRoute("/api/notifications", notificationsResponse),
      {
        path: "/api/clubs/safe-club",
        status: 403,
        response: {
          error: {
            code: "BANNED",
            message: "You are banned from this club."
          }
        }
      }
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/app/clubs/:linkName" element={<ClubDetailPage />} />
      </Routes>,
      {
        initialEntries: ["/app/clubs/safe-club"]
      }
    );

    expect(await screen.findByText("You're banned from this club")).toBeVisible();
    expect(screen.getByText("You are banned from this club.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
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
            linkName: "nebula-readers"
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
    await user.type(screen.getByLabelText("Link name"), "nebula-readers");
    await user.type(screen.getByLabelText("Description"), "Spoiler-safe space.");
    await user.type(screen.getByLabelText("Category"), "Books");
    await user.click(screen.getByRole("radio", { name: /private/i }));
    await user.click(screen.getByRole("button", { name: /create club/i }));

    await waitFor(() =>
      expect(pathChanges.at(-1)).toBe("/app/clubs/nebula-readers")
    );
    expect(getJsonRequestBody(fetchMock.mock.calls[0])).toMatchObject({
      title: "Nebula Readers",
      linkName: "nebula-readers",
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
        <ClubProgressPanel linkName="safe-club" clubTitle="Safe Club" />
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

  it("rewinds Finished progress and refetches open spoiler content as locked", async () => {
    let hasRewound = false;
    const postDetailPath = `/api/posts/${postId}`;
    const commentsPath = `/api/posts/${postId}/comments`;
    const rewoundLockedPost: ClubPostCard = {
      ...lockedPost,
      id: postId
    };
    const rewoundLockedComment: Comment = {
      ...lockedComment,
      id: commentId
    };
    const fetchMock = mockFetchRoutes([
      shellRoute("/api/auth/me", { user: authUser }),
      shellRoute("/api/users/me/clubs", joinedClubsResponse),
      shellRoute("/api/notifications", notificationsResponse),
      shellRoute("/api/clubs/safe-club/progress", {
        progress: {
          ...progress,
          mode: "FINISHED",
          currentMilestone: milestoneTwo,
          completedMilestones: 2,
          percentage: 100
        }
      }),
      shellRoute("/api/clubs/safe-club/milestones", milestonesResponse),
      shellRoute(postDetailPath, () => ({
        post: hasRewound ? rewoundLockedPost : visiblePost,
        club: {
          id: club.id,
          linkName: club.linkName
        }
      })),
      shellRoute(commentsPath, () => ({
        comments: [hasRewound ? rewoundLockedComment : visibleComment],
        pagination: {
          limit: 20,
          nextCursor: null,
          hasMore: false
        }
      })),
      {
        method: "PATCH",
        path: "/api/clubs/safe-club/progress",
        response: () => {
          hasRewound = true;

          return {
            progress: {
              ...progress,
              mode: "STRICT",
              currentMilestone: milestoneOne,
              completedMilestones: 1,
              percentage: 50,
              updatedAt: now
            }
          };
        }
      }
    ]);
    renderWithProviders(
      <Fragment>
        <Routes>
          <Route path="/app/posts/:postId" element={<PostDetailPage />} />
        </Routes>
        <ClubProgressPanel linkName="safe-club" clubTitle="Safe Club" />
      </Fragment>,
      {
        initialEntries: [`/app/posts/${postId}`]
      }
    );
    const user = userEvent.setup();

    expect(await screen.findByText("Visible post body.")).toBeInTheDocument();
    expect(await screen.findByText("Visible comment body")).toBeInTheDocument();

    const postReadsBeforeRewind = countFetchCalls(
      fetchMock,
      "GET",
      postDetailPath
    );
    const commentReadsBeforeRewind = countFetchCalls(
      fetchMock,
      "GET",
      commentsPath
    );

    await user.click(
      await screen.findByRole("button", { name: /previous milestone/i })
    );

    await waitFor(() =>
      expect(findFetchCall(fetchMock, "PATCH", "/api/clubs/safe-club/progress"))
        .toBeTruthy()
    );
    expect(
      getJsonRequestBody(
        findFetchCall(fetchMock, "PATCH", "/api/clubs/safe-club/progress")!
      )
    ).toEqual({
      currentMilestoneId: firstMilestoneId,
      mode: "STRICT"
    });
    await waitFor(() =>
      expect(countFetchCalls(fetchMock, "GET", postDetailPath)).toBeGreaterThan(
        postReadsBeforeRewind
      )
    );
    await waitFor(() =>
      expect(countFetchCalls(fetchMock, "GET", commentsPath)).toBeGreaterThan(
        commentReadsBeforeRewind
      )
    );
    expect(await screen.findByText("Locked discussion")).toBeInTheDocument();
    expect(await screen.findByText("Locked comment")).toBeInTheDocument();
    expect(screen.queryByText("Visible post body.")).not.toBeInTheDocument();
    expect(screen.queryByText("Visible comment body")).not.toBeInTheDocument();
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

  it("deletes posts from feed cards when permitted", async () => {
    const fetchMock = mockFetchRoutes([
      shellRoute("/api/clubs/safe-club/posts", {
        posts: [visiblePost],
        pagination: {
          limit: 20,
          nextCursor: null,
          hasMore: false
        }
      }),
      {
        method: "POST",
        path: `/api/posts/${postId}/delete`,
        response: {
          post: {
            id: postId,
            deletedAt: now
          }
        }
      }
    ]);
    renderWithProviders(<ClubFeedTab club={club} />);
    const user = userEvent.setup();

    expect(await screen.findByText("Visible post title")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: /^delete$/i
      })
    );

    await waitFor(() =>
      expect(findFetchCall(fetchMock, "POST", `/api/posts/${postId}/delete`))
        .toBeTruthy()
    );
    await waitFor(() =>
      expect(screen.queryByText("Visible post title")).not.toBeInTheDocument()
    );
    expect(await screen.findByText("No posts yet")).toBeInTheDocument();
  });

  it("hides post delete controls when the API denies delete permission", async () => {
    mockFetchRoutes([
      shellRoute("/api/clubs/safe-club/posts", {
        posts: [
          {
            ...visiblePost,
            permissions: {
              canDelete: false
            }
          }
        ],
        pagination: {
          limit: 20,
          nextCursor: null,
          hasMore: false
        }
      })
    ]);
    renderWithProviders(<ClubFeedTab club={club} />);

    expect(await screen.findByText("Visible post title")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
  });

  it("shows spoiler-safe onboarding on an empty homepage without seeded club content", async () => {
    mockFetchRoutes([
      shellRoute("/api/auth/me", { user: authUser }),
      shellRoute("/api/users/me/clubs", emptyJoinedClubsResponse),
      shellRoute("/api/notifications", notificationsResponse)
    ]);

    renderWithProviders(<HomePage />);

    expect(await screen.findByText("Start with a spoiler-safe space")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /create club/i })[0]).toHaveAttribute(
      "href",
      "/app/clubs/new"
    );
    expect(screen.getByText("Anime/Manga")).toBeInTheDocument();
    expect(screen.queryByText("The First Law Book Club")).not.toBeInTheDocument();
    expect(screen.queryByText(/Glokta/i)).not.toBeInTheDocument();
  });

  it("features the most recently joined club on the homepage", async () => {
    mockFetchRoutes([
      shellRoute("/api/auth/me", { user: authUser }),
      shellRoute("/api/users/me/clubs", twoJoinedClubsResponse),
      shellRoute("/api/notifications", notificationsResponse),
      homeDashboardRoute("/api/clubs/newest-club/posts", {
        posts: [visiblePost],
        pagination: {
          limit: 20,
          nextCursor: null,
          hasMore: false
        }
      }),
      homeDashboardRoute("/api/clubs/newest-club/progress/summary", {
        progress: progressSummary
      }),
      homeDashboardRoute("/api/clubs/newest-club/stats", {
        stats: dashboardStats
      }),
      homeDashboardRoute("/api/clubs/newest-club/popular-discussions", {
        discussions: [],
        pagination: {
          limit: 5
        }
      }),
      homeDashboardRoute("/api/clubs/newest-club/recently-unlocked/summary", {
        unlock: emptyUnlockSummary,
        posts: [],
        pagination: {
          limit: 3
        }
      })
    ]);

    renderWithProviders(<HomePage />);

    expect(await screen.findByRole("heading", { name: "Newest Club" })).toBeInTheDocument();
    expect(screen.getByText("Featured from your joined clubs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open club" })).toHaveAttribute(
      "href",
      "/app/clubs/newest-club"
    );
  });

  it("renders homepage safe previews without leaking locked post bodies", async () => {
    mockFetchRoutes([
      shellRoute("/api/auth/me", { user: authUser }),
      shellRoute("/api/users/me/clubs", joinedClubsResponse),
      shellRoute("/api/notifications", notificationsResponse),
      homeDashboardRoute("/api/clubs/safe-club/posts", {
        posts: [visiblePost, lockedPost],
        pagination: {
          limit: 20,
          nextCursor: null,
          hasMore: false
        }
      }),
      homeDashboardRoute("/api/clubs/safe-club/progress/summary", {
        progress: progressSummary
      }),
      homeDashboardRoute("/api/clubs/safe-club/stats", {
        stats: dashboardStats
      }),
      homeDashboardRoute("/api/clubs/safe-club/popular-discussions", {
        discussions: [],
        pagination: {
          limit: 5
        }
      }),
      homeDashboardRoute("/api/clubs/safe-club/recently-unlocked/summary", {
        unlock: emptyUnlockSummary,
        posts: [],
        pagination: {
          limit: 3
        }
      })
    ]);

    renderWithProviders(<HomePage />);

    expect(await screen.findByText("Visible post body.")).toBeInTheDocument();
    expect(screen.getByText("Locked discussion")).toBeInTheDocument();
    expect(screen.queryByText("LOCKED_POST_BODY_SHOULD_NOT_RENDER")).not.toBeInTheDocument();
    expect(screen.queryByText("The First Law Book Club")).not.toBeInTheDocument();
  });

  it("shows a homepage load error without falling back to seeded content", async () => {
    mockFetchRoutes([
      shellRoute("/api/auth/me", { user: authUser }),
      {
        method: "GET",
        path: "/api/users/me/clubs",
        status: 500,
        response: {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not load joined clubs"
          }
        }
      },
      shellRoute("/api/notifications", notificationsResponse)
    ]);

    renderWithProviders(<HomePage />);

    expect(await screen.findByText("Could not load your home dashboard")).toBeInTheDocument();
    expect(screen.queryByText("The First Law Book Club")).not.toBeInTheDocument();
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
          linkName: club.linkName
        }
      }),
      shellRoute(
        "/api/posts/00000000-0000-4000-8000-000000000020/comments",
        ({ searchParams }: { searchParams: URLSearchParams }) => {
          if (searchParams.has("cursor")) {
            return {
              comments: [secondVisibleComment],
              pagination: {
                limit: 20,
                nextCursor: null,
                hasMore: false
              }
            };
          }

          return {
            comments: [visibleComment, lockedComment],
            pagination: {
              limit: 20,
              nextCursor: "next-comments-page",
              hasMore: true
            }
          };
        }
      ),
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

    await user.click(screen.getByRole("button", { name: /load more/i }));

    expect(await screen.findByText("Second visible comment body")).toBeInTheDocument();

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

  it("deletes comments without rendering locked comment bodies", async () => {
    const fetchMock = mockFetchRoutes([
      shellRoute("/api/auth/me", { user: authUser }),
      shellRoute("/api/users/me/clubs", joinedClubsResponse),
      shellRoute("/api/notifications", notificationsResponse),
      shellRoute(`/api/posts/${postId}`, {
        post: {
          ...visiblePost,
          permissions: {
            canDelete: false
          }
        },
        club: {
          id: club.id,
          linkName: club.linkName
        }
      }),
      shellRoute(`/api/posts/${postId}/comments`, {
        comments: [
          visibleComment,
          {
            ...lockedComment,
            permissions: {
              canDelete: false
            }
          }
        ],
        pagination: {
          limit: 20,
          nextCursor: null,
          hasMore: false
        }
      }),
      shellRoute("/api/clubs/safe-club/milestones", milestonesResponse),
      {
        method: "POST",
        path: `/api/comments/${commentId}/delete`,
        response: {
          comment: {
            id: commentId,
            postId,
            deletedAt: now
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

    expect(await screen.findByText("Visible comment body")).toBeInTheDocument();
    expect(await screen.findByText("Locked comment")).toBeInTheDocument();
    expect(screen.queryByText("LOCKED_COMMENT_BODY_SHOULD_NOT_RENDER")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: /^delete$/i
      })
    );

    await waitFor(() =>
      expect(
        findFetchCall(fetchMock, "POST", `/api/comments/${commentId}/delete`)
      ).toBeTruthy()
    );
    await waitFor(() =>
      expect(screen.queryByText("Visible comment body")).not.toBeInTheDocument()
    );
    expect(screen.queryByText("LOCKED_COMMENT_BODY_SHOULD_NOT_RENDER")).not.toBeInTheDocument();
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

  it("collapses moderation report details until a report is opened", async () => {
    mockFetchRoutes([
      shellRoute("/api/auth/me", { user: authUser }),
      shellRoute("/api/users/me/clubs", moderatedJoinedClubsResponse),
      shellRoute("/api/notifications", notificationsResponse),
      shellRoute("/api/clubs/safe-club", {
        club: moderationClub
      }),
      shellRoute("/api/clubs/safe-club/moderation/reports", {
        reports: [moderationReport, commentModerationReport],
        pagination: {
          limit: 20,
          nextCursor: null,
          hasMore: false
        }
      }),
      shellRoute("/api/clubs/safe-club/milestones", milestonesResponse),
      {
        method: "POST",
        path: `/api/clubs/safe-club/moderation/reports/${moderationReport.id}/reveal`,
        response: {
          report: revealedModerationReport
        }
      }
    ]);
    renderWithProviders(
      <Routes>
        <Route
          path="/app/clubs/:linkName/settings/moderation"
          element={<ClubModerationReportsPage />}
        />
      </Routes>,
      {
        initialEntries: ["/app/clubs/safe-club/settings/moderation"]
      }
    );
    const user = userEvent.setup();

    expect(await screen.findByText("POST")).toBeInTheDocument();
    expect(screen.getByText("COMMENT")).toBeInTheDocument();
    expect(screen.getByText("Spam")).toBeInTheDocument();
    expect(screen.queryByText("Reporter")).not.toBeInTheDocument();
    expect(screen.queryByText("Required milestone")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reveal content/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /adjust/i })).not.toBeInTheDocument();
    expect(screen.queryByText("UNSAFE_REPORTED_BODY_SHOULD_NOT_RENDER")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Search reports by type"), "comment");

    expect(screen.queryByText("POST")).not.toBeInTheDocument();
    expect(screen.getByText("COMMENT")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search reports by type"));
    await user.click(screen.getAllByRole("button", { name: /open report/i })[0]);

    expect(await screen.findByText("Reported content is hidden")).toBeVisible();
    expect(screen.getByRole("button", { name: /reveal content/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /adjust/i })).toBeVisible();
    expect(screen.queryByText("UNSAFE_REPORTED_BODY_SHOULD_NOT_RENDER")).not.toBeInTheDocument();
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
            linkName: "public-story-club",
            description: "Public discussion.",
            category: "Books",
            coverUrl: "https://cdn.example/public-story-club.png",
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
    expect(screen.getByAltText("Public Story Club cover")).toHaveAttribute(
      "src",
      "https://cdn.example/public-story-club.png"
    );
    expect(
      screen.getByRole("link", { name: /public story club/i })
    ).toHaveAttribute("href", "/app/clubs/public-story-club");
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
            linkName: "public-nebula-club",
            description: "Visible result.",
            category: "Books",
            coverUrl: "https://cdn.example/public-nebula-club.png",
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
    expect(screen.getByAltText("Public Nebula Club cover")).toHaveAttribute(
      "src",
      "https://cdn.example/public-nebula-club.png"
    );
    expect(screen.queryByText("PRIVATE_SEARCH_CLUB_SHOULD_NOT_RENDER")).not.toBeInTheDocument();
  });
});

const authUser = {
  id: userId,
  email: "reader@example.com",
  displayName: "Reader",
  username: "reader",
  bio: null,
  avatarUrl: null,
  createdAt: now,
  updatedAt: now
};

const club: Club = {
  id: clubId,
  title: "Safe Club",
  linkName: "safe-club",
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

const moderationClub: Club = {
  ...club,
  currentUserRole: "OWNER",
  membership: {
    isMember: true,
    role: "OWNER"
  }
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

const canDeletePermissions = {
  canDelete: true
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
  permissions: canDeletePermissions,
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
  permissions: canDeletePermissions,
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
  permissions: canDeletePermissions,
  createdAt: now,
  updatedAt: now
};

const secondVisibleComment: Comment = {
  ...visibleComment,
  id: "00000000-0000-4000-8000-000000000033",
  body: "Second visible comment body"
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
  permissions: canDeletePermissions,
  lockReason: "Reach milestone 2 to unlock this comment.",
  createdAt: now,
  updatedAt: now
};

const moderationReport: ModerationReport = {
  id: "00000000-0000-4000-8000-000000000041",
  targetType: "POST",
  targetId: postId,
  reason: "SPOILER",
  status: "OPEN",
  reporter: {
    id: userId,
    displayName: "Reader",
    username: "reader"
  },
  detailsHidden: true,
  target: {
    id: postId,
    targetType: "POST",
    visibility: "HIDDEN",
    status: "VISIBLE",
    author: {
      id: "00000000-0000-4000-8000-000000000042",
      displayName: "Post Author",
      username: "author"
    },
    requiredMilestone: {
      id: firstMilestoneId,
      position: 1,
      label: "Opening"
    },
    contentHidden: true
  },
  createdAt: now,
  updatedAt: now
};

const commentModerationReport: ModerationReport = {
  ...moderationReport,
  id: "00000000-0000-4000-8000-000000000043",
  targetType: "COMMENT",
  targetId: commentId,
  reason: "SPAM",
  target: {
    ...moderationReport.target,
    id: commentId,
    targetType: "COMMENT"
  }
};

const revealedModerationReport: RevealedModerationReport = {
  ...moderationReport,
  details: "Reporter details should only appear after reveal.",
  target: {
    ...moderationReport.target,
    visibility: "REVEALED",
    title: "Unsafe reported post",
    body: "UNSAFE_REPORTED_BODY_SHOULD_NOT_RENDER"
  }
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
      linkName: club.linkName,
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

const emptyJoinedClubsResponse = {
  clubs: [],
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pageCount: 0
  }
};

const twoJoinedClubsResponse = {
  clubs: [
    {
      id: "00000000-0000-4000-8000-000000000101",
      title: "Newest Club",
      linkName: "newest-club",
      coverUrl: null,
      visibility: "PRIVATE",
      role: "OWNER",
      memberCount: 8,
      joinedAt: "2026-01-03T12:00:00.000Z"
    },
    {
      id: "00000000-0000-4000-8000-000000000102",
      title: "Older Club",
      linkName: "older-club",
      coverUrl: null,
      visibility: "PUBLIC",
      role: "MEMBER",
      memberCount: 4,
      joinedAt: "2026-01-02T12:00:00.000Z"
    }
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 2,
    pageCount: 1
  }
};

const moderatedJoinedClubsResponse = {
  clubs: [
    {
      id: club.id,
      title: club.title,
      linkName: club.linkName,
      coverUrl: null,
      visibility: club.visibility,
      role: "OWNER",
      memberCount: club.memberCount,
      joinedAt: now
    },
    {
      id: "00000000-0000-4000-8000-000000000103",
      title: "Mod Club",
      linkName: "mod-club",
      coverUrl: null,
      visibility: "PRIVATE",
      role: "MODERATOR",
      memberCount: 5,
      joinedAt: "2026-01-04T12:00:00.000Z"
    },
    {
      id: "00000000-0000-4000-8000-000000000104",
      title: "Member Club",
      linkName: "member-club",
      coverUrl: null,
      visibility: "PUBLIC",
      role: "MEMBER",
      memberCount: 9,
      joinedAt: "2026-01-05T12:00:00.000Z"
    }
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 3,
    pageCount: 1
  }
};

const progressSummary = {
  mode: "STRICT",
  currentMilestone: {
    id: firstMilestoneId,
    position: 1,
    label: "Opening"
  },
  totalMilestones: 2,
  completedMilestones: 1,
  percentage: 50,
  updatedAt: now
};

const dashboardStats = {
  memberCount: 3,
  milestoneCount: 2,
  visiblePostCount: 2,
  visibleCommentCount: 1,
  postReactionCount: 0,
  safePostCount: 1,
  lockedPostCount: 1
};

const emptyUnlockSummary = {
  historyId: null,
  fromPosition: 0,
  toPosition: 0,
  unlockedAt: null
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

const homeDashboardRoute = shellRoute;

const findFetchCall = (
  fetchMock: ReturnType<typeof mockFetchRoutes>,
  method: string,
  path: string
) =>
  fetchMock.mock.calls.find((call) => {
    const url = new URL(String(call[0]), "http://localhost:5173");
    const init = call[1] as RequestInit | undefined;

    return init?.method === method && url.pathname === path;
  });

const countFetchCalls = (
  fetchMock: ReturnType<typeof mockFetchRoutes>,
  method: string,
  path: string
) =>
  fetchMock.mock.calls.filter((call) => {
    const url = new URL(String(call[0]), "http://localhost:5173");
    const init = call[1] as RequestInit | undefined;

    return init?.method === method && url.pathname === path;
  }).length;
