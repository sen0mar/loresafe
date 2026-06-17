import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { errorHandler } from "../../core/http/error-middleware.js";
import { requestIdMiddleware } from "../../core/http/request-id.js";
import { createSessionToken } from "../../core/security/session-token.js";
import type { ObjectStorage } from "../../core/storage/r2-storage.js";
import { createAuthMiddleware } from "../auth/auth.middleware.js";
import {
  type AuthUserCredentialsRecord,
  type AuthUserRecord,
  type AuthUsersRepository,
  type CreateAuthUserInput
} from "../auth/auth.repository.js";
import { createAuthService } from "../auth/auth.service.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import type { ClubPostRecord } from "../posts/posts.repository.js";
import { createSearchController } from "./search.controller.js";
import type {
  SearchClubRecord,
  SearchPostRecord,
  SearchRepository,
  SearchResult
} from "./search.repository.js";
import { createSearchRouter } from "./search.routes.js";
import { createSearchService } from "./search.service.js";

describe("search routes", () => {
  let repository: InMemorySearchRepository;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemorySearchRepository();
    app = createSearchTestApp(repository);
  });

  it("rejects search without an authenticated session", async () => {
    const response = await request(app)
      .get("/api/search?q=story")
      .set("x-request-id", "search-missing-session")
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "search-missing-session"
      }
    });
  });

  it("validates scope, limit, and malformed cursors", async () => {
    const user = repository.createStoredUser(validUserInput());
    const cookie = await createSessionCookie(user);

    await request(app)
      .get("/api/search?q=story&scope=members")
      .set("Cookie", cookie)
      .expect(400);

    await request(app)
      .get("/api/search?q=story&limit=100")
      .set("Cookie", cookie)
      .expect(400);

    const response = await request(app)
      .get("/api/search?q=story&cursor=not-a-cursor")
      .set("Cookie", cookie)
      .set("x-request-id", "search-bad-cursor")
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Check the search request and try again.",
      requestId: "search-bad-cursor"
    });
  });

  it("returns a useful empty response for blank search", async () => {
    const user = repository.createStoredUser(validUserInput());

    const response = await request(app)
      .get("/api/search?q=%20%20&scope=all")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body).toEqual({
      query: "",
      scope: "all",
      clubs: [],
      posts: [],
      pagination: {
        limit: 10,
        nextCursor: null,
        hasMore: false
      }
    });
  });

  it("hides private clubs from non-members and returns them to members", async () => {
    const member = repository.createStoredUser(validUserInput());
    const outsider = repository.createStoredUser({
      ...validUserInput(),
      email: "outsider@example.com"
    });
    const publicClub = repository.createClub({
      title: "Nebula Readers",
      slug: "nebula-readers",
      visibility: "PUBLIC"
    });
    const privateClub = repository.createClub({
      title: "Nebula Private",
      slug: "nebula-private",
      visibility: "PRIVATE"
    });
    repository.createMembership(member.id, privateClub.id);

    const outsiderResponse = await request(app)
      .get("/api/search?q=nebula&scope=clubs")
      .set("Cookie", await createSessionCookie(outsider))
      .expect(200);

    expect(outsiderResponse.body.clubs).toEqual([
      expect.objectContaining({
        id: publicClub.id,
        visibility: "PUBLIC"
      })
    ]);
    expect(JSON.stringify(outsiderResponse.body)).not.toContain("Nebula Private");
    expect(JSON.stringify(outsiderResponse.body)).not.toContain("nebula-private");

    const memberResponse = await request(app)
      .get("/api/search?q=nebula&scope=clubs")
      .set("Cookie", await createSessionCookie(member))
      .expect(200);

    expect(memberResponse.body.clubs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: publicClub.id,
          visibility: "PUBLIC"
        }),
        expect.objectContaining({
          id: privateClub.id,
          visibility: "PRIVATE"
        })
      ])
    );
  });

  it("returns locked post results without future content snippets", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub({
      title: "Spoiler Club",
      slug: "spoiler-club",
      visibility: "PUBLIC"
    });
    const opening = repository.createMilestone(club.id, 1, "Opening");
    const future = repository.createMilestone(club.id, 2, "Future checkpoint");
    repository.setProgress(user.id, club.id, opening.id, "STRICT");
    repository.createPost(club.id, user.id, future.id, {
      title: "Late twist title",
      body: "Future phrase hidden in the body."
    });

    const response = await request(app)
      .get("/api/search?q=future%20phrase&scope=posts")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.posts).toHaveLength(1);
    expect(response.body.posts[0]).toMatchObject({
      visibility: "LOCKED",
      requiredMilestone: {
        id: future.id,
        position: 2,
        label: "Future checkpoint"
      }
    });
    expect(response.body.posts[0]).not.toHaveProperty("title");
    expect(response.body.posts[0]).not.toHaveProperty("bodyPreview");
    expect(response.body.posts[0]).not.toHaveProperty("author");
    expect(JSON.stringify(response.body.posts)).not.toContain("Late twist title");
    expect(JSON.stringify(response.body.posts)).not.toContain(
      "Future phrase hidden"
    );
  });

  it("returns visible post cards for safe matching discussions", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub({
      title: "Safe Club",
      slug: "safe-club",
      visibility: "PUBLIC"
    });
    const milestone = repository.createMilestone(club.id, 1, "Opening");
    repository.setProgress(user.id, club.id, milestone.id, "STRICT");
    const post = repository.createPost(club.id, user.id, milestone.id, {
      title: "Lantern theory",
      body: "The lantern matters here."
    });

    const response = await request(app)
      .get("/api/search?q=lantern&scope=posts")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.posts).toEqual([
      expect.objectContaining({
        id: post.id,
        visibility: "VISIBLE",
        title: "Lantern theory",
        bodyPreview: "The lantern matters here.",
        author: expect.objectContaining({
          id: user.id,
          displayName: "Reader"
        })
      })
    ]);
  });

  it("excludes hidden and deleted posts", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub({
      title: "Archive Club",
      slug: "archive-club",
      visibility: "PUBLIC"
    });
    const milestone = repository.createMilestone(club.id, 1, "Opening");
    repository.setProgress(user.id, club.id, milestone.id, "STRICT");
    repository.createPost(club.id, user.id, milestone.id, {
      title: "Hidden archive match",
      body: "archive",
      status: "HIDDEN"
    });
    repository.createPost(club.id, user.id, milestone.id, {
      title: "Deleted archive match",
      body: "archive",
      deletedAt: new Date()
    });

    const response = await request(app)
      .get("/api/search?q=archive&scope=posts")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.posts).toEqual([]);
  });
});

const createSearchTestApp = (
  repository: AuthUsersRepository & SearchRepository,
  storage: Pick<ObjectStorage, "createPresignedRead"> = new FakeReadStorage()
) => {
  const app = express();
  const authService = createAuthService(repository);
  const authMiddleware = createAuthMiddleware(authService);
  const searchService = createSearchService(repository, storage);
  const searchController = createSearchController(searchService);

  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/search", createSearchRouter(searchController, authMiddleware));
  app.use(errorHandler);

  return app;
};

class FakeReadStorage implements Pick<ObjectStorage, "createPresignedRead"> {
  createPresignedRead = async (objectKey: string) => ({
    readUrl: `https://reads.example/${objectKey}`,
    expiresAt: new Date("2026-06-16T12:05:00.000Z")
  });
}

type StoredClub = SearchClubRecord & {
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
};

type StoredMilestone = {
  id: string;
  clubId: string;
  position: number;
  safeTitle: string;
};

type StoredPost = ClubPostRecord & {
  clubId: string;
  requiredMilestoneId: string;
  deletedAt: Date | null;
};

class InMemorySearchRepository
  implements AuthUsersRepository, SearchRepository
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
  readonly milestones = new Map<string, StoredMilestone>();
  readonly progressRows: Array<{
    userId: string;
    clubId: string;
    milestoneId: string | null;
    mode: ProgressMode;
  }> = [];
  readonly posts: StoredPost[] = [];

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

  searchClubs = async (
    query: string,
    userId: string,
    { limit, offset }: { limit: number; offset: number }
  ): Promise<SearchResult<SearchClubRecord>> => {
    const matches = Array.from(this.clubs.values())
      .filter((club) => this.canViewClub(club, userId))
      .filter((club) =>
        [club.title, club.description, club.category, club.slug]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(query.toLowerCase()))
      );
    const page = matches.slice(offset, offset + limit + 1);

    return {
      records: page.slice(0, limit),
      hasMore: page.length > limit
    };
  };

  searchPosts = async (
    query: string,
    userId: string,
    { limit, offset }: { limit: number; offset: number }
  ): Promise<SearchResult<SearchPostRecord>> => {
    const matches = this.posts
      .filter((post) => post.status === "VISIBLE" && !post.deletedAt)
      .filter((post) => {
        const club = this.clubs.get(post.clubId);

        return club ? this.canViewClub(club, userId) : false;
      })
      .filter((post) =>
        [post.title, post.body].some((value) =>
          value.toLowerCase().includes(query.toLowerCase())
        )
      );
    const page = matches.slice(offset, offset + limit + 1);

    return {
      records: page.slice(0, limit).map((post) => ({
        post,
        club: this.toSearchPostClub(post.clubId, userId)
      })),
      hasMore: page.length > limit
    };
  };

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

  createClub = ({
    slug,
    title,
    visibility
  }: {
    slug: string;
    title: string;
    visibility: StoredClub["visibility"];
  }) => {
    const now = new Date();
    const club: StoredClub = {
      id: crypto.randomUUID(),
      title,
      slug,
      description: null,
      category: "Book",
      coverAsset: null,
      visibility,
      memberCount: 0,
      createdAt: now,
      updatedAt: now
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
    const club = this.clubs.get(clubId);

    if (club) {
      club.memberCount += 1;
    }
  };

  createMilestone = (clubId: string, position: number, safeTitle: string) => {
    const milestone = {
      id: crypto.randomUUID(),
      clubId,
      position,
      safeTitle
    };

    this.milestones.set(milestone.id, milestone);

    return milestone;
  };

  setProgress = (
    userId: string,
    clubId: string,
    milestoneId: string | null,
    mode: ProgressMode
  ) => {
    this.progressRows.push({
      userId,
      clubId,
      milestoneId,
      mode
    });
  };

  createPost = (
    clubId: string,
    authorId: string,
    requiredMilestoneId: string,
    overrides: Partial<Pick<StoredPost, "body" | "deletedAt" | "status" | "title">>
  ) => {
    const now = new Date();
    const milestone = this.milestones.get(requiredMilestoneId);

    if (!milestone) {
      throw new Error("Milestone not found");
    }

    const author = Array.from(this.usersByEmail.values()).find(
      (user) => user.id === authorId
    );

    if (!author) {
      throw new Error("Author not found");
    }

    const post: StoredPost = {
      id: crypto.randomUUID(),
      clubId,
      requiredMilestoneId,
      type: "DISCUSSION",
      status: overrides.status ?? "VISIBLE",
      title: overrides.title ?? "Searchable title",
      body: overrides.body ?? "Searchable body",
      author: {
        id: author.id,
        displayName: author.displayName,
        username: author.username
      },
      requiredMilestone: {
        id: milestone.id,
        position: milestone.position,
        safeTitle: milestone.safeTitle
      },
      prediction: null,
      media: null,
      commentCount: 0,
      reactionCount: 0,
      reactions: [],
      deletedAt: overrides.deletedAt ?? null,
      createdAt: now,
      updatedAt: now
    };

    this.posts.push(post);

    return post;
  };

  private canViewClub = (club: StoredClub, userId: string) =>
    club.visibility === "PUBLIC" ||
    this.memberships.some(
      (membership) =>
        membership.clubId === club.id && membership.userId === userId
    );

  private toSearchPostClub = (
    clubId: string,
    userId: string
  ): SearchPostRecord["club"] => {
    const club = this.clubs.get(clubId);
    const membership =
      this.memberships.find(
        (currentMembership) =>
          currentMembership.clubId === clubId &&
          currentMembership.userId === userId
      ) ?? null;
    const progress = this.progressRows.find(
      (currentProgress) =>
        currentProgress.clubId === clubId && currentProgress.userId === userId
    );
    const currentMilestone = progress?.milestoneId
      ? this.milestones.get(progress.milestoneId)
      : null;

    if (!club) {
      throw new Error("Club not found");
    }

    return {
      id: club.id,
      slug: club.slug,
      title: club.title,
      visibility: club.visibility,
      currentUserRole: membership?.role ?? null,
      progress: {
        mode: progress?.mode ?? "STRICT",
        currentMilestonePosition: currentMilestone?.position ?? null
      }
    };
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
