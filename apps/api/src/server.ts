import { app } from "./app.js";
import { env } from "./config/env.js";
import {
  startNotificationJobs,
  stopNotificationJobs
} from "./jobs/notification-jobs.js";

let server: ReturnType<typeof app.listen> | null = null;

const shutdown = async (signal: NodeJS.Signals) => {
  console.log(`${signal} received, closing API server`);

  try {
    await stopNotificationJobs();
  } catch (error) {
    console.error("Notification jobs failed to stop cleanly");
    process.exit(1);
  }

  if (!server) {
    process.exit(0);
  }

  server.close((error) => {
    if (error) {
      console.error("API server failed to close cleanly");
      process.exit(1);
    }

    process.exit(0);
  });
};

const startServer = async () => {
  await startNotificationJobs();
  server = app.listen(env.PORT, () => {
    console.log(
      `${env.APP_NAME} API listening on http://localhost:${env.PORT}`
    );
  });
};

startServer().catch((error) => {
  console.error("API server failed to start", error);
  process.exit(1);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
