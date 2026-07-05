import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeEach, vi } from "vitest";

import { AUTHENTICATED_HOME_PATH } from "@/app/routes";
import { mockFetchRoutes, renderWithProviders } from "@/test/render";

import {
  clearAuthSessionHint,
  rememberAuthSessionHint
} from "../api/auth-session-hint";
import { PublicOnlyRoute } from "./auth-route-guards";
import { LoginPage } from "../pages/login-page";
import { SignupPage } from "../pages/signup-page";

describe("auth route guards", () => {
  beforeEach(() => {
    clearAuthSessionHint();
  });

  it("renders public auth pages without checking sessions for first-time visitors", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderPublicLoginRoute();

    expect(
      screen.getByRole("heading", { name: "Welcome back" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Checking session")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows home navigation on the signup page", () => {
    renderPublicSignupRoute();

    expect(
      screen.getByRole("heading", {
        name: "Join the discussion at your own pace."
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      "/"
    );
  });

  it("redirects authenticated visitors away from public auth pages", async () => {
    const routeChanges: string[] = [];

    rememberAuthSessionHint();
    mockFetchRoutes([
      {
        path: "/api/auth/me",
        response: {
          user: {
            id: "00000000-0000-4000-8000-000000000001",
            email: "reader@example.com",
            displayName: "Reader",
            username: "reader",
            bio: null,
            avatarUrl: null,
            createdAt: "2026-01-01T12:00:00.000Z",
            updatedAt: "2026-01-01T12:00:00.000Z"
          }
        }
      }
    ]);

    renderPublicLoginRoute(routeChanges);

    await waitFor(() =>
      expect(routeChanges.at(-1)).toBe(AUTHENTICATED_HOME_PATH)
    );
  });
});

const renderPublicLoginRoute = (routeChanges?: string[]) =>
  renderWithProviders(
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route path={AUTHENTICATED_HOME_PATH} element={<div>App home</div>} />
    </Routes>,
    {
      initialEntries: ["/login"],
      routeObserver: routeChanges
        ? (path) => {
            routeChanges.push(path);
          }
        : undefined
    }
  );

const renderPublicSignupRoute = () =>
  renderWithProviders(
    <Routes>
      <Route
        path="/signup"
        element={
          <PublicOnlyRoute>
            <SignupPage />
          </PublicOnlyRoute>
        }
      />
    </Routes>,
    {
      initialEntries: ["/signup"]
    }
  );
