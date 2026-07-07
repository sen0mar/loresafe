import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/test/render";

import { AppShell } from "./app-shell";

const currentUser = {
  email: "reader@example.com",
  displayName: "Demo Reader",
  avatarUrl: null
};

const joinedClubs = [
  {
    id: "club-1",
    title: "First Club",
    linkName: "first-club",
    visibility: "PUBLIC" as const,
    role: "OWNER" as const,
    memberCount: 5,
    joinedAt: "2026-07-06T07:00:00.000Z"
  },
  {
    id: "club-2",
    title: "Second Club",
    linkName: "second-club",
    visibility: "PRIVATE" as const,
    role: "MODERATOR" as const,
    memberCount: 4,
    joinedAt: "2026-07-06T07:00:00.000Z"
  },
  {
    id: "club-3",
    title: "Third Club",
    linkName: "third-club",
    visibility: "INVITE_ONLY" as const,
    role: "MEMBER" as const,
    memberCount: 3,
    joinedAt: "2026-07-06T07:00:00.000Z"
  },
  {
    id: "club-4",
    title: "Fourth Club",
    linkName: "fourth-club",
    visibility: "PUBLIC" as const,
    role: "MEMBER" as const,
    memberCount: 2,
    joinedAt: "2026-07-06T07:00:00.000Z"
  }
];

const getContentGrid = () => {
  const main = screen.getByTestId("page-content").closest("main");

  expect(main).toBeInTheDocument();
  expect(main?.parentElement).toBeInTheDocument();

  return main!.parentElement!;
};

describe("AppShell layout", () => {
  it("uses a single full-width content column when no right rail is provided", () => {
    renderWithProviders(
      <AppShell currentUser={currentUser}>
        <div data-testid="page-content">Page content</div>
      </AppShell>
    );

    expect(screen.queryByLabelText("Context panel")).not.toBeInTheDocument();
    expect(getContentGrid()).toHaveClass("grid-cols-1");
    expect(getContentGrid()).not.toHaveClass(
      "xl:grid-cols-[minmax(0,1fr)_320px]"
    );
  });

  it("keeps the desktop context column when a right rail is provided", () => {
    renderWithProviders(
      <AppShell
        currentUser={currentUser}
        rightRail={<div>Rail content</div>}
      >
        <div data-testid="page-content">Page content</div>
      </AppShell>
    );

    expect(screen.getByLabelText("Context panel")).toHaveTextContent(
      "Rail content"
    );
    expect(getContentGrid()).toHaveClass(
      "xl:grid-cols-[minmax(0,1fr)_320px]"
    );
  });

  it("keeps the top bar in normal page flow and links the brand home", () => {
    renderWithProviders(
      <AppShell currentUser={currentUser}>
        <div data-testid="page-content">Page content</div>
      </AppShell>
    );

    expect(screen.getByRole("banner")).not.toHaveClass("sticky");
    expect(screen.getByRole("link", { name: "ThreadSync home" })).toHaveAttribute(
      "href",
      "/app"
    );
  });

  it("keeps the desktop sidebar viewport-height and caps pinned joined clubs", () => {
    renderWithProviders(
      <AppShell
        currentUser={currentUser}
        joinedClubs={joinedClubs}
        joinedClubsTotal={joinedClubs.length}
      >
        <div data-testid="page-content">Page content</div>
      </AppShell>
    );

    expect(screen.getByLabelText("Primary sidebar")).toHaveClass(
      "lg:h-[calc(100dvh-1.5rem)]"
    );
    expect(screen.getByText("First Club")).toBeVisible();
    expect(screen.getByText("Second Club")).toBeVisible();
    expect(screen.getByText("Third Club")).toBeVisible();
    expect(screen.queryByText("Fourth Club")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/app/clubs"
    );
  });

  it("routes desktop Home navigation to the authenticated homepage", () => {
    renderWithProviders(
      <AppShell currentUser={currentUser}>
        <div data-testid="page-content">Page content</div>
      </AppShell>,
      {
        initialEntries: ["/app"]
      }
    );

    const homeLink = screen.getByRole("link", { name: /^Home$/ });

    expect(homeLink).toHaveAttribute("href", "/app");
    expect(homeLink).toHaveAttribute("aria-current", "page");
  });

  it("does not keep desktop Home navigation active on other app routes", () => {
    renderWithProviders(
      <AppShell currentUser={currentUser}>
        <div data-testid="page-content">Page content</div>
      </AppShell>,
      {
        initialEntries: ["/app/explore"]
      }
    );

    const homeLink = screen.getByRole("link", { name: /^Home$/ });

    expect(homeLink).toHaveAttribute("href", "/app");
    expect(homeLink).not.toHaveAttribute("aria-current", "page");
  });

  it("routes desktop My Clubs navigation to the joined clubs page", () => {
    renderWithProviders(
      <AppShell currentUser={currentUser}>
        <div data-testid="page-content">Page content</div>
      </AppShell>,
      {
        initialEntries: ["/app/clubs"]
      }
    );

    const clubsLink = screen.getByRole("link", { name: /^My Clubs$/ });

    expect(clubsLink).toHaveAttribute("href", "/app/clubs");
    expect(clubsLink).toHaveAttribute("aria-current", "page");
  });

  it("routes mobile Home navigation to the authenticated homepage", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AppShell currentUser={currentUser}>
        <div data-testid="page-content">Page content</div>
      </AppShell>,
      {
        initialEntries: ["/app/explore"]
      }
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    expect(
      screen.queryByText("ThreadSync", { selector: "[role='menu'] *" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^Home$/ })).toHaveAttribute(
      "href",
      "/app"
    );
    expect(screen.getByRole("menuitem", { name: /^My Clubs$/ })).toHaveAttribute(
      "href",
      "/app/clubs"
    );
  });

  it("does not render a global search bar in the app shell", () => {
    renderWithProviders(
      <AppShell currentUser={currentUser}>
        <div data-testid="page-content">Page content</div>
      </AppShell>,
      {
        initialEntries: ["/app/explore"]
      }
    );

    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });
});
