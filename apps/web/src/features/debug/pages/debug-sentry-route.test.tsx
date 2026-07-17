import { shouldEnableDebugSentryRoute } from "@/app/app";

describe("debug Sentry route gate", () => {
  it("requires the debug flag and a non-production build", () => {
    expect(
      shouldEnableDebugSentryRoute({
        MODE: "development",
        PROD: false,
        VITE_SENTRY_ENABLE_DEBUG_ROUTE: "true"
      })
    ).toBe(true);
    expect(
      shouldEnableDebugSentryRoute({
        MODE: "production",
        PROD: true,
        VITE_SENTRY_ENABLE_DEBUG_ROUTE: "true"
      })
    ).toBe(false);
    expect(
      shouldEnableDebugSentryRoute({
        MODE: "development",
        PROD: false,
        VITE_SENTRY_ENABLE_DEBUG_ROUTE: "false"
      })
    ).toBe(false);
    expect(
      shouldEnableDebugSentryRoute({
        MODE: "test",
        PROD: false,
        VITE_SENTRY_ENABLE_DEBUG_ROUTE: "true"
      })
    ).toBe(false);
  });
});
