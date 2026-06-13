import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import {
  clubSlugParamsSchema,
  createClubRequestSchema,
  listClubsQuerySchema
} from "./clubs.schema.js";
import { clubsService, type ClubsService } from "./clubs.service.js";

export type ClubsController = {
  createClub: RequestHandler;
  getClubBySlug: RequestHandler;
  joinPublicClubBySlug: RequestHandler;
  listClubs: RequestHandler;
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

  getClubBySlug: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const parseResult = clubSlugParamsSchema.safeParse(req.params);

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club URL and try again."
        );
      }

      const response = await service.getVisibleClubBySlug(
        parseResult.data.slug,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  joinPublicClubBySlug: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const parseResult = clubSlugParamsSchema.safeParse(req.params);

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

      const response = await service.joinPublicClubBySlug(
        parseResult.data.slug,
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

      const response = await service.listPublicClubs(parseResult.data);

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const clubsController = createClubsController();
