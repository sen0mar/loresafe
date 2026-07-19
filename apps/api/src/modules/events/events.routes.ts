import { Router } from "express";

import {
  authMiddleware,
  type AuthMiddleware
} from "../auth/auth.middleware.js";
import {
  eventsController,
  type EventsController
} from "./events.controller.js";

export const createEventsRouter = (
  controller: EventsController = eventsController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.get(
    "/",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.streamEvents
  );

  return router;
};

export const eventsRouter = createEventsRouter();
