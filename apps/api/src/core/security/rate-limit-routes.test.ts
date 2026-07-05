import { describe, expect, it, vi } from "vitest";

import {
  registerRateLimiters,
  type RateLimiterApp
} from "./rate-limit-routes.js";

const createRateLimiterApp = (): RateLimiterApp => ({
  delete: vi.fn() as unknown as RateLimiterApp["delete"],
  get: vi.fn() as unknown as RateLimiterApp["get"],
  patch: vi.fn() as unknown as RateLimiterApp["patch"],
  post: vi.fn() as unknown as RateLimiterApp["post"],
  use: vi.fn() as unknown as RateLimiterApp["use"]
});

describe("registerRateLimiters", () => {
  it("keeps route-specific limiters on their HTTP methods", () => {
    const app = createRateLimiterApp();

    registerRateLimiters(app);

    expect(app.post).toHaveBeenCalledWith(
      "/api/clubs",
      expect.any(Function)
    );
    expect(app.patch).toHaveBeenCalledWith(
      "/api/users/me",
      expect.any(Function)
    );
    expect(app.delete).toHaveBeenCalledWith(
      "/api/users/me",
      expect.any(Function)
    );
    expect(app.get).toHaveBeenCalledWith(
      "/api/search",
      expect.any(Function)
    );
    expect(app.post).toHaveBeenCalledWith(
      "/api/posts/:postId/delete",
      expect.any(Function)
    );
    expect(app.post).toHaveBeenCalledWith(
      "/api/comments/:commentId/delete",
      expect.any(Function)
    );
    expect(app.patch).toHaveBeenCalledWith(
      "/api/clubs/:linkName/settings",
      expect.any(Function)
    );
    expect(app.use).not.toHaveBeenCalledWith(
      "/api/clubs",
      expect.any(Function)
    );
    expect(app.use).not.toHaveBeenCalledWith(
      "/api/users/me",
      expect.any(Function)
    );
    expect(app.use).not.toHaveBeenCalledWith(
      "/api/search",
      expect.any(Function)
    );
  });
});
