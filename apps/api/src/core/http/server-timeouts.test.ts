import { describe, expect, it } from "vitest";

import { parseEnv } from "../../config/env.js";
import { applyServerTimeouts } from "./server-timeouts.js";

describe("server timeout budgets", () => {
  it("applies the validated HTTP timeout configuration", () => {
    const server = { headersTimeout: 0, keepAliveTimeout: 0, requestTimeout: 0 };
    const appEnv = parseEnv({
      DATABASE_URL: "postgresql://test:test@localhost:5432/loresafe_test",
      JWT_SECRET: "a".repeat(32),
      SERVER_HEADERS_TIMEOUT_MS: "12000",
      SERVER_KEEP_ALIVE_TIMEOUT_MS: "4000",
      SERVER_REQUEST_TIMEOUT_MS: "25000"
    });

    applyServerTimeouts(server, appEnv);

    expect(server).toEqual({
      headersTimeout: 12_000,
      keepAliveTimeout: 4_000,
      requestTimeout: 25_000
    });
  });
});
