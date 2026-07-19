import { Router } from "express";

import {
  authMiddleware,
  type AuthMiddleware
} from "../auth/auth.middleware.js";
import {
  searchController,
  type SearchController
} from "./search.controller.js";

export const createSearchRouter = (
  controller: SearchController = searchController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.get(
    "/",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.search
  );

  return router;
};

export const searchRouter = createSearchRouter();
