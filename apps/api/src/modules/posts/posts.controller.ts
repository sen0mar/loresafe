import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import {
  clubPostsParamsSchema,
  createClubPostRequestSchema,
  listClubPostsQuerySchema,
  postDetailParamsSchema,
  togglePostReactionRequestSchema
} from "./posts.schema.js";
import { postsService, type PostsService } from "./posts.service.js";

export type PostsController = {
  createClubPostForSlug: RequestHandler;
  listClubPostsBySlug: RequestHandler;
  getPostById: RequestHandler;
  revealPostById: RequestHandler;
  togglePostReactionById: RequestHandler;
};

export const createPostsController = (
  service: PostsService = postsService
): PostsController => ({
  createClubPostForSlug: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubPostsParamsSchema.safeParse(req.params);
      const bodyResult = createClubPostRequestSchema.safeParse(req.body);

      if (!paramsResult.success || !bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the post details and try again."
        );
      }

      const response = await service.createClubPostForSlug(
        paramsResult.data.slug,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },

  listClubPostsBySlug: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubPostsParamsSchema.safeParse(req.params);
      const queryResult = listClubPostsQuerySchema.safeParse(req.query);

      if (!paramsResult.success || !queryResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the feed request and try again."
        );
      }

      const response = await service.listClubPostsBySlug(
        paramsResult.data.slug,
        req.currentUser.id,
        queryResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  getPostById: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = postDetailParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the post request and try again."
        );
      }

      const response = await service.getPostById(
        paramsResult.data.postId,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  revealPostById: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = postDetailParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the post request and try again."
        );
      }

      const response = await service.revealPostById(
        paramsResult.data.postId,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  togglePostReactionById: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = postDetailParamsSchema.safeParse(req.params);
      const bodyResult = togglePostReactionRequestSchema.safeParse(req.body);

      if (!paramsResult.success || !bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the reaction request and try again."
        );
      }

      const response = await service.togglePostReactionById(
        paramsResult.data.postId,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const postsController = createPostsController();
