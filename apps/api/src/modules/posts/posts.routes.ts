import { Router } from "express";

import { authMiddleware, type AuthMiddleware } from "../auth/auth.middleware.js";
import { postsController, type PostsController } from "./posts.controller.js";

export const createPostsRouter = (
  controller: PostsController = postsController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.post(
    "/:slug/posts",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.createClubPostForSlug
  );

  router.get(
    "/:slug/posts",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listClubPostsBySlug
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

  return router;
};

export const postsRouter = createPostsRouter();
export const postDetailsRouter = createPostDetailsRouter();
