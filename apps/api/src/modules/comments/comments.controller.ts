import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import {
  createPostCommentRequestSchema,
  postCommentsParamsSchema,
  revealPostCommentParamsSchema
} from "./comments.schema.js";
import {
  commentsService,
  type CommentsService
} from "./comments.service.js";

export type CommentsController = {
  listPostComments: RequestHandler;
  createPostComment: RequestHandler;
  revealPostComment: RequestHandler;
};

export const createCommentsController = (
  service: CommentsService = commentsService
): CommentsController => ({
  listPostComments: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = postCommentsParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the comments request and try again."
        );
      }

      const response = await service.listPostComments(
        paramsResult.data.postId,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  createPostComment: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = postCommentsParamsSchema.safeParse(req.params);
      const bodyResult = createPostCommentRequestSchema.safeParse(req.body);

      if (!paramsResult.success || !bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the comment details and try again."
        );
      }

      const response = await service.createPostComment(
        paramsResult.data.postId,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },

  revealPostComment: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = revealPostCommentParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the comment request and try again."
        );
      }

      const response = await service.revealPostComment(
        paramsResult.data.postId,
        paramsResult.data.commentId,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const commentsController = createCommentsController();
