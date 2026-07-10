import { clubsRepository, type ClubsRepository } from "./clubs.repository.js";

export type ClubsQueryRepository = Pick<
  ClubsRepository,
  | "findClubByLinkName"
  | "findPublicSeoClubByLinkName"
  | "findVisibleClubByLinkNameForUser"
  | "listClubBansByLinkName"
  | "listClubMembersByLinkName"
  | "listPublicClubs"
  | "listPublicClubSitemapEntries"
  | "listPublicSeoClubs"
>;

export const clubsQueryRepository: ClubsQueryRepository = {
  findClubByLinkName: clubsRepository.findClubByLinkName,
  findPublicSeoClubByLinkName: clubsRepository.findPublicSeoClubByLinkName,
  findVisibleClubByLinkNameForUser: clubsRepository.findVisibleClubByLinkNameForUser,
  listClubBansByLinkName: clubsRepository.listClubBansByLinkName,
  listClubMembersByLinkName: clubsRepository.listClubMembersByLinkName,
  listPublicClubs: clubsRepository.listPublicClubs,
  listPublicClubSitemapEntries: clubsRepository.listPublicClubSitemapEntries,
  listPublicSeoClubs: clubsRepository.listPublicSeoClubs
};
