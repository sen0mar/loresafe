import { render, screen, waitFor } from "@testing-library/react";

import { App, shouldEnableDebugSentryRoute } from "@/app/app";
import { mockFetchRoutes } from "@/test/render";

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

  it("keeps the controlled debug error route unavailable by default", async () => {
    mockFetchRoutes([
      {
        path: "/api/auth/me",
        status: 401,
        response: {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required"
          }
        }
      }
    ]);
    window.history.pushState({}, "", "/app/debug/sentry-error");

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Welcome back" })
    ).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
    expect(window.location.search).toBe(
      "?redirectTo=%2Fapp%2Fdebug%2Fsentry-error"
    );
  });
});
