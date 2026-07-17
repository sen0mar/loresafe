import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";

import { ReportDialog } from "@/features/clubs/components/report-dialog";
import { PostReactionButtons } from "@/features/clubs/components/club-feed-cards";
import { ReactionButtonGroup } from "@/features/clubs/components/reaction-button-group";
import { ClubProgressPanel } from "@/features/clubs/components/club-progress-panel";
import {
  clubsQueryKeys,
  useTogglePostReactionMutation
} from "@/features/clubs/api/clubs";
import { Button } from "@/shared/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/shared/components/ui/tabs";
import { mockFetchRoutes, renderWithProviders } from "@/test/render";

import type { PostDetailResponse } from "@/features/clubs/api/clubs";

const now = "2026-01-01T12:00:00.000Z";

describe("frontend accessibility regressions", () => {
  it("keeps report dialogs keyboard-contained and returns focus on Escape", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <div>
        <ReportDialog targetId="post-1" targetType="POST" />
        <Button type="button">After dialog</Button>
      </div>
    );

    const trigger = screen.getByRole("button", { name: /report/i });

    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: /report post/i });
    expect(dialog).toBeInTheDocument();

    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it("supports keyboard tab changes with visible text labels", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <Tabs defaultValue="safe">
        <TabsList>
          <TabsTrigger value="safe">Safe</TabsTrigger>
          <TabsTrigger value="locked">Locked</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value="safe">Safe discussions</TabsContent>
        <TabsContent value="locked">Locked discussions</TabsContent>
        <TabsContent value="all">All discussions</TabsContent>
      </Tabs>
    );

    await user.tab();
    expect(screen.getByRole("tab", { name: "Safe" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Locked" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Locked" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("Locked discussions")).toBeInTheDocument();
  });

  it("keeps the liquid tab indicator decorative", () => {
    const { container } = renderWithProviders(
      <Tabs defaultValue="safe">
        <TabsList>
          <TabsTrigger value="safe">Safe</TabsTrigger>
          <TabsTrigger value="locked">Locked</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    const indicator = container.querySelector(".liquid-selection-indicator");
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");

    expect(indicator).toHaveAttribute("aria-hidden", "true");
    expect(tabs).toHaveLength(2);
  });

  it("keeps wrapped tab lists fixed instead of scrollable", () => {
    renderWithProviders(
      <Tabs defaultValue="overview">
        <TabsList data-testid="responsive-tabs">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="feed">Feed</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    const tabs = screen.getByTestId("responsive-tabs");

    expect(tabs).toHaveClass("flex-wrap");
    expect(tabs).toHaveClass("overflow-hidden");
    expect(tabs).not.toHaveClass("overflow-x-auto");
  });

  it("exposes reactions as a labeled button group with disabled controls", () => {
    renderWithProviders(
      <ReactionButtonGroup
        ariaLabel="Post reactions"
        disabled
        reactions={[
          {
            emoji: "👍",
            count: 2,
            reactedByMe: true
          },
          {
            emoji: "👀",
            count: 0,
            reactedByMe: false
          }
        ]}
        onToggle={() => undefined}
      />
    );

    const group = screen.getByRole("group", { name: "Post reactions" });
    const pressedReaction = within(group).getByRole("button", {
      name: /remove 👍 reaction/i
    });
    const unpressedReaction = within(group).getByRole("button", {
      name: /add 👀 reaction/i
    });

    expect(pressedReaction).toHaveAttribute("aria-pressed", "true");
    expect(pressedReaction).toBeDisabled();
    expect(unpressedReaction).toHaveAttribute("aria-pressed", "false");
    expect(unpressedReaction).toBeDisabled();
  });

  it("keeps visible post reaction controls enabled without duplicate pending toggles", async () => {
    const user = userEvent.setup();
    const pendingFetch = vi.fn(() => new Promise<Response>(() => undefined));

    vi.stubGlobal("fetch", pendingFetch);

    renderWithProviders(
      <PostReactionButtons
        postId="post-1"
        counts={{
          commentCount: 0,
          reactionCount: 2,
          unreadCommentCount: 0,
          reactions: [
            {
              emoji: "👍",
              count: 2,
              reactedByMe: false
            },
            {
              emoji: "❤️",
              count: 0,
              reactedByMe: false
            },
            {
              emoji: "😂",
              count: 0,
              reactedByMe: false
            },
            {
              emoji: "😮",
              count: 0,
              reactedByMe: false
            },
            {
              emoji: "👀",
              count: 0,
              reactedByMe: false
            }
          ]
        }}
      />
    );

    const reaction = screen.getByRole("button", { name: /add 👍 reaction/i });

    await user.click(reaction);
    await user.click(reaction);

    expect(pendingFetch).toHaveBeenCalledWith(
      `/api/posts/post-1/reactions/${encodeURIComponent("👍")}`,
      expect.objectContaining({
        credentials: "include",
        method: "PUT"
      })
    );
    expect(pendingFetch).toHaveBeenCalledTimes(1);
    expect(reaction).toBeEnabled();
  });

  it("animates the clicked reaction emoji", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ReactionButtonGroup
        ariaLabel="Post reactions"
        reactions={[
          {
            emoji: "👍",
            count: 0,
            reactedByMe: false
          },
          {
            emoji: "👀",
            count: 0,
            reactedByMe: false
          }
        ]}
        onToggle={() => undefined}
      />
    );

    await user.click(screen.getByRole("button", { name: /add 👍 reaction/i }));

    expect(screen.getByText("👍")).toHaveAttribute("data-popping", "true");
    expect(screen.getByText("👀")).toHaveAttribute("data-popping", "false");
  });

  it("applies post reaction optimistic feedback before the request resolves", async () => {
    const user = userEvent.setup();
    const pendingFetch = vi.fn(() => new Promise<Response>(() => undefined));

    vi.stubGlobal("fetch", pendingFetch);

    renderWithProviders(<OptimisticReactionProbe />);

    const reaction = screen.getByRole("button", {
      name: "Toggle reaction"
    });

    expect(reaction).toHaveTextContent("0:false");

    await user.click(reaction);

    await waitFor(() => expect(reaction).toHaveTextContent("1:true"));
    expect(pendingFetch).toHaveBeenCalledTimes(1);
  });

  it("states why progress cannot advance when no milestones exist", async () => {
    mockFetchRoutes([
      {
        path: "/api/clubs/safe-club/progress",
        response: {
          progress: {
            id: "progress-1",
            mode: "STRICT",
            currentMilestone: null,
            totalMilestones: 0,
            completedMilestones: 0,
            percentage: 0,
            onboardingCompletedAt: now,
            needsWelcomeSetup: false,
            updatedAt: now,
            history: []
          }
        }
      },
      {
        path: "/api/clubs/safe-club/milestones",
        response: {
          milestones: [],
          pagination: {
            page: 1,
            limit: 100,
            total: 0,
            pageCount: 0
          }
        }
      }
    ]);

    renderWithProviders(
      <ClubProgressPanel linkName="safe-club" clubTitle="Safe Club" />
    );

    const advanceButton = await screen.findByRole("button", {
      name: /no milestones to advance/i
    });

    expect(advanceButton).toBeDisabled();
    expect(
      screen.getByText(/no milestones have been added yet/i)
    ).toBeInTheDocument();
  });
});

const OptimisticReactionProbe = () => {
  const postQuery = useQuery({
    queryKey: clubsQueryKeys.postDetail("post-1"),
    queryFn: () => new Promise<PostDetailResponse>(() => undefined),
    initialData: optimisticPostDetail,
    staleTime: Infinity
  });
  const mutation = useTogglePostReactionMutation("post-1");
  const reaction = postQuery.data.post.counts.reactions[0];

  return (
    <button
      type="button"
      aria-label="Toggle reaction"
      onClick={() =>
        mutation.mutate({
          emoji: "👍",
          active: true
        })
      }
    >
      {reaction.count}:{String(reaction.reactedByMe)}
    </button>
  );
};

const optimisticPostDetail: PostDetailResponse = {
  club: {
    id: "club-1",
    linkName: "safe-club"
  },
  post: {
    id: "post-1",
    visibility: "VISIBLE",
    type: "DISCUSSION",
    status: "VISIBLE",
    title: "Visible post title",
    bodyPreview: "Visible post body.",
    author: {
      id: "user-1",
      displayName: "Reader",
      username: null
    },
    requiredMilestone: {
      id: "milestone-1",
      position: 1,
      label: "Opening"
    },
    counts: {
      commentCount: 0,
      reactionCount: 0,
      unreadCommentCount: 0,
      reactions: [
        { emoji: "👍", count: 0, reactedByMe: false },
        { emoji: "❤️", count: 0, reactedByMe: false },
        { emoji: "😂", count: 0, reactedByMe: false },
        { emoji: "😮", count: 0, reactedByMe: false },
        { emoji: "👀", count: 0, reactedByMe: false }
      ]
    },
    permissions: {
      canDelete: false
    },
    createdAt: now,
    updatedAt: now
  }
};
