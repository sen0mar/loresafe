import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { errorHandler } from "../../core/http/error-middleware.js";
import { requestIdMiddleware } from "../../core/http/request-id.js";
import { createSessionToken } from "../../core/security/session-token.js";
import type { ObjectStorage, PresignedUpload } from "../../core/storage/r2-storage.js";
import { createAuthMiddleware } from "../auth/auth.middleware.js";
import type {
  AuthUserCredentialsRecord,
  AuthUserRecord,
  AuthUsersRepository,
  CreateAuthUserInput
} from "../auth/auth.repository.js";
import { createAuthService } from "../auth/auth.service.js";
import { createUploadsController } from "./uploads.controller.js";
import type {
  ClubMembershipRole,
  CreateFileAssetInput,
  FileAssetRecord,
  UploadClubRecord,
  UploadsRepository
} from "./uploads.repository.js";
import { createUploadsRouter } from "./uploads.routes.js";
import { createUploadsService } from "./uploads.service.js";

describe("uploads routes", () => {
  let repository: InMemoryUploadsRepository;
  let storage: FakeObjectStorage;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryUploadsRepository();
    storage = new FakeObjectStorage();
    app = createUploadsTestApp(repository, storage);
  });

  it("rejects upload intents without an authenticated session", async () => {
    const response = await request(app)
      .post("/api/uploads/public-assets")
      .set("x-request-id", "uploads-missing-session")
      .send(validAvatarIntent())
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "uploads-missing-session"
      }
    });
  });

  it("rejects invalid public asset file types and sizes before presigning", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    await request(app)
      .post("/api/uploads/public-assets")
      .set("Cookie", await createSessionCookie(user))
      .send({
        purpose: "AVATAR",
        contentType: "image/gif",
        sizeBytes: 128
      })
      .expect(400);

    await request(app)
      .post("/api/uploads/public-assets")
      .set("Cookie", await createSessionCookie(user))
      .send({
        purpose: "CLUB_COVER",
        clubLinkName: "story-room",
        contentType: "image/png",
        sizeBytes: 5 * 1024 * 1024 + 1
      })
      .expect(400);

    expect(storage.presignedUploads).toEqual([]);
    expect(repository.fileAssets.size).toBe(0);
  });

  it("rejects client-supplied object keys and generates avatar keys on the backend", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    await request(app)
      .post("/api/uploads/public-assets")
      .set("Cookie", await createSessionCookie(user))
      .send({
        ...validAvatarIntent(),
        objectKey: "public/avatars/not-allowed.png"
      })
      .expect(400);

    const response = await request(app)
      .post("/api/uploads/public-assets")
      .set("Cookie", await createSessionCookie(user))
      .send(validAvatarIntent())
      .expect(201);
    const createdAsset = repository.getOnlyAsset();

    expect(response.body).toEqual({
      asset: {
        id: createdAsset.id,
        purpose: "AVATAR",
        visibility: "PUBLIC",
        status: "PENDING",
        contentType: "image/png",
        sizeBytes: 128,
        safePreview: false,
        url: null,
        createdAt: createdAsset.createdAt.toISOString(),
        updatedAt: createdAsset.updatedAt.toISOString()
      },
      upload: {
        url: `https://uploads.example/${createdAsset.objectKey}`,
        method: "PUT",
        requiredHeaders: {
          "Content-Type": "image/png"
        },
        expiresAt: expect.any(String)
      }
    });
    expect(createdAsset.objectKey).toMatch(
      new RegExp(`^public/avatars/${user.id}/[a-f0-9-]+\\.png$`)
    );
    expect(response.body.asset).not.toHaveProperty("objectKey");
  });

  it("allows only club owners and moderators to create club cover uploads", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const member = await repository.createUser({
      email: "member@example.com",
      displayName: "Member",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub("story-room");
    repository.createMembership(owner.id, club.id, "OWNER");
    repository.createMembership(member.id, club.id, "MEMBER");

    await request(app)
      .post("/api/uploads/public-assets")
      .set("Cookie", await createSessionCookie(member))
      .send(validClubCoverIntent("story-room"))
      .expect(403);

    const response = await request(app)
      .post("/api/uploads/public-assets")
      .set("Cookie", await createSessionCookie(owner))
      .send(validClubCoverIntent("story-room"))
      .expect(201);
    const createdAsset = repository.getOnlyAsset();

    expect(response.body.asset.purpose).toBe("CLUB_COVER");
    expect(createdAsset.objectKey).toMatch(
      new RegExp(`^public/club-covers/${club.id}/[a-f0-9-]+\\.webp$`)
    );
  });

  it("allows club members to create private post image uploads", async () => {
    const member = await repository.createUser({
      email: "member@example.com",
      displayName: "Member",
      passwordHash: "$argon2id$v=19$hash"
    });
    const outsider = await repository.createUser({
      email: "outsider@example.com",
      displayName: "Outsider",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub("story-room");
    repository.createMembership(member.id, club.id, "MEMBER");

    await request(app)
      .post("/api/uploads/post-images")
      .set("Cookie", await createSessionCookie(outsider))
      .send(validPostImageIntent("story-room"))
      .expect(403);

    await request(app)
      .post("/api/uploads/post-images")
      .set("Cookie", await createSessionCookie(member))
      .send({
        ...validPostImageIntent("story-room"),
        objectKey: "private/not-allowed.png"
      })
      .expect(400);

    await request(app)
      .post("/api/uploads/post-images")
      .set("Cookie", await createSessionCookie(member))
      .send({
        ...validPostImageIntent("story-room"),
        safePreview: true
      })
      .expect(400);

    const response = await request(app)
      .post("/api/uploads/post-images")
      .set("Cookie", await createSessionCookie(member))
      .send(validPostImageIntent("story-room"))
      .expect(201);
    const createdAsset = repository.getOnlyAsset();

    expect(response.body.asset).toEqual({
      id: createdAsset.id,
      purpose: "POST_IMAGE",
      visibility: "PRIVATE",
      status: "PENDING",
      contentType: "image/jpeg",
      sizeBytes: 512,
      safePreview: false,
      url: null,
      createdAt: createdAsset.createdAt.toISOString(),
      updatedAt: createdAsset.updatedAt.toISOString()
    });
    expect(createdAsset.objectKey).toMatch(
      new RegExp(`^private/post-images/${club.id}/[a-f0-9-]+\\.jpg$`)
    );
    expect(response.body.asset).not.toHaveProperty("objectKey");
  });

  it("verifies uploaded object metadata before marking an avatar ready", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const createResponse = await request(app)
      .post("/api/uploads/public-assets")
      .set("Cookie", await createSessionCookie(user))
      .send(validAvatarIntent())
      .expect(201);
    const asset = repository.getOnlyAsset();

    await request(app)
      .post(`/api/uploads/${createResponse.body.asset.id}/complete`)
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    storage.metadata.set(asset.objectKey, {
      contentLength: 129,
      contentType: "image/png"
    });

    await request(app)
      .post(`/api/uploads/${asset.id}/complete`)
      .set("Cookie", await createSessionCookie(user))
      .expect(400);
    expect(repository.fileAssets.get(asset.id)?.status).toBe("FAILED");
  });

  it("marks matching uploads ready and attaches them to the owning resource", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub("story-room");
    repository.createMembership(owner.id, club.id, "OWNER");

    const avatarResponse = await request(app)
      .post("/api/uploads/public-assets")
      .set("Cookie", await createSessionCookie(owner))
      .send(validAvatarIntent())
      .expect(201);
    const avatar = repository.fileAssets.get(avatarResponse.body.asset.id);

    storage.metadata.set(avatar?.objectKey ?? "", {
      contentLength: 128,
      contentType: "image/png"
    });

    const completedAvatar = await request(app)
      .post(`/api/uploads/${avatarResponse.body.asset.id}/complete`)
      .set("Cookie", await createSessionCookie(owner))
      .expect(200);

    const coverResponse = await request(app)
      .post("/api/uploads/public-assets")
      .set("Cookie", await createSessionCookie(owner))
      .send(validClubCoverIntent("story-room"))
      .expect(201);
    const cover = repository.fileAssets.get(coverResponse.body.asset.id);

    storage.metadata.set(cover?.objectKey ?? "", {
      contentLength: 256,
      contentType: "image/webp"
    });

    const completedCover = await request(app)
      .post(`/api/uploads/${coverResponse.body.asset.id}/complete`)
      .set("Cookie", await createSessionCookie(owner))
      .expect(200);

    expect(completedAvatar.body.asset).toMatchObject({
      status: "READY",
      url: `https://assets.example/${avatar?.objectKey}`
    });
    expect(completedCover.body.asset).toMatchObject({
      status: "READY",
      url: `https://assets.example/${cover?.objectKey}`
    });
    expect(repository.users.get(owner.id)?.avatarAssetId).toBe(avatar?.id);
    expect(repository.clubs.get(club.id)?.coverAssetId).toBe(cover?.id);
  });

  it("marks matching post image uploads ready without returning a public URL", async () => {
    const member = await repository.createUser({
      email: "member@example.com",
      displayName: "Member",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub("story-room");
    repository.createMembership(member.id, club.id, "MEMBER");
    const createResponse = await request(app)
      .post("/api/uploads/post-images")
      .set("Cookie", await createSessionCookie(member))
      .send(validPostImageIntent("story-room"))
      .expect(201);
    const postImage = repository.fileAssets.get(createResponse.body.asset.id);

    storage.metadata.set(postImage?.objectKey ?? "", {
      contentLength: 512,
      contentType: "image/jpeg"
    });

    const completedPostImage = await request(app)
      .post(`/api/uploads/${createResponse.body.asset.id}/complete`)
      .set("Cookie", await createSessionCookie(member))
      .expect(200);

    expect(completedPostImage.body.asset).toMatchObject({
      purpose: "POST_IMAGE",
      visibility: "PRIVATE",
      status: "READY",
      url: null
    });
    expect(repository.clubs.get(club.id)?.coverAssetId).toBeNull();
  });
});

const validAvatarIntent = () => ({
  purpose: "AVATAR",
  contentType: "image/png",
  sizeBytes: 128
});

const validClubCoverIntent = (clubLinkName: string) => ({
  purpose: "CLUB_COVER",
  clubLinkName,
  contentType: "image/webp",
  sizeBytes: 256
});

const validPostImageIntent = (clubLinkName: string) => ({
  clubLinkName,
  contentType: "image/jpeg",
  sizeBytes: 512
});

const createUploadsTestApp = (
  repository: InMemoryUploadsRepository,
  storage: FakeObjectStorage
) => {
  const app = express();
  const authService = createAuthService(repository);
  const authMiddleware = createAuthMiddleware(authService);
  const uploadsService = createUploadsService(repository, storage);
  const uploadsController = createUploadsController(uploadsService);

  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/uploads",
    createUploadsRouter(uploadsController, authMiddleware)
  );
  app.use(errorHandler);

  return app;
};

const createSessionCookie = async (user: AuthUserRecord) => {
  const token = await createSessionToken({
    userId: user.id,
    sessionVersion: user.sessionVersion
  });

  return `${env.SESSION_COOKIE_NAME}=${token}`;
};

type StoredUser = AuthUserCredentialsRecord & {
  avatarAssetId: string | null;
};

type StoredClub = {
  id: string;
  linkName: string;
  coverAssetId: string | null;
};

class InMemoryUploadsRepository
  implements AuthUsersRepository, UploadsRepository
{
  readonly users = new Map<string, StoredUser>();
  readonly clubs = new Map<string, StoredClub>();
  readonly fileAssets = new Map<string, FileAssetRecord>();
  readonly memberships: Array<{
    clubId: string;
    role: ClubMembershipRole;
    userId: string;
  }> = [];

  createUser = async ({ email, displayName, passwordHash }: CreateAuthUserInput) => {
    const now = new Date();
    const user: StoredUser = {
      id: randomUUID(),
      email,
      displayName,
      username: null,
      bio: null,
      avatarAsset: null,
      avatarAssetId: null,
      passwordHash,
      sessionVersion: 1,
      createdAt: now,
      updatedAt: now
    };

    this.users.set(user.id, user);
    return user;
  };

  findActiveUserByEmail = async (email: string) =>
    Array.from(this.users.values()).find((user) => user.email === email) ?? null;

  findActiveUserById = async (id: string) => this.users.get(id) ?? null;

  findActiveUserCredentialsByEmail = async (email: string) =>
    Array.from(this.users.values()).find((user) => user.email === email) ?? null;

  createClub = (linkName: string) => {
    const club = {
      id: randomUUID(),
      linkName,
      coverAssetId: null
    };

    this.clubs.set(club.id, club);
    return club;
  };

  createMembership = (
    userId: string,
    clubId: string,
    role: ClubMembershipRole
  ) => {
    this.memberships.push({
      userId,
      clubId,
      role
    });
  };

  createPendingFileAsset = async (input: CreateFileAssetInput) => {
    const now = new Date();
    const asset: FileAssetRecord = {
	      id: randomUUID(),
	      ownerId: input.ownerId,
	      clubId: input.clubId,
	      postId: null,
	      commentId: null,
	      purpose: input.purpose,
	      visibility: input.visibility ?? "PUBLIC",
	      safePreview: input.safePreview ?? false,
	      objectKey: input.objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      status: "PENDING",
      readyAt: null,
      createdAt: now,
      updatedAt: now
    };

    this.fileAssets.set(asset.id, asset);
    return asset;
  };

  findAssetById = async (assetId: string) =>
    this.fileAssets.get(assetId) ?? null;

  findClubByLinkNameForUser = async (
    linkName: string,
    userId: string
  ): Promise<UploadClubRecord | null> => {
    const club =
      Array.from(this.clubs.values()).find((candidate) => candidate.linkName === linkName) ??
      null;

    if (!club) {
      return null;
    }

    return {
	      id: club.id,
	      linkName: club.linkName,
	      currentUserRole:
	        this.memberships.find(
	          (membership) =>
	            membership.clubId === club.id && membership.userId === userId
	        )?.role ?? null,
	      isCurrentUserBanned: false
	    };
	  };

  markAssetFailed = async (assetId: string) => {
    const asset = this.fileAssets.get(assetId);

    if (!asset || asset.status !== "PENDING") {
      return null;
    }

    const failedAsset = {
      ...asset,
      status: "FAILED" as const,
      updatedAt: new Date()
    };
    this.fileAssets.set(assetId, failedAsset);
    return failedAsset;
  };

  markAssetReadyAndAttach = async (asset: FileAssetRecord, readyAt: Date) => {
    const readyAsset = {
      ...asset,
      status: "READY" as const,
      readyAt,
      updatedAt: readyAt
    };

    this.fileAssets.set(asset.id, readyAsset);

    if (asset.purpose === "AVATAR") {
      const user = this.users.get(asset.ownerId);

      if (user) {
        user.avatarAssetId = asset.id;
      }
	    } else if (asset.purpose === "CLUB_COVER" && asset.clubId) {
      const club = this.clubs.get(asset.clubId);

      if (club) {
        club.coverAssetId = asset.id;
      }
    }

    return readyAsset;
  };

  getOnlyAsset = () => {
    const assets = Array.from(this.fileAssets.values());

    expect(assets).toHaveLength(1);
    return assets[0];
  };
}

class FakeObjectStorage implements ObjectStorage {
  readonly metadata = new Map<
    string,
    {
      contentLength: number | null;
      contentType: string | null;
    }
  >();
	  readonly presignedUploads: Array<{
	    contentType: string;
	    objectKey: string;
	  }> = [];

	  createPresignedRead = async (objectKey: string) => ({
	    readUrl: `https://reads.example/${objectKey}`,
	    expiresAt: new Date("2026-06-16T12:05:00.000Z")
	  });

  createPresignedUpload = async ({
    contentType,
    objectKey
  }: {
    contentType: string;
    objectKey: string;
  }): Promise<PresignedUpload> => {
    this.presignedUploads.push({ contentType, objectKey });

    return {
      uploadUrl: `https://uploads.example/${objectKey}`,
      requiredHeaders: {
        "Content-Type": contentType
      },
      expiresAt: new Date("2026-06-16T12:05:00.000Z")
    };
  };

  getObjectMetadata = async (objectKey: string) =>
    this.metadata.get(objectKey) ?? null;

  deleteObjects = async (_objectKeys: string[]) => undefined;

  getPublicUrl = (objectKey: string) => `https://assets.example/${objectKey}`;
}
