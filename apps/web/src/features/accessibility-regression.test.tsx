import userEvent from "@testing-library/user-event";
import { screen, waitFor, within } from "@testing-library/react";

import { ReportDialog } from "@/features/clubs/components/report-dialog";
import { ReactionButtonGroup } from "@/features/clubs/components/reaction-button-group";
import { ClubProgressPanel } from "@/features/clubs/components/club-progress-panel";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  mockFetchRoutes,
  renderWithProviders
} from "@/test/render";

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
      <ClubProgressPanel slug="safe-club" clubTitle="Safe Club" />
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
