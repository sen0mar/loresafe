import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import { clubLinkNameParamsSchema } from "../clubs/clubs.schema.js";
import {
  createMilestoneRequestSchema,
  createMilestoneTemplateRequestSchema,
  listMilestonesQuerySchema,
  milestoneParamsSchema,
  moveMilestoneRequestSchema,
  updateMilestoneRequestSchema
} from "./milestones.schema.js";
import {
  milestonesService,
  type MilestonesService
} from "./milestones.service.js";

export type MilestonesController = {
  createMilestoneTemplateForClubLinkName: RequestHandler;
  createMilestoneForClubLinkName: RequestHandler;
  updateMilestoneForClubLinkName: RequestHandler;
  moveMilestoneForClubLinkName: RequestHandler;
  listMilestonesByClubLinkName: RequestHandler;
};

export const createMilestonesController = (
  service: MilestonesService = milestonesService
): MilestonesController => ({
  createMilestoneTemplateForClubLinkName: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubLinkNameParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club URL and try again."
        );
      }

      const bodyResult = createMilestoneTemplateRequestSchema.safeParse(
        req.body
      );

      if (!bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the milestone template details and try again."
        );
      }

      const response = await service.createMilestoneTemplateForClubLinkName(
        paramsResult.data.linkName,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },

  createMilestoneForClubLinkName: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubLinkNameParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club URL and try again."
        );
      }

      const bodyResult = createMilestoneRequestSchema.safeParse(req.body);

      if (!bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the milestone details and try again."
        );
      }

      const response = await service.createMilestoneForClubLinkName(
        paramsResult.data.linkName,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },

  updateMilestoneForClubLinkName: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = milestoneParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club URL and try again."
        );
      }

      const bodyResult = updateMilestoneRequestSchema.safeParse(req.body);

      if (!bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the milestone details and try again."
        );
      }

      const response = await service.updateMilestoneForClubLinkName(
        paramsResult.data.linkName,
        paramsResult.data.milestoneId,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  moveMilestoneForClubLinkName: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = milestoneParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club URL and try again."
        );
      }

      const bodyResult = moveMilestoneRequestSchema.safeParse(req.body);

      if (!bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the milestone move and try again."
        );
      }

      const response = await service.moveMilestoneForClubLinkName(
        paramsResult.data.linkName,
        paramsResult.data.milestoneId,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  listMilestonesByClubLinkName: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubLinkNameParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club URL and try again."
        );
      }

      const queryResult = listMilestonesQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the milestone query and try again."
        );
      }

      const response = await service.listMilestonesByClubLinkName(
        paramsResult.data.linkName,
        req.currentUser.id,
        queryResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const milestonesController = createMilestonesController();
