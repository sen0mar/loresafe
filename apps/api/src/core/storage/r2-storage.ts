import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
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
  checkReady?: () => Promise<void>;
  createPresignedRead: (objectKey: string) => Promise<PresignedRead>;
  createPresignedUpload: (input: {
    contentLength: number;
    contentType: string;
    objectKey: string;
  }) => Promise<PresignedUpload>;
  deleteObjects: (objectKeys: string[]) => Promise<void>;
  getObjectMetadata: (
    objectKey: string
  ) => Promise<StoredObjectMetadata | null>;
  getObjectBytes: (objectKey: string, maxBytes: number) => Promise<Uint8Array>;
  getPublicUrl: (objectKey: string) => string;
};

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID ?? ""}.r2.cloudflarestorage.com`,
  requestChecksumCalculation: "WHEN_REQUIRED",
  requestHandler: {
    connectionTimeout: env.R2_CONNECTION_TIMEOUT_MS,
    requestTimeout: env.R2_REQUEST_TIMEOUT_MS
  },
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? ""
  }
});

export const r2Storage: ObjectStorage = {
  checkReady: async () => {
    await r2Client.send(new HeadBucketCommand({ Bucket: env.R2_BUCKET_NAME }));
  },

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

  createPresignedUpload: async ({ contentLength, contentType, objectKey }) => {
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
      ContentLength: contentLength
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

  deleteObjects: async (objectKeys) => {
    const uniqueObjectKeys = [...new Set(objectKeys)].filter(Boolean);

    for (let index = 0; index < uniqueObjectKeys.length; index += 1000) {
      const chunk = uniqueObjectKeys.slice(index, index + 1000);

      if (chunk.length === 0) {
        continue;
      }

      await r2Client.send(
        new DeleteObjectsCommand({
          Bucket: env.R2_BUCKET_NAME,
          Delete: {
            Objects: chunk.map((objectKey) => ({
              Key: objectKey
            })),
            Quiet: true
          }
        })
      );
    }
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

  getObjectBytes: async (objectKey, maxBytes) => {
    const response = await r2Client.send(
      new GetObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: objectKey
      })
    );
    const bytes = await response.Body?.transformToByteArray();

    if (!bytes) {
      throw new Error("Stored object body was empty.");
    }

    if (bytes.byteLength > maxBytes) {
      throw new Error("Stored object exceeds the allowed size.");
    }

    return bytes;
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
