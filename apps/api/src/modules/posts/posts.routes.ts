import { Router } from "express";

import { authMiddleware, type AuthMiddleware } from "../auth/auth.middleware.js";
import { postsController, type PostsController } from "./posts.controller.js";

export const createPostsRouter = (
  controller: PostsController = postsController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.post(
    "/:linkName/posts",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.createClubPostForLinkName
  );

  router.get(
    "/:linkName/posts",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listClubPostsByLinkName
  );

  return router;
};

export const createPostDetailsRouter = (
  controller: PostsController = postsController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.get(
    "/:postId",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.getPostById
  );

  router.post(
    "/:postId/reveal",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.revealPostById
  );

  router.post(
    "/:postId/reactions/toggle",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.togglePostReactionById
  );

  router.post(
    "/:postId/delete",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.deletePostById
  );

  return router;
};

export const postsRouter = createPostsRouter();
export const postDetailsRouter = createPostDetailsRouter();
