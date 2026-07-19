import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { vi } from "vitest";

import { App } from "@/app/app";
import { clearAuthSessionHint } from "@/features/auth/api/auth-session-hint";
import { mockFetchRoutes, renderWithProviders } from "@/test/render";

import { LandingPage } from "./landing-page";

type MockIntersectionObserverEntry = {
  isIntersecting: boolean;
};

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
    expect(
      screen.getAllByRole("link", { name: /create account/i })
    ).toHaveLength(2);
    screen
      .getAllByRole("link", { name: /create account/i })
      .forEach((link) => expect(link).toHaveAttribute("href", "/signup"));
    expect(screen.getAllByRole("link", { name: /log in/i })).toHaveLength(2);
    screen
      .getAllByRole("link", { name: /log in/i })
      .forEach((link) => expect(link).toHaveAttribute("href", "/login"));
    const heroImage = screen.getByRole("img", {
      name: /LoreSafe spoiler-safe discussion dashboard preview/i
    });

    expect(heroImage).toBeInTheDocument();
    expect(heroImage).toHaveAttribute("width", "1672");
    expect(heroImage).toHaveAttribute("height", "941");
    expect(heroImage).toHaveAttribute("fetchpriority", "high");
    expect(container.querySelector('source[type="image/avif"]')).toBeTruthy();
    expect(container.querySelector('source[type="image/webp"]')).toBeTruthy();
    const scrollButton = screen.getByRole("button", {
      name: /scroll to landing page details/i
    });
    const detailsSection = document.getElementById("landing-more");

    expect(scrollButton).toHaveAttribute("aria-controls", "landing-more");
    expect(scrollButton.closest("section")).toHaveClass("soft-section-divider");
    expect(detailsSection?.firstElementChild).not.toHaveClass(
      "soft-section-divider"
    );
    expect(
      screen.queryByText("Create clubs", { selector: "span" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Spoiler-safe by design"
      })
    ).toBeVisible();
    expect(
      screen.getByText("How does LoreSafe prevent spoilers?")
    ).toBeVisible();
    expect(
      screen.getByText("What kinds of stories can I create clubs for?")
    ).toBeVisible();
    expect(
      screen.queryByText("Can private clubs appear in search?")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Spoiler-safe clubs for every point in the story.")
    ).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: /footer navigation/i })
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 2, name: "LoreSafe" })
    ).toBeVisible();
    expect(screen.queryByText("Navigation")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /explore clubs/i })
    ).toHaveAttribute("href", "/clubs");
    expect(
      screen.getAllByRole("link", { name: /create account/i })
    ).toHaveLength(2);
    const copyright = container.querySelector("footer p.text-faint");

    expect(copyright).toBeVisible();
    expect(copyright?.textContent).toMatch(
      /© \d{4} LoreSafe\. All rights reserved\./i
    );
  });

  it("scrolls to the lower landing content from the arrow control", () => {
    renderWithProviders(<LandingPage />);

    const detailsScrollIntoView = vi.fn();
    const heroScrollIntoView = vi.fn();
    const detailsSection = document.getElementById("landing-more");
    const heroSection = document.getElementById("landing-hero");

    expect(detailsSection).not.toBeNull();
    expect(heroSection).not.toBeNull();

    detailsSection!.scrollIntoView = detailsScrollIntoView;
    heroSection!.scrollIntoView = heroScrollIntoView;

    const detailsButton = screen.getByRole("button", {
      name: /scroll to landing page details/i
    });

    expect(detailsButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(detailsButton);

    expect(detailsScrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start"
    });
    expect(heroScrollIntoView).not.toHaveBeenCalled();

    const heroButton = screen.getByRole("button", {
      name: /scroll to landing page hero/i
    });

    expect(heroButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(heroButton);

    expect(heroScrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start"
    });
    expect(detailsScrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("updates the arrow direction when the lower landing content enters view", () => {
    let observerCallback:
      ((entries: MockIntersectionObserverEntry[]) => void) | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    const OriginalIntersectionObserver = window.IntersectionObserver;

    class MockIntersectionObserver {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds = [];

      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback as unknown as (
          entries: MockIntersectionObserverEntry[]
        ) => void;
      }

      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
    }

    window.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;

    try {
      renderWithProviders(<LandingPage />);

      expect(observe).toHaveBeenCalledWith(
        document.getElementById("landing-more")
      );
      expect(
        screen.getByRole("button", { name: /scroll to landing page details/i })
      ).toHaveAttribute("aria-pressed", "false");

      act(() => {
        observerCallback?.([{ isIntersecting: true }]);
      });

      expect(
        screen.getByRole("button", { name: /scroll to landing page hero/i })
      ).toHaveAttribute("aria-pressed", "true");

      act(() => {
        observerCallback?.([{ isIntersecting: false }]);
      });

      expect(
        screen.getByRole("button", { name: /scroll to landing page details/i })
      ).toHaveAttribute("aria-pressed", "false");
    } finally {
      window.IntersectionObserver = OriginalIntersectionObserver;
    }
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
      expect(getCanonical()).toBe("https://www.loresafe.org/app/clubs/new");
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
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute(
      "href",
      "/"
    );
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
