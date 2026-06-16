import { registerNotificationJobHandlers } from "./notification-job-handlers.js";
import {
  startNotificationJobQueue,
  stopNotificationJobQueue
} from "./notification-job-queue.js";

export const startNotificationJobs = async () => {
  await startNotificationJobQueue();
  await registerNotificationJobHandlers();
};

export const stopNotificationJobs = stopNotificationJobQueue;

