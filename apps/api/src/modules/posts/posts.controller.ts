import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import {
  clubPostsParamsSchema,
  createClubPostRequestSchema,
  listClubPostsQuerySchema,
  postDetailParamsSchema,
  postReactionParamsSchema
} from "./posts.schema.js";
import { postsService, type PostsService } from "./posts.service.js";

export type PostsController = {
  createClubPostForLinkName: RequestHandler;
  listClubPostsByLinkName: RequestHandler;
  getPostById: RequestHandler;
  revealPostById: RequestHandler;
  addPostReactionById: RequestHandler;
  removePostReactionById: RequestHandler;
  deletePostById: RequestHandler;
};

export const createPostsController = (
  service: PostsService = postsService
): PostsController => ({
  createClubPostForLinkName: async (req, res, next) => {
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

      const response = await service.createClubPostForLinkName(
        paramsResult.data.linkName,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },

  listClubPostsByLinkName: async (req, res, next) => {
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

      const response = await service.listClubPostsByLinkName(
        paramsResult.data.linkName,
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

  addPostReactionById: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = postReactionParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the reaction request and try again."
        );
      }

      const response = await service.setPostReactionById(
        paramsResult.data.postId,
        req.currentUser.id,
        { emoji: paramsResult.data.emoji, active: true }
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  removePostReactionById: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = postReactionParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the reaction request and try again."
        );
      }

      const response = await service.setPostReactionById(
        paramsResult.data.postId,
        req.currentUser.id,
        { emoji: paramsResult.data.emoji, active: false }
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  deletePostById: async (req, res, next) => {
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

      const response = await service.deletePostById(
        paramsResult.data.postId,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const postsController = createPostsController();
