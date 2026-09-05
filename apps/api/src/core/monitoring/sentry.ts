import * as Sentry from "@sentry/node";

import { env } from "../../config/env.js";

import { telemetryPrivacyOptions } from "./telemetry-scrubbing.js";

const sentryEnabled = Boolean(env.SENTRY_DSN);

if (sentryEnabled) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    ...telemetryPrivacyOptions
  });
}

export { Sentry };
