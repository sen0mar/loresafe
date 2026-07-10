import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { useState } from "react";
import { Link, Route, Routes } from "react-router-dom";

import { renderWithProviders } from "@/test/render";

import { RouteErrorBoundary } from "./route-error-boundary.js";

const BrokenRoute = () => {
  throw new Error("route render failed");
};

describe("RouteErrorBoundary", () => {
  it("preserves mounted content during healthy route navigation", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <RouteErrorBoundary>
        <MountedContent />
        <Routes>
          <Route
            path="/"
            element={<Link to="/destination">Open destination</Link>}
          />
          <Route path="/destination" element={<p>Destination</p>} />
        </Routes>
      </RouteErrorBoundary>
    );

    await user.click(screen.getByRole("button", { name: "Increment" }));
    await user.click(screen.getByRole("link", { name: "Open destination" }));

    expect(screen.getByText("Destination")).toBeVisible();
    expect(screen.getByText("Count: 1")).toBeVisible();
  });

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

const MountedContent = () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        Increment
      </button>
    </div>
  );
};
