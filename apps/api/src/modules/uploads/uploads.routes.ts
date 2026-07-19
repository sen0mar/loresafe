import { Router } from "express";

import {
  authMiddleware,
  type AuthMiddleware
} from "../auth/auth.middleware.js";
import {
  uploadsController,
  type UploadsController
} from "./uploads.controller.js";

export const createUploadsRouter = (
  controller: UploadsController = uploadsController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.post(
    "/public-assets",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.createPublicAssetUpload
  );
  router.post(
    "/post-images",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.createPostImageUpload
  );
  router.post(
    "/:assetId/complete",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.completePublicAssetUpload
  );

  return router;
};

export const uploadsRouter = createUploadsRouter();
