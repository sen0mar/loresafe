import { clubsRepository, type ClubsRepository } from "./clubs.repository.js";

export type ClubsCommandRepository = Pick<
  ClubsRepository,
  | "banClubMember"
  | "createClubWithOwnerMembership"
  | "joinPublicClubByLinkName"
  | "leaveClubByLinkName"
  | "unbanClubBan"
  | "updateClubMemberRole"
  | "updateClubSettings"
>;

export const clubsCommandRepository: ClubsCommandRepository = {
  banClubMember: clubsRepository.banClubMember,
  createClubWithOwnerMembership: clubsRepository.createClubWithOwnerMembership,
  joinPublicClubByLinkName: clubsRepository.joinPublicClubByLinkName,
  leaveClubByLinkName: clubsRepository.leaveClubByLinkName,
  unbanClubBan: clubsRepository.unbanClubBan,
  updateClubMemberRole: clubsRepository.updateClubMemberRole,
  updateClubSettings: clubsRepository.updateClubSettings
};
