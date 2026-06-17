import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import { searchQuerySchema } from "./search.schema.js";
import { searchService, type SearchService } from "./search.service.js";

export type SearchController = {
  search: RequestHandler;
};

export const createSearchController = (
  service: SearchService = searchService
): SearchController => ({
  search: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const queryResult = searchQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the search request and try again."
        );
      }

      const response = await service.search(req.currentUser.id, queryResult.data);

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const searchController = createSearchController();
