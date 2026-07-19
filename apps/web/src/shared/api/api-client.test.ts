import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet } from "./api-client.js";

describe("API request cancellation and deadlines", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aborts the fetch when the caller signal is cancelled", async () => {
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason)
          );
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const request = apiGet("/api/test", { signal: controller.signal });

    controller.abort(new DOMException("cancelled", "AbortError"));

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("returns a clear API timeout error when the deadline expires", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(init.signal?.reason)
            );
          })
      )
    );
    const request = apiGet("/api/test", { timeoutMs: 25 });
    const expectation = expect(request).rejects.toEqual(
      expect.objectContaining({
        code: "REQUEST_TIMEOUT",
        message: "The request timed out. Please try again."
      })
    );

    await vi.advanceTimersByTimeAsync(25);
    await expectation;
  });
});
