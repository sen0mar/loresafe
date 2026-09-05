// Final destinations are persisted before publication so a transaction rollback
// leaves both objects discoverable by the existing request-driven cleanup.
export const getUploadStagingKey = (finalObjectKey: string) =>
  `staging/uploads/${finalObjectKey}`;

export const usesUploadStaging = (objectKey: string) =>
  /^(public\/(avatars|club-covers)|private\/post-images)\/[^/]+\/final\/[^/]+$/.test(
    objectKey
  );

export const getUploadCleanupKeys = (objectKey: string) =>
  usesUploadStaging(objectKey)
    ? [objectKey, getUploadStagingKey(objectKey)]
    : [objectKey];
