import "./core/monitoring/sentry.js";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger, sanitizeError } from "./core/logging/logger.js";
import { applyServerTimeouts } from "./core/http/server-timeouts.js";

let server: ReturnType<typeof app.listen> | null = null;

const shutdown = async (signal: NodeJS.Signals) => {
  logger.info("Shutdown signal received", { signal });

  if (!server) {
    process.exit(0);
  }

  server.close((error) => {
    if (error) {
      logger.error("API server failed to close cleanly", {
        error: sanitizeError(error)
      });
      process.exit(1);
    }

    process.exit(0);
  });
};

const startServer = async () => {
  server = app.listen(env.PORT, () => {
    logger.info("API server listening", {
      appName: env.APP_NAME,
      port: env.PORT
    });
  });
  applyServerTimeouts(server, env);
};

startServer().catch((error) => {
  logger.error("API server failed to start", {
    error: sanitizeError(error)
  });
  process.exit(1);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
