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
  type ClubProgressRecord,
  type ListRecentlyUnlockedInput,
  type ProgressClubRecord,
  type ProgressHistoryRecord,
  type ProgressMilestoneRecord,
  type ProgressRepository,
  type RecentlyUnlockedRecord
} from "./progress.repository.js";
import { createProgressController } from "./progress.controller.js";
import { createProgressRouter } from "./progress.routes.js";
import { createProgressService } from "./progress.service.js";
import type { ProgressMode, UpdateProgressRequest } from "./progress.schema.js";
import { canViewRequiredMilestone } from "../spoilers/spoiler.policy.js";

describe("progress routes", () => {
  let repository: InMemoryProgressRepository;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryProgressRepository();
    app = createProgressTestApp(repository);
  });

  it("rejects progress reads and updates without an authenticated session", async () => {
    await request(app)
      .get("/api/clubs/public-story-circle/progress")
      .set("x-request-id", "progress-read-missing-session")
      .expect(401);

    await request(app)
      .patch("/api/clubs/public-story-circle/progress")
      .set("x-request-id", "progress-update-missing-session")
      .send({
        currentMilestoneId: null,
        mode: "STRICT"
      })
      .expect(401);

    await request(app)
      .post("/api/clubs/public-story-circle/progress/next")
      .set("x-request-id", "progress-next-missing-session")
      .expect(401);
  });

  it("returns default unset progress for club members", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("public-story-circle");
    repository.createMembership(user.id, club.id);
    repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });

    const response = await request(app)
      .get("/api/clubs/public-story-circle/progress")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.progress).toMatchObject({
      id: null,
      mode: "STRICT",
      currentMilestone: null,
      totalMilestones: 1,
      completedMilestones: 0,
      percentage: 0,
      onboardingCompletedAt: null,
      needsWelcomeSetup: true,
      updatedAt: null,
      history: []
    });
  });

  it("does not request welcome setup for existing progress rows", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("existing-progress-club");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const completedAt = new Date("2026-07-01T12:00:00.000Z");
    repository.createMembership(user.id, club.id);
    repository.progressRows.push({
      id: crypto.randomUUID(),
      userId: user.id,
      clubId: club.id,
      currentMilestoneId: milestone.id,
      mode: "STRICT",
      onboardingCompletedAt: completedAt,
      createdAt: completedAt,
      updatedAt: completedAt
    });

    const response = await request(app)
      .get("/api/clubs/existing-progress-club/progress")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.progress).toMatchObject({
      id: expect.any(String),
      onboardingCompletedAt: completedAt.toISOString(),
      needsWelcomeSetup: false
    });
  });

  it("completes welcome setup without history for the default strict not-started choice", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("welcome-default-club");
    repository.createMembership(user.id, club.id);

    const response = await request(app)
      .patch("/api/clubs/welcome-default-club/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: null,
        mode: "STRICT"
      })
      .expect(200);

    expect(response.body.progress).toMatchObject({
      id: expect.any(String),
      mode: "STRICT",
      currentMilestone: null,
      onboardingCompletedAt: expect.any(String),
      needsWelcomeSetup: false,
      history: []
    });
    expect(repository.history).toHaveLength(0);
    expect(repository.enqueuedProgressUnlockNotificationJobs).toEqual([]);
  });

  it("persists progress per user and per club", async () => {
    const firstUser = repository.createStoredUser(validUserInput());
    const secondUser = repository.createStoredUser({
      ...validUserInput(),
      email: "second@example.com",
      displayName: "Second"
    });
    const firstClub = repository.createClub("first-club");
    const secondClub = repository.createClub("second-club");
    const firstMilestone = repository.createMilestone(firstClub.id, {
      position: 1,
      safeTitle: "First opening"
    });
    const secondMilestone = repository.createMilestone(secondClub.id, {
      position: 1,
      safeTitle: "Second opening"
    });
    repository.createMembership(firstUser.id, firstClub.id);
    repository.createMembership(firstUser.id, secondClub.id);
    repository.createMembership(secondUser.id, firstClub.id);

    await request(app)
      .patch("/api/clubs/first-club/progress")
      .set("Cookie", await createSessionCookie(firstUser))
      .send({
        currentMilestoneId: firstMilestone.id,
        mode: "STRICT"
      })
      .expect(200);
    await request(app)
      .patch("/api/clubs/second-club/progress")
      .set("Cookie", await createSessionCookie(firstUser))
      .send({
        currentMilestoneId: secondMilestone.id,
        mode: "BRAVE"
      })
      .expect(200);

    const firstUserFirstClub = await request(app)
      .get("/api/clubs/first-club/progress")
      .set("Cookie", await createSessionCookie(firstUser))
      .expect(200);
    const firstUserSecondClub = await request(app)
      .get("/api/clubs/second-club/progress")
      .set("Cookie", await createSessionCookie(firstUser))
      .expect(200);
    const secondUserFirstClub = await request(app)
      .get("/api/clubs/first-club/progress")
      .set("Cookie", await createSessionCookie(secondUser))
      .expect(200);

    expect(firstUserFirstClub.body.progress).toMatchObject({
      mode: "STRICT",
      needsWelcomeSetup: false,
      currentMilestone: {
        id: firstMilestone.id,
        safeTitle: "First opening"
      }
    });
    expect(firstUserSecondClub.body.progress).toMatchObject({
      mode: "BRAVE",
      needsWelcomeSetup: false,
      currentMilestone: {
        id: secondMilestone.id,
        safeTitle: "Second opening"
      }
    });
    expect(secondUserFirstClub.body.progress).toMatchObject({
      mode: "STRICT",
      needsWelcomeSetup: true,
      currentMilestone: null
    });
  });

  it("creates history only when progress changes", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("history-club");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const secondMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Middle"
    });
    repository.createMembership(user.id, club.id);

    await request(app)
      .patch("/api/clubs/history-club/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: firstMilestone.id,
        mode: "BRAVE"
      })
      .expect(200);
    await request(app)
      .patch("/api/clubs/history-club/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: firstMilestone.id,
        mode: "BRAVE"
      })
      .expect(200);
    const response = await request(app)
      .patch("/api/clubs/history-club/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: secondMilestone.id,
        mode: "BRAVE"
      })
      .expect(200);

    expect(repository.history).toHaveLength(2);
    expect(repository.enqueuedProgressUnlockNotificationJobs).toEqual([
      {
        progressHistoryId: repository.history[1].id
      },
      {
        progressHistoryId: repository.history[0].id
      }
    ]);
    expect(response.body.progress.history).toHaveLength(2);
    expect(response.body.progress.history[0]).toMatchObject({
      fromMode: "BRAVE",
      toMode: "BRAVE",
      fromMilestone: {
        id: firstMilestone.id,
        safeTitle: "Opening"
      },
      toMilestone: {
        id: secondMilestone.id,
        safeTitle: "Middle"
      }
    });
  });

  it("advances unset progress to the first milestone", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("quick-club");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Middle"
    });
    repository.createMembership(user.id, club.id);

    const response = await request(app)
      .post("/api/clubs/quick-club/progress/next")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.progress).toMatchObject({
      mode: "STRICT",
      currentMilestone: {
        id: firstMilestone.id,
        safeTitle: "Opening"
      },
      completedMilestones: 1,
      totalMilestones: 2,
      onboardingCompletedAt: expect.any(String),
      needsWelcomeSetup: false
    });
    expect(repository.history).toHaveLength(1);
    expect(repository.enqueuedProgressUnlockNotificationJobs).toEqual([
      {
        progressHistoryId: repository.history[0].id
      }
    ]);
  });

  it("advances existing progress to the next milestone and preserves mode", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("preserve-mode-club");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const secondMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Middle"
    });
    repository.createMilestone(club.id, {
      position: 3,
      safeTitle: "Finale"
    });
    repository.createMembership(user.id, club.id);

    await request(app)
      .patch("/api/clubs/preserve-mode-club/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: firstMilestone.id,
        mode: "BRAVE"
      })
      .expect(200);
    const response = await request(app)
      .post("/api/clubs/preserve-mode-club/progress/next")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.progress).toMatchObject({
      mode: "BRAVE",
      currentMilestone: {
        id: secondMilestone.id,
        safeTitle: "Middle"
      }
    });
    expect(repository.history).toHaveLength(2);
    expect(repository.enqueuedProgressUnlockNotificationJobs).toHaveLength(2);
    expect(repository.history[0]).toMatchObject({
      fromMode: "BRAVE",
      toMode: "BRAVE",
      fromMilestone: {
        id: firstMilestone.id
      },
      toMilestone: {
        id: secondMilestone.id
      }
    });
  });

  it("switches quick progress to Finished when it reaches the final milestone", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("finish-on-next-club");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const finalMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Finale"
    });
    repository.createMembership(user.id, club.id);

    await request(app)
      .patch("/api/clubs/finish-on-next-club/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: firstMilestone.id,
        mode: "BRAVE"
      })
      .expect(200);
    const response = await request(app)
      .post("/api/clubs/finish-on-next-club/progress/next")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.progress).toMatchObject({
      mode: "FINISHED",
      currentMilestone: {
        id: finalMilestone.id,
        safeTitle: "Finale"
      },
      completedMilestones: 2,
      totalMilestones: 2,
      percentage: 100
    });
    expect(repository.history[0]).toMatchObject({
      fromMode: "BRAVE",
      toMode: "FINISHED",
      fromMilestone: {
        id: firstMilestone.id
      },
      toMilestone: {
        id: finalMilestone.id
      }
    });
    expect(repository.progressRows[0]?.mode).toBe("FINISHED");
  });

  it("switches final quick progress to Finished without duplicate milestone movement", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("final-club");
    const finalMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Finale"
    });
    repository.createMembership(user.id, club.id);

    await request(app)
      .patch("/api/clubs/final-club/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: finalMilestone.id,
        mode: "BRAVE"
      })
      .expect(200);
    const historyCount = repository.history.length;
    const response = await request(app)
      .post("/api/clubs/final-club/progress/next")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.progress).toMatchObject({
      mode: "FINISHED",
      currentMilestone: {
        id: finalMilestone.id,
        safeTitle: "Finale"
      },
      completedMilestones: 1,
      totalMilestones: 1,
      percentage: 100
    });
    expect(repository.history).toHaveLength(historyCount + 1);
    expect(repository.history[0]).toMatchObject({
      fromMode: "BRAVE",
      toMode: "FINISHED",
      fromMilestone: {
        id: finalMilestone.id
      },
      toMilestone: {
        id: finalMilestone.id
      }
    });
    expect(repository.enqueuedProgressUnlockNotificationJobs).toHaveLength(
      historyCount + 1
    );
  });

  it("stores finished mode explicitly through progress updates", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("finished-club");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createMembership(user.id, club.id);

    const response = await request(app)
      .patch("/api/clubs/finished-club/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: milestone.id,
        mode: "FINISHED"
      })
      .expect(200);

    expect(response.body.progress).toMatchObject({
      mode: "FINISHED",
      completedMilestones: 1,
      percentage: 100
    });
    expect(repository.progressRows[0]?.mode).toBe("FINISHED");
  });

  it("allows Finished mode but keeps Brave conservative for normal visibility", () => {
    expect(
      canViewRequiredMilestone({
        mode: "FINISHED",
        currentMilestonePosition: 1,
        requiredMilestonePosition: 2
      })
    ).toBe(true);
    expect(
      canViewRequiredMilestone({
        mode: "BRAVE",
        currentMilestonePosition: 1,
        requiredMilestonePosition: 2
      })
    ).toBe(false);
  });

  it("rejects progress updates from club non-members", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("public-story-circle");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });

    const response = await request(app)
      .patch("/api/clubs/public-story-circle/progress")
      .set("Cookie", await createSessionCookie(user))
      .set("x-request-id", "progress-nonmember")
      .send({
        currentMilestoneId: milestone.id,
        mode: "STRICT"
      })
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Join this club before updating your progress.",
        requestId: "progress-nonmember"
      }
    });
    expect(repository.progressRows).toHaveLength(0);
  });

  it("rejects quick progress from club non-members", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("public-story-circle");
    repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });

    const response = await request(app)
      .post("/api/clubs/public-story-circle/progress/next")
      .set("Cookie", await createSessionCookie(user))
      .set("x-request-id", "progress-next-nonmember")
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Join this club before updating your progress.",
        requestId: "progress-next-nonmember"
      }
    });
    expect(repository.progressRows).toHaveLength(0);
  });

  it("rejects progress reads from club non-members", async () => {
    const user = repository.createStoredUser(validUserInput());
    repository.createClub("public-story-circle");

    const response = await request(app)
      .get("/api/clubs/public-story-circle/progress")
      .set("Cookie", await createSessionCookie(user))
      .set("x-request-id", "progress-read-nonmember")
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Join this club to view progress.",
        requestId: "progress-read-nonmember"
      }
    });
  });

  it("rejects milestones from another club", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("public-story-circle");
    const otherClub = repository.createClub("other-story-circle");
    const otherMilestone = repository.createMilestone(otherClub.id, {
      position: 1,
      safeTitle: "Other opening"
    });
    repository.createMembership(user.id, club.id);

    const response = await request(app)
      .patch("/api/clubs/public-story-circle/progress")
      .set("Cookie", await createSessionCookie(user))
      .set("x-request-id", "progress-wrong-milestone")
      .send({
        currentMilestoneId: otherMilestone.id,
        mode: "STRICT"
      })
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Choose a club milestone.",
        requestId: "progress-wrong-milestone"
      }
    });
  });

  it("rejects invalid link names and progress bodies", async () => {
    const user = repository.createStoredUser(validUserInput());

    await request(app)
      .get("/api/clubs/Invalid Link Name/progress")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    await request(app)
      .patch("/api/clubs/public-story-circle/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: null,
        mode: "FAST"
      })
      .expect(400);

    await request(app)
      .patch("/api/clubs/public-story-circle/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: null,
        mode: "SOFT"
      })
      .expect(400);
  });

  it("returns narrow spoiler-safe progress DTO fields", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("public-story-circle");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Safe checkpoint",
      fullTitle: "The unsafe reveal",
      spoilerName: true
    });
    repository.createMembership(user.id, club.id);

    const response = await request(app)
      .patch("/api/clubs/public-story-circle/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: milestone.id,
        mode: "STRICT"
      })
      .expect(200);

    expect(Object.keys(response.body.progress).sort()).toEqual([
      "completedMilestones",
      "currentMilestone",
      "history",
      "id",
      "mode",
      "needsWelcomeSetup",
      "onboardingCompletedAt",
      "percentage",
      "totalMilestones",
      "updatedAt"
    ]);
    expect(Object.keys(response.body.progress.currentMilestone).sort()).toEqual([
      "fullTitle",
      "id",
      "isFullTitleHidden",
      "position",
      "safeTitle"
    ]);
    expect(response.body.progress.currentMilestone).toMatchObject({
      fullTitle: "The unsafe reveal",
      isFullTitleHidden: false,
      safeTitle: "Safe checkpoint"
    });
  });

  it("keeps future spoiler milestone titles hidden in progress history", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("history-spoiler-club");
    const openingMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Safe opening",
      fullTitle: "Real opening title",
      spoilerName: true
    });
    const futureMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Safe future",
      fullTitle: "Future hidden title",
      spoilerName: true
    });
    repository.createMembership(user.id, club.id);

    await request(app)
      .patch("/api/clubs/history-spoiler-club/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: futureMilestone.id,
        mode: "STRICT"
      })
      .expect(200);
    const response = await request(app)
      .patch("/api/clubs/history-spoiler-club/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: openingMilestone.id,
        mode: "STRICT"
      })
      .expect(200);

    expect(response.body.progress.currentMilestone).toMatchObject({
      fullTitle: "Real opening title",
      isFullTitleHidden: false,
      safeTitle: "Safe opening"
    });
    expect(response.body.progress.history[0].fromMilestone).toMatchObject({
      id: futureMilestone.id,
      fullTitle: null,
      isFullTitleHidden: true,
      safeTitle: "Safe future"
    });
    expect(JSON.stringify(response.body)).not.toContain("Future hidden title");
  });
});

const createProgressTestApp = (
  repository: AuthUsersRepository & ProgressRepository
) => {
  const app = express();
  const authService = createAuthService(repository);
  const authMiddleware = createAuthMiddleware(authService);
  const progressService = createProgressService(repository);
  const progressController = createProgressController(progressService);

  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/clubs", createProgressRouter(progressController, authMiddleware));
  app.use(errorHandler);

  return app;
};

type StoredClub = {
  id: string;
  linkName: string;
};

type StoredProgress = {
  id: string;
  userId: string;
  clubId: string;
  currentMilestoneId: string | null;
  mode: ProgressMode;
  onboardingCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type StoredProgressHistory = ProgressHistoryRecord & {
  userId: string;
  clubId: string;
};

class InMemoryProgressRepository
  implements AuthUsersRepository, ProgressRepository
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
  readonly milestones: Array<ProgressMilestoneRecord & { clubId: string }> = [];
  readonly progressRows: StoredProgress[] = [];
  readonly history: StoredProgressHistory[] = [];
  readonly enqueuedProgressUnlockNotificationJobs: Array<{
    progressHistoryId: string;
  }> = [];

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

  createClub = (linkName: string) => {
    const club = {
      id: crypto.randomUUID(),
      linkName
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

  createMilestone = (
    clubId: string,
    input: Partial<ProgressMilestoneRecord> &
      Pick<ProgressMilestoneRecord, "position" | "safeTitle">
  ) => {
    const milestone = {
      id: crypto.randomUUID(),
      clubId,
      fullTitle: null,
      spoilerName: false,
      ...input
    };

    this.milestones.push(milestone);

    return milestone;
  };

  findClubForProgress = async (
    linkName: string,
    userId: string
  ): Promise<ProgressClubRecord | null> => {
    const club = this.findStoredClubByLinkName(linkName);

    if (!club) {
      return null;
    }

    return {
      id: club.id,
      currentUserRole: this.findMembership(userId, club.id)?.role ?? null,
      isCurrentUserBanned: false
    };
  };

  getProgressForUserClub = async (
    userId: string,
    clubId: string
  ): Promise<ClubProgressRecord> => {
    const progress = this.findProgress(userId, clubId);

    return this.toClubProgressRecord(userId, clubId, progress);
  };

  advanceProgressToNextMilestoneForUserClub = async (
    userId: string,
    clubId: string
  ): Promise<ClubProgressRecord> => {
    const existingProgress = this.findProgress(userId, clubId);
    const currentMilestone = this.findMilestone(
      existingProgress?.currentMilestoneId ?? null
    );
    const currentPosition = currentMilestone?.position ?? null;
    const nextMilestone = this.milestones
      .filter(
        (milestone) =>
          milestone.clubId === clubId &&
          (currentPosition === null || milestone.position > currentPosition)
      )
      .sort((firstMilestone, secondMilestone) => {
        return firstMilestone.position - secondMilestone.position;
      })[0];

    if (!nextMilestone) {
      const mode = existingProgress?.mode ?? "STRICT";

      if (
        existingProgress &&
        currentPosition !== null &&
        (mode !== "FINISHED" || !existingProgress.onboardingCompletedAt)
      ) {
        const now = new Date();

        existingProgress.mode = "FINISHED";
        existingProgress.onboardingCompletedAt ??= now;
        existingProgress.updatedAt = now;
      }

      if (existingProgress && currentPosition !== null && mode !== "FINISHED") {
        const now = existingProgress.updatedAt;
        const fromMilestoneId = existingProgress.currentMilestoneId;

        const progressHistory = {
          id: crypto.randomUUID(),
          userId,
          clubId,
          fromMode: mode,
          toMode: "FINISHED" as ProgressMode,
          fromMilestone: this.findMilestone(fromMilestoneId),
          toMilestone: this.findMilestone(fromMilestoneId),
          createdAt: now
        };

        this.history.unshift(progressHistory);
        this.enqueuedProgressUnlockNotificationJobs.push({
          progressHistoryId: progressHistory.id
        });
      }

      return this.toClubProgressRecord(userId, clubId, existingProgress);
    }

    const mode = existingProgress?.mode ?? "STRICT";
    const fromMilestoneId = existingProgress?.currentMilestoneId ?? null;
    const hasLaterMilestone = this.milestones.some(
      (milestone) =>
        milestone.clubId === clubId && milestone.position > nextMilestone.position
    );
    const nextMode: ProgressMode = hasLaterMilestone ? mode : "FINISHED";
    const now = new Date();
    const progress =
      existingProgress ??
      {
        id: crypto.randomUUID(),
        userId,
        clubId,
        currentMilestoneId: null,
        mode: nextMode,
        onboardingCompletedAt: now,
        createdAt: now,
        updatedAt: now
      };

    progress.currentMilestoneId = nextMilestone.id;
    progress.mode = nextMode;
    progress.onboardingCompletedAt ??= now;
    progress.updatedAt = now;

    if (!existingProgress) {
      this.progressRows.push(progress);
    }

    const progressHistory = {
      id: crypto.randomUUID(),
      userId,
      clubId,
      fromMode: mode,
      toMode: nextMode,
      fromMilestone: this.findMilestone(fromMilestoneId),
      toMilestone: this.findMilestone(nextMilestone.id),
      createdAt: now
    };

    this.history.unshift(progressHistory);
    this.enqueuedProgressUnlockNotificationJobs.push({
      progressHistoryId: progressHistory.id
    });

    return this.toClubProgressRecord(userId, clubId, progress);
  };

  updateProgressForUserClub = async (
    userId: string,
    clubId: string,
    input: UpdateProgressRequest
  ): Promise<ClubProgressRecord | null> => {
    if (
      input.currentMilestoneId &&
      !this.milestones.some(
        (milestone) =>
          milestone.id === input.currentMilestoneId && milestone.clubId === clubId
      )
    ) {
      return null;
    }

    const existingProgress = this.findProgress(userId, clubId);
    const fromMode = existingProgress?.mode ?? "STRICT";
    const fromMilestoneId = existingProgress?.currentMilestoneId ?? null;
    const hasChanged =
      fromMode !== input.mode ||
      fromMilestoneId !== input.currentMilestoneId;
    const now = new Date();
    const progress =
      existingProgress ??
      {
        id: crypto.randomUUID(),
        userId,
        clubId,
        currentMilestoneId: null,
        mode: "STRICT" as ProgressMode,
        onboardingCompletedAt: now,
        createdAt: now,
        updatedAt: now
      };

    progress.currentMilestoneId = input.currentMilestoneId;
    progress.mode = input.mode;
    progress.onboardingCompletedAt ??= now;
    progress.updatedAt = now;

    if (!existingProgress) {
      this.progressRows.push(progress);
    }

    if (hasChanged) {
      const progressHistory = {
        id: crypto.randomUUID(),
        userId,
        clubId,
        fromMode,
        toMode: input.mode,
        fromMilestone: this.findMilestone(fromMilestoneId),
        toMilestone: this.findMilestone(input.currentMilestoneId),
        createdAt: now
      };

      this.history.unshift(progressHistory);
      this.enqueuedProgressUnlockNotificationJobs.push({
        progressHistoryId: progressHistory.id
      });
    }

    return this.toClubProgressRecord(userId, clubId, progress);
  };

  listRecentlyUnlockedPostsForUserClub = async (
    userId: string,
    clubId: string,
    _input: ListRecentlyUnlockedInput
  ): Promise<RecentlyUnlockedRecord> => {
    const progress = this.findProgress(userId, clubId);
    const currentMilestone = this.findMilestone(
      progress?.currentMilestoneId ?? null
    );

    return {
      unlock: {
        historyId: null,
        fromPosition: 0,
        toPosition: 0,
        unlockedAt: null
      },
      posts: [],
      nextCursor: null,
      hasMore: false,
      currentProgress: {
        mode: progress?.mode ?? "STRICT",
        currentMilestonePosition: currentMilestone?.position ?? null
      }
    };
  };

  private toClubProgressRecord = (
    userId: string,
    clubId: string,
    progress: StoredProgress | undefined
  ): ClubProgressRecord => ({
    id: progress?.id ?? null,
    mode: progress?.mode ?? "STRICT",
    currentMilestone: this.findMilestone(progress?.currentMilestoneId ?? null),
    totalMilestones: this.milestones.filter(
      (milestone) => milestone.clubId === clubId
    ).length,
    history: this.history
      .filter(
        (historyRow) =>
          historyRow.userId === userId && historyRow.clubId === clubId
      )
      .slice(0, 5),
    onboardingCompletedAt: progress?.onboardingCompletedAt ?? null,
    updatedAt: progress?.updatedAt ?? null
  });

  private findStoredClubByLinkName = (linkName: string) => {
    for (const club of this.clubs.values()) {
      if (club.linkName === linkName) {
        return club;
      }
    }

    return null;
  };

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

    const milestone = this.milestones.find(
      (storedMilestone) => storedMilestone.id === milestoneId
    );

    if (!milestone) {
      return null;
    }

    const { clubId: _clubId, ...milestoneRecord } = milestone;

    return milestoneRecord;
  };
}

const createSessionCookie = async (user: AuthUserRecord) => {
  const token = await createSessionToken({
    userId: user.id,
    sessionVersion: user.sessionVersion
  });

  return `${env.SESSION_COOKIE_NAME}=${token}`;
};

const validUserInput = () => ({
  email: "reader@example.com",
  displayName: "Reader",
  passwordHash: "$argon2id$v=19$hash"
});
