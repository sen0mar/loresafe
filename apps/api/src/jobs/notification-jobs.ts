import { registerNotificationJobHandlers } from "./notification-job-handlers.js";
import {
  startNotificationJobQueue,
  stopNotificationJobQueue
} from "./notification-job-queue.js";
import { registerStorageObjectDeleteJobHandlers } from "./storage-object-delete-job-handlers.js";

export const startNotificationJobs = async () => {
  await startNotificationJobQueue();
  await Promise.all([
    registerNotificationJobHandlers(),
    registerStorageObjectDeleteJobHandlers()
  ]);
};

export const stopNotificationJobs = stopNotificationJobQueue;
