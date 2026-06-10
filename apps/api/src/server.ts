import { app } from "./app.js";
import { env } from "./config/env.js";

const shutdown = (signal: NodeJS.Signals) => {
  console.log(`${signal} received, closing API server`);

  server.close((error) => {
    if (error) {
      console.error("API server failed to close cleanly");
      process.exit(1);
    }

    process.exit(0);
  });
};

const server = app.listen(env.PORT, () => {
  console.log(`${env.APP_NAME} API listening on http://localhost:${env.PORT}`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
