import { describe, expect, it } from "vitest";

import {
  buildAccessibleNotificationWhere,
  buildNotificationListWhere
} from "./notifications.repository.js";

describe("notification repository access filters", () => {
  it("requires current club access, no active ban, and a visible target", () => {
    const userId = crypto.randomUUID();
    const now = new Date("2026-07-09T12:00:00.000Z");

    expect(buildAccessibleNotificationWhere(userId, now)).toMatchObject({
      userId,
      club: {
        bans: {
          none: {
            userId,
            revokedAt: null,
            OR: [
              { expiresAt: null },
              {
                expiresAt: {
                  gt: now
                }
              }
            ]
          }
        },
        OR: [
          { visibility: "PUBLIC" },
          {
            memberships: {
              some: {
                userId
              }
            }
          }
        ]
      },
      OR: expect.arrayContaining([
        expect.objectContaining({
          commentId: { not: null },
          comment: expect.objectContaining({
            status: "VISIBLE",
            deletedAt: null
          })
        }),
        expect.objectContaining({
          commentId: null,
          postId: { not: null },
          post: expect.objectContaining({
            status: "VISIBLE",
            deletedAt: null
          })
        })
      ])
    });
  });

  it("keeps access and target predicates when a pagination cursor is present", () => {
    const userId = crypto.randomUUID();
    const cursor = {
      createdAt: new Date("2026-07-09T11:00:00.000Z"),
      id: crypto.randomUUID()
    };
    const where = buildNotificationListWhere(userId, cursor);
    const predicates = Array.isArray(where.AND) ? where.AND : [where.AND];

    expect(predicates).toHaveLength(2);
    expect(predicates[0]).toMatchObject({
      userId,
      OR: expect.any(Array)
    });
    expect(predicates[1]).toMatchObject({
      OR: expect.any(Array)
    });
  });
});
