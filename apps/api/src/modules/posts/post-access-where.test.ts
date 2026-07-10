import { describe, expect, it, vi } from "vitest";

import { visiblePostAccessWhere } from "./post-access-where.js";

describe("visiblePostAccessWhere", () => {
  it("rechecks post state, current membership, and active bans", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");

    expect(visiblePostAccessWhere("viewer-id", now)).toEqual({
      status: "VISIBLE",
      deletedAt: null,
      club: {
        bans: {
          none: {
            userId: "viewer-id",
            revokedAt: null,
            OR: [
              {
                expiresAt: null
              },
              {
                expiresAt: {
                  gt: now
                }
              }
            ]
          }
        },
        OR: [
          {
            visibility: "PUBLIC"
          },
          {
            memberships: {
              some: {
                userId: "viewer-id"
              }
            }
          }
        ]
      }
    });
  });

  it("uses one shared timestamp for active-ban evaluation", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-07-10T15:00:00.000Z");

    const where = visiblePostAccessWhere("viewer-id");

    expect(where.club).toMatchObject({
      bans: {
        none: {
          OR: [
            {
              expiresAt: null
            },
            {
              expiresAt: {
                gt: new Date("2026-07-10T15:00:00.000Z")
              }
            }
          ]
        }
      }
    });
    vi.useRealTimers();
  });
});
