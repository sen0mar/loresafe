import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler } from "../../core/http/error-middleware.js";
import { requestIdMiddleware } from "../../core/http/request-id.js";
import { prisma } from "../../core/prisma/client.js";
import { createAuthController } from "./auth.controller.js";
import {
  authUsersRepository,
  type AuthUsersRepository
} from "./auth.repository.js";
import { createAuthService } from "./auth.service.js";
import { emailIdentityRepository } from "./email-identity.repository.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
const neutralResponse = {
  message: "If the account is eligible, an email has been sent."
};
const conflictResponse = {
  error: {
    code: "CONFLICT",
    message: "That username is already taken.",
    requestId: "signup-race"
  }
};
const password = "correct horse battery staple";

const createApp = (repository: AuthUsersRepository) => {
  const app = express();
  const service = createAuthService(
    repository,
    undefined,
    undefined,
    emailIdentityRepository
  );
  app.use(requestIdMiddleware, express.json());
  app.post("/signup", createAuthController(service).signup);
  app.use(errorHandler);
  return app;
};

const signup = (app: express.Express, email: string, username: string) =>
  request(app)
    .post("/signup")
    .set("x-request-id", "signup-race")
    .send({ email, username, password });

const fixture = () => {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  return {
    emails: [`s04_${suffix}_1@example.com`, `s04_${suffix}_2@example.com`],
    names: [`s04_${suffix}_1`, `s04_${suffix}_2`]
  };
};

describeDatabase("signup uniqueness response privacy", () => {
  it.each([
    [true, false],
    [false, true],
    [true, true]
  ])(
    "handles concurrent inserts (same email=%s, same name=%s)",
    async (sameEmail, sameName) => {
      const { emails, names } = fixture();
      let arrivals = 0;
      let release = () => {};
      const ready = new Promise<void>((resolve) => {
        release = resolve;
      });
      const app = createApp({
        ...authUsersRepository,
        createUser: async (input) => {
          // Both real pre-checks finish before either transaction inserts.
          if (++arrivals === 2) release();
          await ready;
          return authUsersRepository.createUser(input);
        }
      });

      try {
        const responses = await Promise.all([
          signup(app, emails[0]!, names[0]!),
          signup(app, emails[sameEmail ? 0 : 1]!, names[sameName ? 0 : 1]!)
        ]);
        expect(responses.map(({ status }) => status).sort()).toEqual(
          sameName ? [202, 409] : [202, 202]
        );
        for (const response of responses) {
          expect(response.body).toEqual(
            response.status === 202 ? neutralResponse : conflictResponse
          );
          expect(response.headers["set-cookie"]).toBeUndefined();
        }
        expect(
          await prisma.user.count({ where: { email: { in: emails } } })
        ).toBe(1);
      } finally {
        await prisma.user.deleteMany({ where: { email: { in: emails } } });
      }
    }
  );

  it.each([false, true])(
    "keeps a late occupied name conflicting even when email also conflicts (%s)",
    async (emailConflict) => {
      const { emails, names } = fixture();
      const app = createApp({
        ...authUsersRepository,
        createUser: async (input) => {
          // Commit the contender after pre-checks, before the attempted insert.
          // With both occupied, PostgreSQL may report the email constraint first.
          await authUsersRepository.createUser({
            ...input,
            email: emailConflict ? input.email : emails[1]!
          });
          return authUsersRepository.createUser(input);
        }
      });

      try {
        const response = await signup(app, emails[0]!, names[0]!).expect(409);
        expect(response.body).toEqual(conflictResponse);
        expect(
          await prisma.user.count({ where: { email: { in: emails } } })
        ).toBe(1);
      } finally {
        await prisma.user.deleteMany({ where: { email: { in: emails } } });
      }
    }
  );
});
