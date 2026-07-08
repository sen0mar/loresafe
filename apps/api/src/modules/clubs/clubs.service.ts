import { HttpError } from "../../core/errors/http-error.js";
import {
  type ClubBanResponse,
  type ClubBansResponse,
  type ClubResponse,
  type LeaveClubResponse,
  type ClubMemberResponse,
  type ClubMembersResponse,
  type ClubsDiscoveryResponse,
  type PublicClubResponse,
  type PublicClubsResponse,
  type PublicClubSitemapEntryDto,
  toClubBanDto,
  toClubDto,
  toClubDiscoveryDto,
  toClubMemberDto,
  toPublicClubDetailDto,
  toPublicClubDto,
  toPublicClubSitemapEntryDto
} from "./clubs.dto.js";
import {
  type ClubBanMutationResult,
  clubsRepository,
  type ClubMemberMutationResult,
  type LeaveClubResult,
  type ClubSettingsMutationResult,
  isUniqueConstraintError,
  type ClubsRepository
} from "./clubs.repository.js";
import { bannedFromClubError } from "./club-bans.js";
import type {
  BanClubMemberRequest,
  CreateClubRequest,
  ListClubBansQuery,
  ListClubMembersQuery,
  ListClubsQuery,
  ListPublicSeoClubsQuery,
  UpdateClubSettingsRequest
} from "./clubs.schema.js";

export type ClubsService = {
  createClub: (
    userId: string,
    input: CreateClubRequest
  ) => Promise<ClubResponse>;
  getVisibleClubByLinkName: (
    linkName: string,
    userId: string
  ) => Promise<ClubResponse>;
  joinPublicClubByLinkName: (
    linkName: string,
    userId: string
  ) => Promise<ClubResponse>;
  leaveClubByLinkName: (
    linkName: string,
    userId: string
  ) => Promise<LeaveClubResponse>;
  updateClubSettings: (
    linkName: string,
    userId: string,
    input: UpdateClubSettingsRequest
  ) => Promise<ClubResponse>;
  listClubMembersByLinkName: (
    linkName: string,
    userId: string,
    query: ListClubMembersQuery
  ) => Promise<ClubMembersResponse>;
  listClubBansByLinkName: (
    linkName: string,
    userId: string,
    query: ListClubBansQuery
  ) => Promise<ClubBansResponse>;
  updateClubMemberRole: (
    linkName: string,
    membershipId: string,
    userId: string,
    role: "OWNER" | "MODERATOR" | "MEMBER"
  ) => Promise<ClubMemberResponse>;
  banClubMember: (
    linkName: string,
    membershipId: string,
    userId: string,
    input: BanClubMemberRequest
  ) => Promise<ClubBanResponse>;
  unbanClubBan: (
    linkName: string,
    banId: string,
    userId: string
  ) => Promise<ClubBanResponse>;
  listPublicClubs: (
    userId: string,
    query: ListClubsQuery
  ) => Promise<ClubsDiscoveryResponse>;
  listPublicSeoClubs: (
    currentUserId: string | null,
    query: ListPublicSeoClubsQuery
  ) => Promise<PublicClubsResponse>;
  getPublicSeoClubByLinkName: (
    linkName: string,
    currentUserId: string | null
  ) => Promise<PublicClubResponse>;
  listPublicClubSitemapEntries: (
    limit: number
  ) => Promise<PublicClubSitemapEntryDto[]>;
};

export const createClubsService = (
  repository: ClubsRepository = clubsRepository
): ClubsService => ({
  createClub: async (userId, input) => {
    const existingClub = await repository.findClubByLinkName(input.linkName);

    if (existingClub) {
      throw duplicateLinkNameError();
    }

    try {
      const club = await repository.createClubWithOwnerMembership(userId, input);

      return {
        club: toClubDto(club)
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw duplicateLinkNameError();
      }

      throw error;
    }
  },

  getVisibleClubByLinkName: async (linkName, userId) => {
    const club = await repository.findVisibleClubByLinkNameForUser(linkName, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    return {
      club: toClubDto(club)
    };
  },

  joinPublicClubByLinkName: async (linkName, userId) => {
    const result = await repository.joinPublicClubByLinkName(linkName, userId);

    switch (result.status) {
      case "SUCCESS":
        return {
          club: toClubDto(result.club)
        };
      case "NOT_FOUND":
        throw new HttpError(404, "NOT_FOUND", "Club not found");
      case "BANNED":
        throw bannedFromClubError();
    }
  },

  leaveClubByLinkName: async (linkName, userId) => {
    const result = await repository.leaveClubByLinkName(linkName, userId);

    return toLeaveClubResponse(result);
  },

  updateClubSettings: async (linkName, userId, input) => {
    const result = await repository.updateClubSettings(linkName, userId, input);

    return toClubSettingsMutationResponse(result);
  },

  listClubMembersByLinkName: async (linkName, userId, query) => {
    const result = await repository.listClubMembersByLinkName(linkName, userId, query);

    if (!result.club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (result.club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!result.club.currentUserRole) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    return {
      members: result.members.map(toClubMemberDto),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pageCount: Math.ceil(result.total / query.limit)
      }
    };
  },

  listClubBansByLinkName: async (linkName, userId, query) => {
    const result = await repository.listClubBansByLinkName(linkName, userId, query);

    if (!result.club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (result.club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!result.club.currentUserRole) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (!canManageClubBans(result.club.currentUserRole)) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Only club owners and moderators can manage bans."
      );
    }

    return {
      bans: result.bans.map(toClubBanDto),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pageCount: Math.ceil(result.total / query.limit)
      }
    };
  },

  updateClubMemberRole: async (linkName, membershipId, userId, role) => {
    const result = await repository.updateClubMemberRole(
      linkName,
      membershipId,
      userId,
      role
    );

    return toMemberMutationResponse(result);
  },

  banClubMember: async (linkName, membershipId, userId, input) => {
    const result = await repository.banClubMember(
      linkName,
      membershipId,
      userId,
      input
    );

    return toBanMutationResponse(result);
  },

  unbanClubBan: async (linkName, banId, userId) => {
    const result = await repository.unbanClubBan(linkName, banId, userId);

    return toBanMutationResponse(result);
  },

  listPublicClubs: async (userId, query) => {
    const result = await repository.listPublicClubs(userId, query);

    return {
      clubs: result.clubs.map(toClubDiscoveryDto),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pageCount: Math.ceil(result.total / query.limit)
      }
    };
  },

  listPublicSeoClubs: async (currentUserId, query) => {
    const result = await repository.listPublicSeoClubs(currentUserId, query);

    return {
      clubs: result.clubs.map(toPublicClubDto),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pageCount: Math.ceil(result.total / query.limit)
      }
    };
  },

  getPublicSeoClubByLinkName: async (linkName, currentUserId) => {
    const club = await repository.findPublicSeoClubByLinkName(
      linkName,
      currentUserId
    );

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    return {
      club: toPublicClubDetailDto(club)
    };
  },

  listPublicClubSitemapEntries: async (limit) => {
    const result = await repository.listPublicClubSitemapEntries(limit);

    return result.entries.map(toPublicClubSitemapEntryDto);
  }
});

export const clubsService = createClubsService();

const duplicateLinkNameError = () =>
  new HttpError(409, "CONFLICT", "That club link name is already taken.");

const toMemberMutationResponse = (
  result: ClubMemberMutationResult
): ClubMemberResponse => {
  switch (result.status) {
    case "SUCCESS":
      return {
        member: toClubMemberDto(result.member)
      };
    case "CLUB_NOT_FOUND":
    case "MEMBER_NOT_FOUND":
      throw new HttpError(404, "NOT_FOUND", "Club member not found");
    case "ACTOR_BANNED":
      throw bannedFromClubError();
    case "ACTOR_NOT_ALLOWED":
      throw new HttpError(
        403,
        "FORBIDDEN",
        "You cannot manage this club member."
      );
    case "LAST_OWNER":
      throw new HttpError(
        409,
        "CONFLICT",
        "This club must keep at least one owner."
      );
  }
};

const toClubSettingsMutationResponse = (
  result: ClubSettingsMutationResult
): ClubResponse => {
  switch (result.status) {
    case "SUCCESS":
      return {
        club: toClubDto(result.club)
      };
    case "CLUB_NOT_FOUND":
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    case "ACTOR_BANNED":
      throw bannedFromClubError();
    case "ACTOR_NOT_ALLOWED":
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Only club owners and moderators can update club settings."
      );
  }
};

const toLeaveClubResponse = (result: LeaveClubResult): LeaveClubResponse => {
  switch (result.status) {
    case "SUCCESS":
      return {
        left: true,
        club: result.club
      };
    case "CLUB_NOT_FOUND":
    case "MEMBER_NOT_FOUND":
      throw new HttpError(404, "NOT_FOUND", "Club membership not found");
    case "ACTOR_BANNED":
      throw bannedFromClubError();
    case "LAST_OWNER":
      throw new HttpError(
        409,
        "CONFLICT",
        "This club must keep at least one owner."
      );
  }
};

const toBanMutationResponse = (
  result: ClubBanMutationResult
): ClubBanResponse => {
  switch (result.status) {
    case "SUCCESS":
      return {
        ban: toClubBanDto(result.ban),
        deletedPostCount: result.deletedPostCount
      };
    case "CLUB_NOT_FOUND":
    case "MEMBER_NOT_FOUND":
    case "BAN_NOT_FOUND":
      throw new HttpError(404, "NOT_FOUND", "Club ban not found");
    case "ACTOR_BANNED":
      throw bannedFromClubError();
    case "ACTOR_NOT_ALLOWED":
      throw new HttpError(
        403,
        "FORBIDDEN",
        "You cannot manage this club ban."
      );
    case "LAST_OWNER":
      throw new HttpError(
        409,
        "CONFLICT",
        "This club must keep at least one owner."
      );
  }
};

const canManageClubBans = (role: "OWNER" | "MODERATOR" | "MEMBER") =>
  role === "OWNER" || role === "MODERATOR";
