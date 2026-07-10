import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";

import { renderWithProviders } from "@/test/render";

import { RouteErrorBoundary } from "./route-error-boundary.js";

const BrokenRoute = () => {
  throw new Error("route render failed");
};

describe("RouteErrorBoundary", () => {
  it("recovers from a route render failure when the user navigates away", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <RouteErrorBoundary>
        <Routes>
          <Route path="/" element={<p>Safe destination</p>} />
          <Route path="/broken" element={<BrokenRoute />} />
        </Routes>
      </RouteErrorBoundary>,
      { initialEntries: ["/broken"] }
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");

    await user.click(screen.getByRole("link", { name: "Go home" }));

    expect(screen.getByText("Safe destination")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
