import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/test/render";

import { AppShell } from "./app-shell";

const currentUser = {
  email: "reader@example.com",
  displayName: "Demo Reader",
  avatarUrl: null
};

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
    expect(homeLink).toHaveClass("border-brand");
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
    expect(homeLink).not.toHaveClass("border-brand");
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

    expect(screen.getByRole("menuitem", { name: /^Home$/ })).toHaveAttribute(
      "href",
      "/app"
    );
  });
});
