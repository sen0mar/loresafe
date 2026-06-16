import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import {
  assetIdParamsSchema,
  createPostImageUploadRequestSchema,
  createPublicAssetUploadRequestSchema
} from "./uploads.schema.js";
import { uploadsService, type UploadsService } from "./uploads.service.js";

export type UploadsController = {
  completePublicAssetUpload: RequestHandler;
  createPostImageUpload: RequestHandler;
  createPublicAssetUpload: RequestHandler;
};

export const createUploadsController = (
  service: UploadsService = uploadsService
): UploadsController => ({
  createPublicAssetUpload: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const parseResult = createPublicAssetUploadRequestSchema.safeParse(
        req.body
      );

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the upload fields and try again."
        );
      }

      const response = await service.createPublicAssetUpload(
        req.currentUser.id,
        parseResult.data
      );

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },

  createPostImageUpload: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const parseResult = createPostImageUploadRequestSchema.safeParse(
        req.body
      );

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the upload fields and try again."
        );
      }

      const response = await service.createPostImageUpload(
        req.currentUser.id,
        parseResult.data
      );

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },

  completePublicAssetUpload: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const parseResult = assetIdParamsSchema.safeParse(req.params);

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the upload URL and try again."
        );
      }

      if (req.body && Object.keys(req.body).length > 0) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Upload completion does not accept a body."
        );
      }

      const response = await service.completePublicAssetUpload(
        req.currentUser.id,
        parseResult.data.assetId
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const uploadsController = createUploadsController();
