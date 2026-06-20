import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { errorHandler } from "../../core/http/error-middleware.js";
import { requestIdMiddleware } from "../../core/http/request-id.js";
import { createSessionToken } from "../../core/security/session-token.js";
import { createAuthMiddleware } from "../auth/auth.middleware.js";
import {
  type AuthUserCredentialsRecord,
  type AuthUserRecord,
  type AuthUsersRepository,
  type CreateAuthUserInput
} from "../auth/auth.repository.js";
import { createAuthService } from "../auth/auth.service.js";
import {
  type ListMilestonesResult,
  MilestoneMoveConflictError,
  MilestoneTemplateConflictError,
  type MilestoneRecord,
  type MilestonesRepository
} from "./milestones.repository.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import { createMilestonesController } from "./milestones.controller.js";
import { createMilestonesRouter } from "./milestones.routes.js";
import { createMilestonesService } from "./milestones.service.js";

describe("milestones routes", () => {
  let repository: InMemoryMilestonesRepository;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryMilestonesRepository();
    app = createMilestonesTestApp(repository);
  });

  it("rejects milestone reads without an authenticated session", async () => {
    const response = await request(app)
      .get("/api/clubs/public-story-circle/milestones")
      .set("x-request-id", "milestones-missing-session")
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "milestones-missing-session"
      }
    });
  });

  it("rejects milestone creation without an authenticated session", async () => {
    const response = await request(app)
      .post("/api/clubs/public-story-circle/milestones")
      .set("x-request-id", "milestones-create-missing-session")
      .send({
        safeTitle: "Opening chapters",
        spoilerName: false
      })
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "milestones-create-missing-session"
      }
    });
  });

  it("rejects milestone template generation without an authenticated session", async () => {
    const response = await request(app)
      .post("/api/clubs/public-story-circle/milestones/templates")
      .set("x-request-id", "milestones-template-missing-session")
      .send({
        template: "BOOK",
        count: 12
      })
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "milestones-template-missing-session"
      }
    });
  });

  it("rejects invalid club slugs", async () => {
    const user = await repository.createUser(validUserInput());

    const response = await request(app)
      .get("/api/clubs/not%20ok/milestones")
      .set("x-request-id", "milestones-invalid-slug")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the club URL and try again.",
        requestId: "milestones-invalid-slug"
      }
    });
  });

  it("rejects invalid milestone query params", async () => {
    const user = await repository.createUser(validUserInput());

    const response = await request(app)
      .get("/api/clubs/public-story-circle/milestones?page=0&limit=101")
      .set("x-request-id", "milestones-invalid-query")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the milestone query and try again.",
        requestId: "milestones-invalid-query"
      }
    });
  });

  it("rejects invalid milestone creation bodies", async () => {
    const owner = await repository.createUser(validUserInput());

    const response = await request(app)
      .post("/api/clubs/public-story-circle/milestones")
      .set("x-request-id", "milestones-create-invalid-body")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        safeTitle: "x",
        fullTitle: "x".repeat(161),
        description: "x".repeat(501),
        spoilerName: "yes"
      })
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the milestone details and try again.",
        requestId: "milestones-create-invalid-body"
      }
    });
  });

  it("rejects invalid milestone template generation bodies", async () => {
    const owner = await repository.createUser(validUserInput());

    const response = await request(app)
      .post("/api/clubs/public-story-circle/milestones/templates")
      .set("x-request-id", "milestones-template-invalid-body")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        template: "ALBUM",
        count: 201
      })
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the milestone template details and try again.",
        requestId: "milestones-template-invalid-body"
      }
    });
  });

  it("returns not found when creating milestones for an unknown club", async () => {
    const owner = await repository.createUser(validUserInput());

    const response = await request(app)
      .post("/api/clubs/unknown-club/milestones")
      .set("x-request-id", "milestones-create-unknown-club")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        safeTitle: "Opening chapters",
        spoilerName: false
      })
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Club not found",
        requestId: "milestones-create-unknown-club"
      }
    });
  });

  it("returns not found when generating templates for an unknown club", async () => {
    const owner = await repository.createUser(validUserInput());

    const response = await request(app)
      .post("/api/clubs/unknown-club/milestones/templates")
      .set("x-request-id", "milestones-template-unknown-club")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        template: "BOOK",
        count: 12
      })
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Club not found",
        requestId: "milestones-template-unknown-club"
      }
    });
  });

  it.each([
    ["private", "PRIVATE"],
    ["invite-only", "INVITE_ONLY"]
  ] as const)(
    "hides %s clubs when non-members try to create milestones",
    async (label, visibility) => {
      const reader = await repository.createUser(validUserInput());
      repository.createClub({
        slug: `${label}-plot-room`,
        visibility
      });

      const response = await request(app)
        .post(`/api/clubs/${label}-plot-room/milestones`)
        .set("x-request-id", `milestones-create-${label}-non-member`)
        .set("Cookie", await createSessionCookie(reader))
        .send({
          safeTitle: "Opening chapters",
          fullTitle: "Secret title",
          spoilerName: false
        })
        .expect(404);

      expect(response.body).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "Club not found",
          requestId: `milestones-create-${label}-non-member`
        }
      });
      expect(JSON.stringify(response.body)).not.toContain("Secret title");
    }
  );

  it.each([
    ["private", "PRIVATE"],
    ["invite-only", "INVITE_ONLY"]
  ] as const)(
    "hides %s clubs when non-members try to generate milestone templates",
    async (label, visibility) => {
      const reader = await repository.createUser(validUserInput());
      repository.createClub({
        slug: `${label}-plot-room`,
        visibility
      });

      const response = await request(app)
        .post(`/api/clubs/${label}-plot-room/milestones/templates`)
        .set("x-request-id", `milestones-template-${label}-non-member`)
        .set("Cookie", await createSessionCookie(reader))
        .send({
          template: "BOOK",
          count: 12
        })
        .expect(404);

      expect(response.body).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "Club not found",
          requestId: `milestones-template-${label}-non-member`
        }
      });
    }
  );

  it("rejects milestone creation from regular club members", async () => {
    const member = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMembership(member.id, club.id, "MEMBER");

    const response = await request(app)
      .post("/api/clubs/public-story-circle/milestones")
      .set("x-request-id", "milestones-create-member")
      .set("Cookie", await createSessionCookie(member))
      .send({
        safeTitle: "Opening chapters",
        spoilerName: false
      })
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Only club owners and moderators can add milestones.",
        requestId: "milestones-create-member"
      }
    });
  });

  it("rejects milestone template generation from regular club members", async () => {
    const member = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMembership(member.id, club.id, "MEMBER");

    const response = await request(app)
      .post("/api/clubs/public-story-circle/milestones/templates")
      .set("x-request-id", "milestones-template-member")
      .set("Cookie", await createSessionCookie(member))
      .send({
        template: "BOOK",
        count: 12
      })
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Only club owners and moderators can add milestones.",
        requestId: "milestones-template-member"
      }
    });
  });

  it("rejects milestone updates without an authenticated session", async () => {
    const response = await request(app)
      .patch(`/api/clubs/public-story-circle/milestones/${crypto.randomUUID()}`)
      .set("x-request-id", "milestones-update-missing-session")
      .send({
        safeTitle: "Opening chapters",
        spoilerName: false
      })
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "milestones-update-missing-session"
      }
    });
  });

  it("rejects milestone moves without an authenticated session", async () => {
    const response = await request(app)
      .post(
        `/api/clubs/public-story-circle/milestones/${crypto.randomUUID()}/move`
      )
      .set("x-request-id", "milestones-move-missing-session")
      .send({
        direction: "UP"
      })
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "milestones-move-missing-session"
      }
    });
  });

  it("rejects milestone updates from regular club members", async () => {
    const member = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMembership(member.id, club.id, "MEMBER");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening chapters"
    });

    const response = await request(app)
      .patch(`/api/clubs/public-story-circle/milestones/${milestone.id}`)
      .set("x-request-id", "milestones-update-member")
      .set("Cookie", await createSessionCookie(member))
      .send({
        safeTitle: "Renamed opening",
        spoilerName: false
      })
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Only club owners and moderators can manage milestones.",
        requestId: "milestones-update-member"
      }
    });
  });

  it("rejects milestone moves from regular club members", async () => {
    const member = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMembership(member.id, club.id, "MEMBER");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening chapters"
    });

    const response = await request(app)
      .post(`/api/clubs/public-story-circle/milestones/${milestone.id}/move`)
      .set("x-request-id", "milestones-move-member")
      .set("Cookie", await createSessionCookie(member))
      .send({
        direction: "DOWN"
      })
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Only club owners and moderators can manage milestones.",
        requestId: "milestones-move-member"
      }
    });
  });

  it.each(["OWNER", "MODERATOR"] as const)(
    "lets %s users update milestone text and spoiler-name settings",
    async (role) => {
      const manager = await repository.createUser({
        ...validUserInput(),
        email: `${role.toLowerCase()}-manager@example.com`,
        displayName: `${role} manager`
      });
      const club = repository.createClub({
        slug: "public-story-circle",
        visibility: "PUBLIC"
      });
      repository.createMembership(manager.id, club.id, role);
      const milestone = repository.createMilestone(club.id, {
        position: 1,
        safeTitle: "Opening chapters",
        fullTitle: "Opening chapters",
        spoilerName: false
      });

      const response = await request(app)
        .patch(`/api/clubs/public-story-circle/milestones/${milestone.id}`)
        .set("Cookie", await createSessionCookie(manager))
        .send({
          safeTitle: "Named revelation",
          fullTitle: "Forbidden Name",
          description: "Safe setup only.",
          spoilerName: true
        })
        .expect(200);

      expect(response.body).toEqual({
        milestone: {
          id: milestone.id,
          position: 1,
          safeTitle: "Named revelation",
          fullTitle: null,
          description: "Safe setup only.",
          spoilerName: true,
          isFullTitleHidden: true
        }
      });
      expect(repository.milestones[0]).toMatchObject({
        id: milestone.id,
        safeTitle: "Named revelation",
        fullTitle: "Forbidden Name",
        description: "Safe setup only.",
        spoilerName: true
      });
      expect(JSON.stringify(response.body)).not.toContain("Forbidden Name");
    }
  );

  it("does not update milestones from another club", async () => {
    const owner = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    const otherClub = repository.createClub({
      slug: "other-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMembership(owner.id, club.id, "OWNER");
    const otherMilestone = repository.createMilestone(otherClub.id, {
      position: 1,
      safeTitle: "Other opening"
    });

    const response = await request(app)
      .patch(`/api/clubs/public-story-circle/milestones/${otherMilestone.id}`)
      .set("x-request-id", "milestones-update-wrong-club")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        safeTitle: "Wrong update",
        spoilerName: false
      })
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Milestone not found",
        requestId: "milestones-update-wrong-club"
      }
    });
    expect(otherMilestone.safeTitle).toBe("Other opening");
  });

  it("moves milestones with stable ids and gap-free positions", async () => {
    const owner = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMembership(owner.id, club.id, "OWNER");
    const first = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening chapters"
    });
    const second = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Middle chapters"
    });
    const third = repository.createMilestone(club.id, {
      position: 3,
      safeTitle: "Final chapters"
    });

    await request(app)
      .post(`/api/clubs/public-story-circle/milestones/${second.id}/move`)
      .set("Cookie", await createSessionCookie(owner))
      .send({
        direction: "UP"
      })
      .expect(200);

    const response = await request(app)
      .get("/api/clubs/public-story-circle/milestones")
      .set("Cookie", await createSessionCookie(owner))
      .expect(200);

    expect(
      response.body.milestones.map(
        (milestone: { id: string; position: number; safeTitle: string }) => ({
          id: milestone.id,
          position: milestone.position,
          safeTitle: milestone.safeTitle
        })
      )
    ).toEqual([
      {
        id: second.id,
        position: 1,
        safeTitle: "Middle chapters"
      },
      {
        id: first.id,
        position: 2,
        safeTitle: "Opening chapters"
      },
      {
        id: third.id,
        position: 3,
        safeTitle: "Final chapters"
      }
    ]);
    expect(getSortedPositions(repository.milestones, club.id)).toEqual([
      1, 2, 3
    ]);
  });

  it("rejects boundary milestone moves", async () => {
    const owner = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMembership(owner.id, club.id, "OWNER");
    const first = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening chapters"
    });
    const second = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Final chapters"
    });

    await request(app)
      .post(`/api/clubs/public-story-circle/milestones/${first.id}/move`)
      .set("x-request-id", "milestones-move-first-up")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        direction: "UP"
      })
      .expect(409);

    await request(app)
      .post(`/api/clubs/public-story-circle/milestones/${second.id}/move`)
      .set("x-request-id", "milestones-move-last-down")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        direction: "DOWN"
      })
      .expect(409);

    expect(getSortedPositions(repository.milestones, club.id)).toEqual([
      1, 2
    ]);
  });

  it("does not move milestones from another club", async () => {
    const owner = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    const otherClub = repository.createClub({
      slug: "other-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMembership(owner.id, club.id, "OWNER");
    repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening chapters"
    });
    const otherMilestone = repository.createMilestone(otherClub.id, {
      position: 1,
      safeTitle: "Other opening"
    });

    const response = await request(app)
      .post(
        `/api/clubs/public-story-circle/milestones/${otherMilestone.id}/move`
      )
      .set("x-request-id", "milestones-move-wrong-club")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        direction: "DOWN"
      })
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Milestone not found",
        requestId: "milestones-move-wrong-club"
      }
    });
    expect(otherMilestone.position).toBe(1);
  });

  it.each(["OWNER", "MODERATOR"] as const)(
    "lets %s users append milestones",
    async (role) => {
      const creator = await repository.createUser({
        ...validUserInput(),
        email: `${role.toLowerCase()}@example.com`,
        displayName: role
      });
      const club = repository.createClub({
        slug: "public-story-circle",
        visibility: "PUBLIC"
      });
      repository.createMembership(creator.id, club.id, role);

      const response = await request(app)
        .post("/api/clubs/public-story-circle/milestones")
        .set("Cookie", await createSessionCookie(creator))
        .send({
          safeTitle: "Opening chapters",
          fullTitle: "Opening chapters",
          description: "Safe setup.",
          spoilerName: false
        })
        .expect(201);

      expect(response.body).toEqual({
        milestone: {
          id: expect.any(String),
          position: 1,
          safeTitle: "Opening chapters",
          fullTitle: "Opening chapters",
          description: "Safe setup.",
          spoilerName: false,
          isFullTitleHidden: false
        }
      });
    }
  );

  it.each(["OWNER", "MODERATOR"] as const)(
    "lets %s users generate milestone templates",
    async (role) => {
      const creator = await repository.createUser({
        ...validUserInput(),
        email: `${role.toLowerCase()}@example.com`,
        displayName: role
      });
      const club = repository.createClub({
        slug: "public-story-circle",
        visibility: "PUBLIC"
      });
      repository.createMembership(creator.id, club.id, role);

      const response = await request(app)
        .post("/api/clubs/public-story-circle/milestones/templates")
        .set("Cookie", await createSessionCookie(creator))
        .send({
          template: "GAME",
          count: 2
        })
        .expect(201);

      expect(response.body).toEqual({
        milestones: [
          {
            id: expect.any(String),
            position: 1,
            safeTitle: "Mission 1",
            fullTitle: null,
            description: null,
            spoilerName: false,
            isFullTitleHidden: false
          },
          {
            id: expect.any(String),
            position: 2,
            safeTitle: "Mission 2",
            fullTitle: null,
            description: null,
            spoilerName: false,
            isFullTitleHidden: false
          }
        ]
      });
    }
  );

  it.each([
    ["BOOK", ["Chapter 1", "Chapter 2"]],
    ["SHOW", ["Episode 1", "Episode 2"]],
    ["MOVIE", ["Part 1", "Part 2"]],
    ["GAME", ["Mission 1", "Mission 2"]],
    ["PODCAST_COURSE", ["Episode 1", "Episode 2"]],
    ["CUSTOM", ["Checkpoint 1", "Checkpoint 2"]]
  ] as const)(
    "creates %s template milestones as real ordered rows in one bulk transaction path",
    async (template, expectedSafeTitles) => {
      const owner = await repository.createUser(validUserInput());
      const club = repository.createClub({
        slug: "public-story-circle",
        visibility: "PUBLIC"
      });
      repository.createMembership(owner.id, club.id, "OWNER");

      const response = await request(app)
        .post("/api/clubs/public-story-circle/milestones/templates")
        .set("Cookie", await createSessionCookie(owner))
        .send({
          template,
          count: expectedSafeTitles.length
        })
        .expect(201);

      expect(repository.templateCreationTransactionCount).toBe(1);
      expect(response.body.milestones).toMatchObject(
        expectedSafeTitles.map((safeTitle, index) => ({
          position: index + 1,
          safeTitle,
          fullTitle: null,
          description: null,
          spoilerName: false,
          isFullTitleHidden: false
        }))
      );
      expect(
        repository.milestones.map((milestone) => ({
          position: milestone.position,
          safeTitle: milestone.safeTitle
        }))
      ).toEqual(
        expectedSafeTitles.map((safeTitle, index) => ({
          position: index + 1,
          safeTitle
        }))
      );
    }
  );

  it("does not generate template milestones over an existing timeline", async () => {
    const owner = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMembership(owner.id, club.id, "OWNER");
    repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Existing checkpoint"
    });

    const response = await request(app)
      .post("/api/clubs/public-story-circle/milestones/templates")
      .set("x-request-id", "milestones-template-conflict")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        template: "BOOK",
        count: 3
      })
      .expect(409);

    expect(response.body).toEqual({
      error: {
        code: "CONFLICT",
        message: "Templates can only be generated for an empty timeline.",
        requestId: "milestones-template-conflict"
      }
    });
    expect(repository.milestones).toMatchObject([
      {
        position: 1,
        safeTitle: "Existing checkpoint"
      }
    ]);
  });

  it("returns narrow milestone DTO fields for generated templates", async () => {
    const owner = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMembership(owner.id, club.id, "OWNER");

    const response = await request(app)
      .post("/api/clubs/public-story-circle/milestones/templates")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        template: "CUSTOM",
        count: 1
      })
      .expect(201);

    expect(Object.keys(response.body.milestones[0]).sort()).toEqual(
      [
        "description",
        "fullTitle",
        "id",
        "isFullTitleHidden",
        "position",
        "safeTitle",
        "spoilerName"
      ].sort()
    );
  });

  it("appends created milestones at the next position and lists them in order", async () => {
    const owner = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMembership(owner.id, club.id, "OWNER");

    for (const safeTitle of [
      "Opening chapters",
      "Middle chapters",
      "Final chapters"
    ]) {
      await request(app)
        .post("/api/clubs/public-story-circle/milestones")
        .set("Cookie", await createSessionCookie(owner))
        .send({
          safeTitle,
          spoilerName: false
        })
        .expect(201);
    }

    const response = await request(app)
      .get("/api/clubs/public-story-circle/milestones")
      .set("Cookie", await createSessionCookie(owner))
      .expect(200);

    expect(
      response.body.milestones.map(
        (milestone: { position: number; safeTitle: string }) => ({
          position: milestone.position,
          safeTitle: milestone.safeTitle
        })
      )
    ).toEqual([
      {
        position: 1,
        safeTitle: "Opening chapters"
      },
      {
        position: 2,
        safeTitle: "Middle chapters"
      },
      {
        position: 3,
        safeTitle: "Final chapters"
      }
    ]);
  });

  it("persists unsafe full titles but redacts them from milestone creation responses", async () => {
    const owner = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMembership(owner.id, club.id, "OWNER");

    const response = await request(app)
      .post("/api/clubs/public-story-circle/milestones")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        safeTitle: "Named revelation",
        fullTitle: "Forbidden Name",
        description: "Safe setup only.",
        spoilerName: true
      })
      .expect(201);

    expect(response.body).toEqual({
      milestone: {
        id: expect.any(String),
        position: 1,
        safeTitle: "Named revelation",
        fullTitle: null,
        description: "Safe setup only.",
        spoilerName: true,
        isFullTitleHidden: true
      }
    });
    expect(repository.milestones[0]?.fullTitle).toBe("Forbidden Name");
    expect(JSON.stringify(response.body)).not.toContain("Forbidden Name");
  });

  it("returns public club milestones ordered by position", async () => {
    const user = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMilestone(club.id, {
      position: 3,
      safeTitle: "Third checkpoint"
    });
    repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "First checkpoint"
    });
    repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Second checkpoint"
    });

    const response = await request(app)
      .get("/api/clubs/public-story-circle/milestones")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(
      response.body.milestones.map(
        (milestone: { position: number }) => milestone.position
      )
    ).toEqual([1, 2, 3]);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 100,
      total: 3,
      pageCount: 1
    });
  });

  it("paginates public club milestones", async () => {
    const user = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "First checkpoint"
    });
    repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Second checkpoint"
    });

    const response = await request(app)
      .get("/api/clubs/public-story-circle/milestones?page=2&limit=1")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.milestones).toMatchObject([
      {
        position: 2,
        safeTitle: "Second checkpoint"
      }
    ]);
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      pageCount: 2
    });
  });

  it.each([
    ["private", "PRIVATE"],
    ["invite-only", "INVITE_ONLY"]
  ] as const)(
    "hides %s club milestones from signed-in non-members",
    async (label, visibility) => {
      const reader = await repository.createUser(validUserInput());
      const club = repository.createClub({
        slug: `${label}-plot-room`,
        visibility
      });
      repository.createMilestone(club.id, {
        position: 1,
        safeTitle: "Safe checkpoint",
        fullTitle: "Hidden secret"
      });

      const response = await request(app)
        .get(`/api/clubs/${label}-plot-room/milestones`)
        .set("x-request-id", `milestones-${label}-non-member`)
        .set("Cookie", await createSessionCookie(reader))
        .expect(404);

      expect(response.body).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "Club not found",
          requestId: `milestones-${label}-non-member`
        }
      });
      expect(JSON.stringify(response.body)).not.toContain("Hidden secret");
    }
  );

  it("does not return unsafe milestone full titles", async () => {
    const user = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Named revelation",
      fullTitle: "Forbidden Name",
      description: "Safe context only.",
      spoilerName: true
    });

    const response = await request(app)
      .get("/api/clubs/public-story-circle/milestones")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.milestones).toEqual([
      {
        id: expect.any(String),
        position: 1,
        safeTitle: "Named revelation",
        fullTitle: null,
        description: "Safe context only.",
        spoilerName: true,
        isFullTitleHidden: true
      }
    ]);
    expect(JSON.stringify(response.body)).not.toContain("Forbidden Name");
  });

  it("reveals spoiler milestone full titles after the user reaches them", async () => {
    const user = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMembership(user.id, club.id);
    const reachedMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Safe opening",
      fullTitle: "Real opening title",
      spoilerName: true
    });
    const futureMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Safe midpoint",
      fullTitle: "Future midpoint title",
      spoilerName: true
    });
    repository.setProgress(user.id, club.id, reachedMilestone.id, "STRICT");

    const response = await request(app)
      .get("/api/clubs/public-story-circle/milestones")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.milestones).toMatchObject([
      {
        id: reachedMilestone.id,
        position: 1,
        safeTitle: "Safe opening",
        fullTitle: "Real opening title",
        spoilerName: true,
        isFullTitleHidden: false
      },
      {
        id: futureMilestone.id,
        position: 2,
        safeTitle: "Safe midpoint",
        fullTitle: null,
        spoilerName: true,
        isFullTitleHidden: true
      }
    ]);
    expect(JSON.stringify(response.body)).not.toContain("Future midpoint title");
  });

  it("returns narrow milestone DTO fields", async () => {
    const user = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening chapters",
      fullTitle: "Opening chapters",
      description: null,
      spoilerName: false
    });

    const response = await request(app)
      .get("/api/clubs/public-story-circle/milestones")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(Object.keys(response.body.milestones[0]).sort()).toEqual(
      [
        "description",
        "fullTitle",
        "id",
        "isFullTitleHidden",
        "position",
        "safeTitle",
        "spoilerName"
      ].sort()
    );
  });
});

const createMilestonesTestApp = (
  repository: AuthUsersRepository & MilestonesRepository
) => {
  const app = express();
  const authService = createAuthService(repository);
  const authMiddleware = createAuthMiddleware(authService);
  const milestonesService = createMilestonesService(repository);
  const milestonesController = createMilestonesController(milestonesService);

  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/clubs",
    createMilestonesRouter(milestonesController, authMiddleware)
  );
  app.use(errorHandler);

  return app;
};

type StoredClub = {
  id: string;
  slug: string;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
};

type CreateStoredClubInput = {
  slug: string;
  visibility: StoredClub["visibility"];
};

type CreateStoredMilestoneInput = Omit<MilestoneRecord, "id">;

type StoredProgress = {
  userId: string;
  clubId: string;
  currentMilestoneId: string | null;
  mode: ProgressMode;
};

class InMemoryMilestonesRepository
  implements AuthUsersRepository, MilestonesRepository
{
  readonly usersByEmail = new Map<
    string,
    AuthUserRecord & { passwordHash: string }
  >();
  readonly clubs = new Map<string, StoredClub>();
  readonly memberships: Array<{
    userId: string;
    clubId: string;
    role: "OWNER" | "MODERATOR" | "MEMBER";
  }> = [];
  readonly milestones: Array<MilestoneRecord & { clubId: string }> = [];
  readonly progressRows: StoredProgress[] = [];
  templateCreationTransactionCount = 0;

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

  createUser = async ({
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

  createClub = ({ slug, visibility }: CreateStoredClubInput) => {
    const club = {
      id: crypto.randomUUID(),
      slug,
      visibility
    };

    this.clubs.set(club.id, club);

    return club;
  };

  createMembership = (
    userId: string,
    clubId: string,
    role: "OWNER" | "MODERATOR" | "MEMBER" = "MEMBER"
  ) => {
    this.memberships.push({
      userId,
      clubId,
      role
    });
  };

  setProgress = (
    userId: string,
    clubId: string,
    currentMilestoneId: string | null,
    mode: ProgressMode
  ) => {
    const existingProgress = this.progressRows.find(
      (progress) => progress.userId === userId && progress.clubId === clubId
    );

    if (existingProgress) {
      existingProgress.currentMilestoneId = currentMilestoneId;
      existingProgress.mode = mode;
      return;
    }

    this.progressRows.push({
      userId,
      clubId,
      currentMilestoneId,
      mode
    });
  };

  createMilestone = (
    clubId: string,
    input: Partial<CreateStoredMilestoneInput> &
      Pick<CreateStoredMilestoneInput, "position" | "safeTitle">
  ) => {
    const milestone = {
      id: crypto.randomUUID(),
      clubId,
      fullTitle: null,
      description: null,
      spoilerName: false,
      ...input
    };

    this.milestones.push(milestone);

    return milestone;
  };

  createMilestoneAtNextPosition = async (
    input: Parameters<MilestonesRepository["createMilestoneAtNextPosition"]>[0]
  ) => {
    const nextPosition =
      Math.max(
        0,
        ...this.milestones
          .filter((milestone) => milestone.clubId === input.clubId)
          .map((milestone) => milestone.position)
      ) + 1;

    return this.createMilestone(input.clubId, {
      position: nextPosition,
      safeTitle: input.safeTitle,
      fullTitle: input.fullTitle,
      description: input.description,
      spoilerName: input.spoilerName
    });
  };

  updateMilestoneForClub = async (
    input: Parameters<MilestonesRepository["updateMilestoneForClub"]>[0]
  ) => {
    const milestone = this.milestones.find(
      (storedMilestone) =>
        storedMilestone.id === input.milestoneId &&
        storedMilestone.clubId === input.clubId
    );

    if (!milestone) {
      return null;
    }

    milestone.safeTitle = input.safeTitle;
    milestone.fullTitle = input.fullTitle ?? null;
    milestone.description = input.description ?? null;
    milestone.spoilerName = input.spoilerName;

    return milestone;
  };

  moveMilestoneForClub = async (
    input: Parameters<MilestonesRepository["moveMilestoneForClub"]>[0]
  ) => {
    const milestone = this.milestones.find(
      (storedMilestone) =>
        storedMilestone.id === input.milestoneId &&
        storedMilestone.clubId === input.clubId
    );

    if (!milestone) {
      return null;
    }

    const adjacentPosition =
      input.direction === "UP"
        ? milestone.position - 1
        : milestone.position + 1;
    const adjacentMilestone = this.milestones.find(
      (storedMilestone) =>
        storedMilestone.clubId === input.clubId &&
        storedMilestone.position === adjacentPosition
    );

    if (!adjacentMilestone) {
      throw new MilestoneMoveConflictError();
    }

    const originalPosition = milestone.position;
    milestone.position = adjacentMilestone.position;
    adjacentMilestone.position = originalPosition;

    return this.milestones
      .filter((storedMilestone) => storedMilestone.clubId === input.clubId)
      .sort(
        (leftMilestone, rightMilestone) =>
          leftMilestone.position - rightMilestone.position ||
          leftMilestone.id.localeCompare(rightMilestone.id)
      );
  };

  createMilestonesFromTemplateIfEmpty = async (
    input: Parameters<
      MilestonesRepository["createMilestonesFromTemplateIfEmpty"]
    >[0]
  ) => {
    this.templateCreationTransactionCount += 1;

    if (
      this.milestones.some((milestone) => milestone.clubId === input.clubId)
    ) {
      throw new MilestoneTemplateConflictError();
    }

    return input.milestones.map((milestone, index) =>
      this.createMilestone(input.clubId, {
        position: index + 1,
        safeTitle: milestone.safeTitle,
        fullTitle: milestone.fullTitle,
        description: milestone.description,
        spoilerName: milestone.spoilerName
      })
    );
  };

  findClubForMilestoneCreation = async (slug: string, userId: string) => {
    const club = this.findStoredClubBySlug(slug);

    if (!club || !this.canFindClubForMilestoneCreation(club, userId)) {
      return null;
    }

    return {
      id: club.id,
      currentUserRole: this.findMembership(userId, club.id)?.role ?? null
    };
  };

  listVisibleMilestonesByClubSlug = async (
    slug: string,
    userId: string,
    { page, limit }: { page: number; limit: number }
  ): Promise<ListMilestonesResult | null> => {
    const club = this.findStoredClubBySlug(slug);

    if (!club || !this.canViewClubMilestones(club, userId)) {
      return null;
    }

    const orderedMilestones = this.milestones
      .filter((milestone) => milestone.clubId === club.id)
      .sort(
        (leftMilestone, rightMilestone) =>
          leftMilestone.position - rightMilestone.position ||
          leftMilestone.id.localeCompare(rightMilestone.id)
      );
    const start = (page - 1) * limit;
    const progress = this.findProgress(userId, club.id);
    const currentMilestone = this.findMilestone(
      progress?.currentMilestoneId ?? null
    );

    return {
      milestones: orderedMilestones.slice(start, start + limit),
      total: orderedMilestones.length,
      viewerProgress: {
        mode: progress?.mode ?? "STRICT",
        currentMilestonePosition: currentMilestone?.position ?? null
      }
    };
  };

  private findStoredClubBySlug = (slug: string) => {
    for (const club of this.clubs.values()) {
      if (club.slug === slug) {
        return club;
      }
    }

    return null;
  };

  private canViewClubMilestones = (club: StoredClub, userId: string) =>
    club.visibility === "PUBLIC" ||
    this.memberships.some(
      (membership) =>
        membership.clubId === club.id && membership.userId === userId
    );

  private canFindClubForMilestoneCreation = (
    club: StoredClub,
    userId: string
  ) =>
    club.visibility === "PUBLIC" ||
    this.memberships.some(
      (membership) =>
        membership.clubId === club.id && membership.userId === userId
    );

  private findMembership = (userId: string, clubId: string) =>
    this.memberships.find(
      (membership) =>
        membership.clubId === clubId && membership.userId === userId
    );

  private findProgress = (userId: string, clubId: string) =>
    this.progressRows.find(
      (progress) => progress.userId === userId && progress.clubId === clubId
    );

  private findMilestone = (milestoneId: string | null) => {
    if (!milestoneId) {
      return null;
    }

    return (
      this.milestones.find((milestone) => milestone.id === milestoneId) ?? null
    );
  };
}

const createSessionCookie = async (user: AuthUserRecord) => {
  const token = await createSessionToken({
    userId: user.id,
    sessionVersion: user.sessionVersion
  });

  return `${env.SESSION_COOKIE_NAME}=${token}`;
};

const getSortedPositions = (
  milestones: Array<MilestoneRecord & { clubId: string }>,
  clubId: string
) =>
  milestones
    .filter((milestone) => milestone.clubId === clubId)
    .map((milestone) => milestone.position)
    .sort((leftPosition, rightPosition) => leftPosition - rightPosition);

const validUserInput = () => ({
  email: "reader@example.com",
  displayName: "Reader",
  passwordHash: "$argon2id$v=19$hash"
});
