import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { errorHandler } from "../../core/http/error-middleware.js";
import { requestIdMiddleware } from "../../core/http/request-id.js";
import { prisma } from "../../core/prisma/client.js";
import { createAuthController } from "./auth.controller.js";
import { authUsersRepository } from "./auth.repository.js";
import { createAuthService } from "./auth.service.js";
import type { EmailDelivery } from "./email-delivery.js";
import { hashEmailIdentityToken } from "./email-identity-token.js";
import {
  expiredPendingSignupPurgeLimit,
  pendingSignupRepository
} from "./pending-signup.repository.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
const password = "correct horse battery staple";
const createdEmails = new Set<string>();

const fixture = () => {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const emails = [`ps_${suffix}_1@example.com`, `ps_${suffix}_2@example.com`];
  emails.forEach((email) => createdEmails.add(email));
  return { emails, names: [`ps_${suffix}_1`, `ps_${suffix}_2`] };
};

const createApp = () => {
  const tokens = new Map<string, string>();
  const delivery: EmailDelivery = {
    sendEmailVerification: async ({ email, token }) => {
      tokens.set(email, token);
    },
    sendPasswordReset: async () => undefined
  };
  const service = createAuthService(
    authUsersRepository,
    undefined,
    undefined,
    undefined,
    delivery
  );
  const controller = createAuthController(service);
  const app = express();
  app.use(requestIdMiddleware, express.json());
  app.post("/signup", controller.signup);
  app.post("/confirm", controller.verifyEmail);
  app.use(errorHandler);
  return { app, tokens };
};

const pendingFixture = (email: string, username: string, expiresAt: Date) => {
  const token = crypto.randomUUID();
  return {
    token,
    input: {
      email,
      username,
      passwordHash: "$argon2id$v=19$pending-fixture",
      tokenHash: hashEmailIdentityToken(token),
      expiresAt,
      now: new Date()
    }
  };
};

const inOneMinute = () => new Date(Date.now() + 60_000);

describeDatabase("pending signups", () => {
  afterEach(async () => {
    const emails = [...createdEmails];
    createdEmails.clear();
    await prisma.pendingSignup.deleteMany({ where: { email: { in: emails } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
  });

  it("creates no account or name reservation until the link is confirmed", async () => {
    const { emails, names } = fixture();
    const { app, tokens } = createApp();

    await request(app)
      .post("/signup")
      .send({ email: emails[0], username: names[0], password })
      .expect(202);

    expect(await prisma.user.count({ where: { email: emails[0] } })).toBe(0);
    expect(
      await prisma.userNameReservation.count({
        where: { normalizedName: names[0] }
      })
    ).toBe(0);

    await request(app)
      .post("/confirm")
      .send({ token: tokens.get(emails[0]!) })
      .expect(200);

    const user = await prisma.user.findFirstOrThrow({
      where: { email: emails[0] },
      select: {
        username: true,
        emailVerifiedAt: true,
        nameReservations: { select: { normalizedName: true } }
      }
    });
    expect(user).toEqual({
      username: names[0],
      emailVerifiedAt: expect.any(Date),
      nameReservations: [{ normalizedName: names[0] }]
    });
    expect(
      await prisma.pendingSignup.count({ where: { email: emails[0] } })
    ).toBe(0);
  });

  it("keeps one pending row per email when signups race", async () => {
    const { emails, names } = fixture();
    const { app } = createApp();

    const responses = await Promise.all(
      names.map((username) =>
        request(app)
          .post("/signup")
          .send({ email: emails[0], username, password })
      )
    );

    expect(responses.map(({ status }) => status)).toEqual([202, 202]);
    expect(
      await prisma.pendingSignup.count({ where: { email: emails[0] } })
    ).toBe(1);
  });

  it("creates one account when the same link is confirmed concurrently", async () => {
    const { emails, names } = fixture();
    const pending = pendingFixture(emails[0]!, names[0]!, inOneMinute());
    await pendingSignupRepository.savePendingSignup(pending.input);

    const results = await Promise.all([
      pendingSignupRepository.completePendingSignup({
        tokenHash: pending.input.tokenHash,
        now: new Date()
      }),
      pendingSignupRepository.completePendingSignup({
        tokenHash: pending.input.tokenHash,
        now: new Date()
      })
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual([
      "CREATED",
      "INVALID"
    ]);
    expect(await prisma.user.count({ where: { email: emails[0] } })).toBe(1);
  });

  it("lets only the first confirmation take a contested username", async () => {
    const { emails, names } = fixture();
    const pendings = emails.map((email) =>
      pendingFixture(email, names[0]!, inOneMinute())
    );
    for (const pending of pendings) {
      await pendingSignupRepository.savePendingSignup(pending.input);
    }

    const results = await Promise.all(
      pendings.map((pending) =>
        pendingSignupRepository.completePendingSignup({
          tokenHash: pending.input.tokenHash,
          now: new Date()
        })
      )
    );

    expect(results.map(({ status }) => status).sort()).toEqual([
      "CREATED",
      "USERNAME_TAKEN"
    ]);
    expect(await prisma.user.count({ where: { email: { in: emails } } })).toBe(
      1
    );
    expect(
      await prisma.pendingSignup.count({ where: { email: { in: emails } } })
    ).toBe(0);
  });

  it("returns a conflict when the username was taken before confirmation", async () => {
    const { emails, names } = fixture();
    const { app, tokens } = createApp();

    await request(app)
      .post("/signup")
      .send({ email: emails[0], username: names[0], password })
      .expect(202);
    await authUsersRepository.createUser({
      email: emails[1]!,
      displayName: names[0]!,
      username: names[0]!,
      passwordHash: "$argon2id$v=19$contender",
      emailVerifiedAt: new Date()
    });

    const response = await request(app)
      .post("/confirm")
      .set("x-request-id", "confirm-taken")
      .send({ token: tokens.get(emails[0]!) })
      .expect(409);

    expect(response.body.error.code).toBe("CONFLICT");
    expect(await prisma.user.count({ where: { email: emails[0] } })).toBe(0);
  });

  it("creates nothing for an email that already has an account", async () => {
    const { emails, names } = fixture();
    await authUsersRepository.createUser({
      email: emails[0]!,
      displayName: names[0]!,
      username: names[0]!,
      passwordHash: "$argon2id$v=19$owner",
      emailVerifiedAt: new Date()
    });
    const pending = pendingFixture(emails[0]!, names[1]!, inOneMinute());
    await pendingSignupRepository.savePendingSignup(pending.input);

    expect(
      await pendingSignupRepository.completePendingSignup({
        tokenHash: pending.input.tokenHash,
        now: new Date()
      })
    ).toEqual({ status: "EMAIL_TAKEN" });
    expect(await prisma.user.count({ where: { email: emails[0] } })).toBe(1);
  });

  it("rejects and removes expired links", async () => {
    const { emails, names } = fixture();
    const pending = pendingFixture(
      emails[0]!,
      names[0]!,
      new Date(Date.now() - 1_000)
    );
    await pendingSignupRepository.savePendingSignup(pending.input);

    expect(
      await pendingSignupRepository.completePendingSignup({
        tokenHash: pending.input.tokenHash,
        now: new Date()
      })
    ).toEqual({ status: "INVALID" });
    expect(
      await prisma.pendingSignup.count({ where: { email: emails[0] } })
    ).toBe(0);
  });

  it("purges a bounded batch of expired rows on the next signup", async () => {
    const expiredEmails = Array.from(
      { length: expiredPendingSignupPurgeLimit + 1 },
      (_, index) => `ps_expired_${crypto.randomUUID()}_${index}@example.com`
    );
    expiredEmails.forEach((email) => createdEmails.add(email));
    await prisma.pendingSignup.createMany({
      data: expiredEmails.map((email, index) => ({
        email,
        username: `expired_${index}`,
        passwordHash: "$argon2id$v=19$expired",
        tokenHash: hashEmailIdentityToken(email),
        // Older than anything another test leaves behind, so the batch hits these.
        expiresAt: new Date(Date.UTC(2000, 0, 1, 0, 0, index))
      }))
    });
    const { emails, names } = fixture();
    await pendingSignupRepository.savePendingSignup(
      pendingFixture(emails[0]!, names[0]!, inOneMinute()).input
    );

    expect(
      await prisma.pendingSignup.count({
        where: { email: { in: expiredEmails } }
      })
    ).toBe(1);
  });
});
