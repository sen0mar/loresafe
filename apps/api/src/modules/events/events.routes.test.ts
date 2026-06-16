import cookieParser from "cookie-parser";
import express from "express";
import type { Server } from "node:http";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { errorHandler } from "../../core/http/error-middleware.js";
import { requestIdMiddleware } from "../../core/http/request-id.js";
import { createSessionToken } from "../../core/security/session-token.js";
import { createAuthMiddleware } from "../auth/auth.middleware.js";
import type {
  AuthUserCredentialsRecord,
  AuthUserRecord,
  AuthUsersRepository,
  CreateAuthUserInput
} from "../auth/auth.repository.js";
import { createAuthService } from "../auth/auth.service.js";
import { createEventsController } from "./events.controller.js";
import { createEventsRouter } from "./events.routes.js";
import { createEventsService, type EventsService } from "./events.service.js";

describe("events routes", () => {
  let repository: InMemoryEventsAuthRepository;
  let events: EventsService;
  let app: express.Express;
  let server: Server | null;

  beforeEach(() => {
    repository = new InMemoryEventsAuthRepository();
    events = createEventsService();
    app = createEventsTestApp(repository, events);
    server = null;
  });

  afterEach(async () => {
    await closeServer(server);
  });

  it("rejects signed-out event streams", async () => {
    await request(app)
      .get("/api/events")
      .set("x-request-id", "events-missing-session")
      .expect(401);
  });

  it("opens an authenticated stream with reconnect and heartbeat framing", async () => {
    const user = repository.createStoredUser(validUserInput());
    const response = await openEventsStream(
      app,
      await createSessionCookie(user)
    );

    server = response.server;

    const streamText = await readUntil(response, (text) =>
      text.includes(": heartbeat")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "text/event-stream"
    );
    expect(streamText).toContain("retry: 3000");
    expect(streamText).toContain(": connected");
    expect(streamText).toContain(": heartbeat");
  });

  it("streams notification events with safe metadata only", async () => {
    const user = repository.createStoredUser(validUserInput());
    const response = await openEventsStream(
      app,
      await createSessionCookie(user)
    );

    server = response.server;

    events.publishNotificationCreated(user.id, {
      notificationId: crypto.randomUUID(),
      club: {
        id: crypto.randomUUID(),
        slug: "safe-club"
      },
      postId: crypto.randomUUID(),
      commentId: crypto.randomUUID(),
      occurredAt: "2026-01-01T12:00:00.000Z"
    });

    const streamText = await readUntil(response, (text) =>
      text.includes("event: notification.created")
    );

    expect(streamText).toContain("event: notification.created");
    expect(streamText).toContain("\"slug\":\"safe-club\"");
    expect(streamText).not.toContain("safeText");
    expect(streamText).not.toContain("UNSAFE_STORY_CONTENT");
    expect(streamText).not.toContain("Milestone");
  });
});

const createEventsTestApp = (
  repository: InMemoryEventsAuthRepository,
  events: EventsService
) => {
  const app = express();
  const authService = createAuthService(repository);
  const authMiddleware = createAuthMiddleware(authService);
  const eventsController = createEventsController(events, {
    heartbeatMs: 10
  });

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(cookieParser());
  app.use("/api/events", createEventsRouter(eventsController, authMiddleware));
  app.use(errorHandler);

  return app;
};

const openEventsStream = async (app: express.Express, cookie: string) => {
  const server = app.listen(0);
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Could not start events test server.");
  }

  const controller = new AbortController();
  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/events`,
    {
      headers: {
        Cookie: cookie
      },
      signal: controller.signal
    }
  );

  return {
    response,
    server,
    controller,
    get status() {
      return response.status;
    },
    get headers() {
      return response.headers;
    }
  };
};

type OpenEventsStream = Awaited<ReturnType<typeof openEventsStream>>;

const readUntil = async (
  stream: OpenEventsStream,
  predicate: (text: string) => boolean
) => {
  const reader = stream.response.body?.getReader();

  if (!reader) {
    throw new Error("Expected events response body.");
  }

  const decoder = new TextDecoder();
  let text = "";

  try {
    while (!predicate(text)) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      text += decoder.decode(value, {
        stream: true
      });
    }
  } finally {
    stream.controller.abort();
    reader.releaseLock();
  }

  return text;
};

const closeServer = (server: Server | null) =>
  new Promise<void>((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

class InMemoryEventsAuthRepository implements AuthUsersRepository {
  readonly usersByEmail = new Map<
    string,
    AuthUserRecord & { passwordHash: string }
  >();

  findActiveUserByEmail = async (email: string) =>
    this.usersByEmail.get(email) ?? null;

  findActiveUserById = async (id: string) => {
    for (const user of this.usersByEmail.values()) {
      if (user.id === id) {
        return user;
      }
    }

    return null;
  };

  findActiveUserCredentialsByEmail = async (
    email: string
  ): Promise<AuthUserCredentialsRecord | null> =>
    this.usersByEmail.get(email) ?? null;

  createUser = async (input: CreateAuthUserInput) =>
    this.createStoredUser(input);

  createStoredUser = ({
    email,
    displayName,
    passwordHash
  }: CreateAuthUserInput) => {
    const now = new Date();
    const user = {
      id: crypto.randomUUID(),
      email,
      displayName,
      username: null,
      bio: null,
      passwordHash,
      sessionVersion: 1,
      createdAt: now,
      updatedAt: now
    };

    this.usersByEmail.set(email, user);

    return user;
  };
}

const createSessionCookie = async (user: AuthUserRecord) => {
  const token = await createSessionToken({
    userId: user.id,
    sessionVersion: user.sessionVersion
  });

  return `${env.SESSION_COOKIE_NAME}=${token}`;
};

const validUserInput = (): CreateAuthUserInput => ({
  email: "reader@example.com",
  displayName: "Reader",
  passwordHash: "hashed-password"
});
