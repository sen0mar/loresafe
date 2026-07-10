import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadFileToPresignedUrl } from "./uploads.js";

class FakeXMLHttpRequest {
  static latest: FakeXMLHttpRequest | null = null;

  status = 0;
  timeout = 0;
  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onabort: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  ontimeout: (() => void) | null = null;

  constructor() {
    FakeXMLHttpRequest.latest = this;
  }

  abort = () => this.onabort?.();
  open = vi.fn();
  send = vi.fn();
  setRequestHeader = vi.fn();
}

describe("presigned uploads", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeXMLHttpRequest.latest = null;
  });

  it("returns a cancellation handle and applies the upload deadline", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
    const upload = uploadFileToPresignedUrl({
      file: new File(["image"], "image.png", { type: "image/png" }),
      headers: { "Content-Type": "image/png" },
      onProgress: vi.fn(),
      url: "https://upload.example/object"
    });

    expect(FakeXMLHttpRequest.latest?.timeout).toBe(120_000);
    upload.cancel();

    await expect(upload.promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("returns a clear error when the upload times out", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
    const upload = uploadFileToPresignedUrl({
      file: new File(["image"], "image.png", { type: "image/png" }),
      headers: {},
      onProgress: vi.fn(),
      url: "https://upload.example/object"
    });

    FakeXMLHttpRequest.latest?.ontimeout?.();

    await expect(upload.promise).rejects.toThrow("upload timed out");
  });
});
