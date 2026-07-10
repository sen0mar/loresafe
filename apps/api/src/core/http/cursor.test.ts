import { describe, expect, it } from "vitest";

import {
  decodeBoundedOffsetCursor,
  decodeTimestampUuidCursor,
  encodeBoundedOffsetCursor,
  encodeTimestampUuidCursor
} from "./cursor.js";

describe("cursor codec", () => {
  it("round-trips timestamp and UUID keyset cursors", () => {
    const cursor = {
      createdAt: new Date("2026-07-10T12:30:00.000Z"),
      id: crypto.randomUUID()
    };

    expect(decodeTimestampUuidCursor(encodeTimestampUuidCursor(cursor))).toEqual(
      cursor
    );
  });

  it.each([
    { createdAt: "not-a-date", id: crypto.randomUUID() },
    { createdAt: "2026-07-10T12:30:00.000Z", id: "not-a-uuid" },
    { createdAt: "2026-07-10T12:30:00.000Z", id: crypto.randomUUID(), extra: true }
  ])("rejects malformed keyset cursor payloads", (payload) => {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

    expect(() => decodeTimestampUuidCursor(encoded)).toThrow(
      "Check the pagination cursor and try again."
    );
  });

  it("enforces safe bounded offset cursors", () => {
    expect(decodeBoundedOffsetCursor(encodeBoundedOffsetCursor(50), 100)).toEqual({
      offset: 50
    });
    expect(() =>
      decodeBoundedOffsetCursor(encodeBoundedOffsetCursor(101), 100)
    ).toThrow("Check the pagination cursor and try again.");
    const unsafe = Buffer.from(
      JSON.stringify({ offset: Number.MAX_SAFE_INTEGER + 1 })
    ).toString("base64url");
    expect(() => decodeBoundedOffsetCursor(unsafe, 100)).toThrow(
      "Check the pagination cursor and try again."
    );
  });
});
