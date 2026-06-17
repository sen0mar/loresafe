import "@testing-library/jest-dom/vitest";

import { afterEach, vi } from "vitest";

import { cleanup } from "@testing-library/react";

class TestEventSource {
  onerror: (() => void) | null = null;

  constructor(
    readonly url: string,
    readonly options?: EventSourceInit
  ) {}

  addEventListener = vi.fn();
  close = vi.fn();
}

Object.defineProperty(window, "EventSource", {
  configurable: true,
  value: TestEventSource
});
Object.defineProperty(globalThis, "EventSource", {
  configurable: true,
  value: TestEventSource
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
