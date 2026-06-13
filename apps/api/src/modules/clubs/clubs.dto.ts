import type { ClubDiscoveryRecord } from "./clubs.repository.js";

export type ClubDiscoveryDto = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  visibility: "PUBLIC";
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ClubsDiscoveryResponse = {
  clubs: ClubDiscoveryDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
};

export const toClubDiscoveryDto = (
  club: ClubDiscoveryRecord
): ClubDiscoveryDto => ({
  id: club.id,
  title: club.title,
  slug: club.slug,
  description: club.description,
  category: club.category,
  visibility: club.visibility,
  memberCount: club.memberCount,
  createdAt: club.createdAt.toISOString(),
  updatedAt: club.updatedAt.toISOString()
});
