import { screen } from "@testing-library/react";

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
});
