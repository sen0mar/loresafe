import type { Server } from "node:http";

import type { AppEnv } from "../../config/env.js";

export const applyServerTimeouts = (
  server: Pick<Server, "headersTimeout" | "keepAliveTimeout" | "requestTimeout">,
  appEnv: AppEnv
) => {
  server.headersTimeout = appEnv.SERVER_HEADERS_TIMEOUT_MS;
  server.requestTimeout = appEnv.SERVER_REQUEST_TIMEOUT_MS;
  server.keepAliveTimeout = appEnv.SERVER_KEEP_ALIVE_TIMEOUT_MS;
};
