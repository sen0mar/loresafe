import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { App } from "@/app/app";
import { mockFetchRoutes, renderWithProviders } from "@/test/render";

import { LandingPage } from "./landing-page";

describe("LandingPage", () => {
  it("renders the brand hero, entry actions, and dashboard preview image", () => {
    renderWithProviders(<LandingPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "ThreadSync" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Discuss books, shows, games, and courses without stumbling into spoilers/i
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create account/i })).toHaveAttribute(
      "href",
      "/signup"
    );
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(
      screen.getByRole("img", {
        name: /ThreadSync spoiler-safe discussion dashboard preview/i
      })
    ).toBeInTheDocument();
  });

  it("keeps the root route public while protecting the app home", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/");

    const publicRender = render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "ThreadSync" })
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    publicRender.unmount();

    mockFetchRoutes([
      {
        path: "/api/auth/me",
        status: 401,
        response: {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required"
          }
        }
      }
    ]);
    window.history.pushState({}, "", "/app");

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Welcome back"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to home/i })
    ).toHaveAttribute("href", "/");
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
    expect(window.location.search).toBe("?redirectTo=%2Fapp");
  });
});
