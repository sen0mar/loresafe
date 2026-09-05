// This dependency-free module is shared with API telemetry so privacy rules
// cannot drift between the browser bundle and the server build.
export {
  redactTelemetryString as redactInviteTokens,
  scrubTelemetry as scrubSentryBreadcrumb,
  scrubTelemetry as scrubSentryEvent,
  redactTelemetryString,
  scrubTelemetry,
  telemetryPrivacyOptions
} from "../../../api/src/core/monitoring/telemetry-scrubbing.js";
