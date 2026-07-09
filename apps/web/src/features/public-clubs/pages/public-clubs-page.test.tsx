import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";

import { ClubDiscoveryCard } from "@/features/clubs/components/club-discovery-card";
import {
  mockFetchRoutes,
  renderWithProviders
} from "@/test/render";

import { PublicClubProfilePage } from "./public-club-profile-page";
import { PublicClubsPage } from "./public-clubs-page";

const now = "2026-01-01T12:00:00.000Z";
const publicClub = {
  id: "00000000-0000-4000-8000-000000000101",
  title: "Story Circle",
  linkName: "story-circle",
  description: "A spoiler-safe public book club.",
  category: "BOOKS" as const,
  coverUrl: null,
  visibility: "PUBLIC" as const,
  memberCount: 4,
  createdAt: now,
  updatedAt: now
};

describe("public club SEO pages", () => {
  it("renders public club directory results with collection structured data", async () => {
    const fetchMock = mockFetchRoutes([
      {
        path: "/api/public/clubs",
        response: {
          clubs: [publicClub],
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            pageCount: 1
          }
        }
      }
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/clubs" element={<PublicClubsPage />} />
      </Routes>,
      {
        initialEntries: ["/clubs"]
      }
    );

    expect(await screen.findByText("Story Circle")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open Story Circle" })).toHaveAttribute(
      "href",
      "/clubs/story-circle"
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/public/clubs?sort=popular&limit=20",
      expect.objectContaining({
        credentials: "include",
        method: "GET"
      })
    );

    await waitFor(() => {
      expect(document.title).toBe("Public spoiler-safe clubs | LoreSafe");
      expect(getMeta("description")).toContain("Browse public LoreSafe clubs");
      expect(getCanonical()).toBe("https://www.loresafe.org/clubs");
      expect(getRouteJsonLd()).toContain("CollectionPage");
      expect(getRouteJsonLd()).toContain("/clubs/story-circle");
    });
  });

  it("renders a public club profile with metadata and auth CTAs", async () => {
    mockFetchRoutes([
      {
        path: "/api/public/clubs/story-circle",
        response: {
          club: {
            ...publicClub,
            rules: "Keep future chapters out of early threads."
          }
        }
      }
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/clubs/:linkName" element={<PublicClubProfilePage />} />
      </Routes>,
      {
        initialEntries: ["/clubs/story-circle"]
      }
    );

    expect(await screen.findByRole("heading", { name: "Story Circle" })).toBeVisible();
    expect(
      screen.getByText("Keep future chapters out of early threads.")
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /create account/i })).toHaveAttribute(
      "href",
      "/signup?redirectTo=%2Fapp%2Fclubs%2Fstory-circle%3Ftab%3Dfeed"
    );
    expect(screen.getByRole("link", { name: /log in to join/i })).toHaveAttribute(
      "href",
      "/login?redirectTo=%2Fapp%2Fclubs%2Fstory-circle%3Ftab%3Dfeed"
    );

    await waitFor(() => {
      expect(document.title).toBe("Story Circle | LoreSafe public club");
      expect(getCanonical()).toBe(
        "https://www.loresafe.org/clubs/story-circle"
      );
      expect(getRouteJsonLd()).toContain("BreadcrumbList");
      expect(getRouteJsonLd()).toContain("Story Circle");
    });
  });

  it("marks a missing public club profile as noindex", async () => {
    mockFetchRoutes([
      {
        path: "/api/public/clubs/missing-club",
        status: 404,
        response: {
          error: {
            code: "NOT_FOUND",
            message: "Club not found"
          }
        }
      }
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/clubs/:linkName" element={<PublicClubProfilePage />} />
      </Routes>,
      {
        initialEntries: ["/clubs/missing-club"]
      }
    );

    expect(await screen.findByRole("heading", { name: "Club not found" })).toBeVisible();

    await waitFor(() => {
      expect(document.title).toBe("Club not found | LoreSafe");
      expect(getMeta("robots")).toBe("noindex, nofollow");
      expect(getCanonical()).toBe(
        "https://www.loresafe.org/clubs/missing-club"
      );
    });
  });

  it("keeps discovery cards pointed at authenticated club pages by default", () => {
    renderWithProviders(<ClubDiscoveryCard club={publicClub} />);

    expect(screen.getByRole("link", { name: "Open Story Circle" })).toHaveAttribute(
      "href",
      "/app/clubs/story-circle?tab=feed"
    );
  });
});

const getMeta = (name: string) =>
  document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content;

const getCanonical = () =>
  document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;

const getRouteJsonLd = () =>
  document.getElementById("loresafe-route-json-ld")?.textContent ?? "";
