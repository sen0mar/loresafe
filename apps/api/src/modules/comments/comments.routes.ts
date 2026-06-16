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

  return router;
};

export const commentsRouter = createCommentsRouter();
