import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import {
  banClubMemberRequestSchema,
  clubBanParamsSchema,
  clubMemberParamsSchema,
  clubLinkNameParamsSchema,
  createClubRequestSchema,
  listClubBansQuerySchema,
  listClubMembersQuerySchema,
  listClubsQuerySchema,
  listPublicSeoClubsQuerySchema,
  updateClubSettingsRequestSchema,
  updateClubMemberRoleRequestSchema
} from "./clubs.schema.js";
import { clubsService, type ClubsService } from "./clubs.service.js";

export type ClubsController = {
  banClubMember: RequestHandler;
  createClub: RequestHandler;
  getClubByLinkName: RequestHandler;
  joinPublicClubByLinkName: RequestHandler;
  leaveClubByLinkName: RequestHandler;
  listClubBans: RequestHandler;
  listClubMembers: RequestHandler;
  listClubs: RequestHandler;
  listPublicSeoClubs: RequestHandler;
  getPublicSeoClubByLinkName: RequestHandler;
  unbanClubBan: RequestHandler;
  updateClubSettings: RequestHandler;
  updateClubMemberRole: RequestHandler;
};

export const createClubsController = (
  service: ClubsService = clubsService
): ClubsController => ({
  createClub: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const parseResult = createClubRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club fields and try again."
        );
      }

      const response = await service.createClub(
        req.currentUser.id,
        parseResult.data
      );

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },

  getClubByLinkName: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const parseResult = clubLinkNameParamsSchema.safeParse(req.params);

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club URL and try again."
        );
      }

      const response = await service.getVisibleClubByLinkName(
        parseResult.data.linkName,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  getPublicSeoClubByLinkName: async (req, res, next) => {
    try {
      const parseResult = clubLinkNameParamsSchema.safeParse(req.params);

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the public club URL and try again."
        );
      }

      const response = await service.getPublicSeoClubByLinkName(
        parseResult.data.linkName,
        req.currentUser?.id ?? null
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  joinPublicClubByLinkName: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const parseResult = clubLinkNameParamsSchema.safeParse(req.params);

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club URL and try again."
        );
      }

      if (req.body && Object.keys(req.body).length > 0) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Join requests do not accept a body."
        );
      }

      const response = await service.joinPublicClubByLinkName(
        parseResult.data.linkName,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  leaveClubByLinkName: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const parseResult = clubLinkNameParamsSchema.safeParse(req.params);

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the leave club request and try again."
        );
      }

      if (req.body && Object.keys(req.body).length > 0) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Leave club requests do not accept a body."
        );
      }

      const response = await service.leaveClubByLinkName(
        parseResult.data.linkName,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  listClubMembers: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubLinkNameParamsSchema.safeParse(req.params);
      const queryResult = listClubMembersQuerySchema.safeParse(req.query);

      if (!paramsResult.success || !queryResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club members request and try again."
        );
      }

      const response = await service.listClubMembersByLinkName(
        paramsResult.data.linkName,
        req.currentUser.id,
        queryResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  listClubBans: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubLinkNameParamsSchema.safeParse(req.params);
      const queryResult = listClubBansQuerySchema.safeParse(req.query);

      if (!paramsResult.success || !queryResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club bans request and try again."
        );
      }

      const response = await service.listClubBansByLinkName(
        paramsResult.data.linkName,
        req.currentUser.id,
        queryResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  updateClubMemberRole: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubMemberParamsSchema.safeParse(req.params);
      const bodyResult = updateClubMemberRoleRequestSchema.safeParse(req.body);

      if (!paramsResult.success || !bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club member role request and try again."
        );
      }

      const response = await service.updateClubMemberRole(
        paramsResult.data.linkName,
        paramsResult.data.membershipId,
        req.currentUser.id,
        bodyResult.data.role
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  updateClubSettings: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubLinkNameParamsSchema.safeParse(req.params);
      const bodyResult = updateClubSettingsRequestSchema.safeParse(req.body);

      if (!paramsResult.success || !bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club settings request and try again."
        );
      }

      const response = await service.updateClubSettings(
        paramsResult.data.linkName,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  banClubMember: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubMemberParamsSchema.safeParse(req.params);
      const bodyResult = banClubMemberRequestSchema.safeParse(req.body ?? {});

      if (!paramsResult.success || !bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club member ban request and try again."
        );
      }

      const response = await service.banClubMember(
        paramsResult.data.linkName,
        paramsResult.data.membershipId,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  unbanClubBan: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubBanParamsSchema.safeParse(req.params);

      if (
        !paramsResult.success ||
        (req.body && Object.keys(req.body).length > 0)
      ) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club ban unban request and try again."
        );
      }

      const response = await service.unbanClubBan(
        paramsResult.data.linkName,
        paramsResult.data.banId,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  listClubs: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const parseResult = listClubsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club discovery query and try again."
        );
      }

      const response = await service.listPublicClubs(
        req.currentUser.id,
        parseResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  listPublicSeoClubs: async (req, res, next) => {
    try {
      const parseResult = listPublicSeoClubsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the public club discovery query and try again."
        );
      }

      const response = await service.listPublicSeoClubs(
        req.currentUser?.id ?? null,
        parseResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const clubsController = createClubsController();
