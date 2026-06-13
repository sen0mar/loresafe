import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import {
  acceptInviteParamsSchema,
  createClubInviteParamsSchema,
  createClubInviteRequestSchema
} from "./invites.schema.js";
import { invitesService, type InvitesService } from "./invites.service.js";

export type InvitesController = {
  acceptInvite: RequestHandler;
  createClubInvite: RequestHandler;
};

export const createInvitesController = (
  service: InvitesService = invitesService
): InvitesController => ({
  acceptInvite: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const parseResult = acceptInviteParamsSchema.safeParse(req.params);

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the invite link and try again."
        );
      }

      if (req.body && Object.keys(req.body).length > 0) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Invite accept requests do not accept a body."
        );
      }

      const response = await service.acceptInvite(
        parseResult.data.token,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  createClubInvite: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = createClubInviteParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club URL and try again."
        );
      }

      const bodyResult = createClubInviteRequestSchema.safeParse(
        req.body ?? {}
      );

      if (!bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the invite fields and try again."
        );
      }

      const response = await service.createClubInvite(
        paramsResult.data.slug,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const invitesController = createInvitesController();
