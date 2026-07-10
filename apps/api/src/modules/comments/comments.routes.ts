import { Router } from "express";

import { authMiddleware, type AuthMiddleware } from "../auth/auth.middleware.js";
import {
  commentsController,
  type CommentsController
} from "./comments.controller.js";

export const createCommentsRouter = (
  controller: CommentsController = commentsController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.get(
    "/:postId/comments",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listPostComments
  );

  router.post(
    "/:postId/comments",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.createPostComment
  );

  router.post(
    "/:postId/comments/:commentId/reveal",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.revealPostComment
  );

  return router;
};

export const commentsRouter = createCommentsRouter();

export const createCommentReactionsRouter = (
  controller: CommentsController = commentsController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.put(
    "/:commentId/reactions/:emoji",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.addCommentReactionById
  );

  router.delete(
    "/:commentId/reactions/:emoji",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.removeCommentReactionById
  );

  router.post(
    "/:commentId/delete",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.deleteCommentById
  );

  return router;
};

export const commentReactionsRouter = createCommentReactionsRouter();
