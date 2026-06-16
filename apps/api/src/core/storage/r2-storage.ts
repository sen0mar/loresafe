import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../../config/env.js";

export type PresignedUpload = {
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: Date;
};

export type PresignedRead = {
  readUrl: string;
  expiresAt: Date;
};

export type StoredObjectMetadata = {
  contentLength: number | null;
  contentType: string | null;
};

export type ObjectStorage = {
  createPresignedRead: (objectKey: string) => Promise<PresignedRead>;
  createPresignedUpload: (input: {
    contentType: string;
    objectKey: string;
  }) => Promise<PresignedUpload>;
  getObjectMetadata: (objectKey: string) => Promise<StoredObjectMetadata | null>;
  getPublicUrl: (objectKey: string) => string;
};

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID ?? ""}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? ""
  }
});

export const r2Storage: ObjectStorage = {
  createPresignedRead: async (objectKey) => {
    const command = new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: objectKey
    });
    const expiresIn = env.R2_PRESIGNED_URL_TTL_SECONDS;
    const readUrl = await getSignedUrl(r2Client, command, { expiresIn });

    return {
      readUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000)
    };
  },

  createPresignedUpload: async ({ contentType, objectKey }) => {
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType
    });
    const expiresIn = env.R2_PRESIGNED_URL_TTL_SECONDS;
    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });

    return {
      uploadUrl,
      requiredHeaders: {
        "Content-Type": contentType
      },
      expiresAt: new Date(Date.now() + expiresIn * 1000)
    };
  },

  getObjectMetadata: async (objectKey) => {
    try {
      const response = await r2Client.send(
        new HeadObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: objectKey
        })
      );

      return {
        contentLength: response.ContentLength ?? null,
        contentType: response.ContentType ?? null
      };
    } catch (error) {
      if (isNotFoundStorageError(error)) {
        return null;
      }

      throw error;
    }
  },

  getPublicUrl: (objectKey) =>
    `${(env.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "")}/${objectKey}`
};

const isNotFoundStorageError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };

  return (
    maybeError.$metadata?.httpStatusCode === 404 ||
    maybeError.name === "NotFound" ||
    maybeError.name === "NoSuchKey"
  );
};
