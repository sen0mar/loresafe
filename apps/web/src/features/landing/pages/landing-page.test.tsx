import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { App } from "@/app/app";
import { clearAuthSessionHint } from "@/features/auth/api/auth-session-hint";
import { mockFetchRoutes, renderWithProviders } from "@/test/render";

import { LandingPage } from "./landing-page";

describe("LandingPage", () => {
  it("renders the brand hero, entry actions, and dashboard preview image", () => {
    const { container } = renderWithProviders(<LandingPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "LoreSafe" })
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
    const heroImage = screen.getByRole("img", {
      name: /LoreSafe spoiler-safe discussion dashboard preview/i
    });

    expect(heroImage).toBeInTheDocument();
    expect(heroImage).toHaveAttribute("width", "1672");
    expect(heroImage).toHaveAttribute("height", "941");
    expect(heroImage).toHaveAttribute("fetchpriority", "high");
    expect(container.querySelector('source[type="image/avif"]')).toBeTruthy();
    expect(container.querySelector('source[type="image/webp"]')).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Spoiler-safe by design" })
    ).toBeInTheDocument();
    expect(screen.getByText("How does LoreSafe prevent spoilers?")).toBeVisible();
    expect(screen.getByText("Can private clubs appear in search?")).toBeVisible();
  });

  it("sets route-specific noindex metadata for auth pages", async () => {
    clearAuthSessionHint();
    window.history.pushState({}, "", "/login");

    const loginRender = render(<App />);

    await waitFor(() => {
      expect(document.title).toBe("Log in | LoreSafe");
      expect(getMeta("robots")).toBe("noindex, nofollow");
    });

    loginRender.unmount();
    clearAuthSessionHint();
    window.history.pushState({}, "", "/signup");

    render(<App />);

    await waitFor(() => {
      expect(document.title).toBe("Sign up | LoreSafe");
      expect(getMeta("robots")).toBe("noindex, nofollow");
    });
  });

  it("sets route-specific noindex metadata for protected app pages", async () => {
    mockAuthenticatedShellRequests();
    window.history.pushState({}, "", "/app/clubs/new");

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Create a spoiler-safe club" })
    ).toBeVisible();
    await waitFor(() => {
      expect(document.title).toBe("Create club | LoreSafe");
      expect(getMeta("robots")).toBe("noindex, nofollow");
      expect(getCanonical()).toBe(
        "https://loresafe.org/app/clubs/new"
      );
    });
  });

  it("keeps the root route public while protecting the app home", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/");

    const publicRender = render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "LoreSafe" })
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

const mockAuthenticatedShellRequests = () =>
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
    },
    {
      path: "/api/users/me/clubs",
      response: {
        clubs: [],
        pagination: {
          page: 1,
          limit: 3,
          total: 0,
          pageCount: 0
        }
      }
    },
    {
      path: "/api/notifications",
      response: {
        notifications: [],
        unreadCount: 0,
        pagination: {
          limit: 1,
          nextCursor: null,
          hasMore: false
        }
      }
    }
  ]);

const getMeta = (name: string) =>
  document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content;

const getCanonical = () =>
  document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
