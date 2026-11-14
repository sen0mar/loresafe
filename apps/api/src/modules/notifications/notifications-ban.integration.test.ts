import { describe, expect, it } from "vitest";

import { prisma } from "../../core/prisma/client.js";
import { notificationsRepository } from "./notifications.repository.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("notification visibility after a club ban", () => {
  it("hides club notifications once the recipient is banned", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const user = await prisma.user.create({
      data: {
        email: `notify-ban-${suffix}@example.com`,
        displayName: `notify-ban-${suffix}`.slice(0, 80),
        username: `nb_${suffix}`.slice(0, 30),
        passwordHash: "$argon2id$v=19$integration-fixture"
      },
      select: { id: true }
    });
    const club = await prisma.club.create({
      data: {
        title: "Notification ban fixture",
        linkName: `notify-ban-${suffix}`,
        category: "CUSTOM_TIMELINE",
        visibility: "PUBLIC",
        memberships: { create: { userId: user.id, role: "MEMBER" } },
        milestones: { create: { position: 1, safeTitle: "Start" } }
      },
      select: { id: true, milestones: { select: { id: true } } }
    });

    try {
      const notification = await prisma.notification.create({
        data: {
          userId: user.id,
          type: "MODERATION_WARNING",
          eventKey: `notify-ban-${suffix}`,
          safeText: "A moderator left you a note.",
          clubId: club.id,
          requiredMilestoneId: club.milestones[0]!.id
        },
        select: { id: true }
      });
      const list = () =>
        notificationsRepository.listNotificationsForUser(user.id, {
          cursor: null,
          limit: 20
        });

      const beforeBan = await list();
      expect(beforeBan.notifications.map(({ id }) => id)).toEqual([
        notification.id
      ]);
      expect(beforeBan.unreadCount).toBe(1);

      await prisma.clubMembership.delete({
        where: { userId_clubId: { userId: user.id, clubId: club.id } }
      });
      await prisma.clubBan.create({
        data: {
          clubId: club.id,
          userId: user.id,
          roleAtBan: "MEMBER",
          reason: "Integration fixture"
        }
      });

      const afterBan = await list();
      expect(afterBan.notifications).toEqual([]);
      expect(afterBan.unreadCount).toBe(0);
      await expect(
        notificationsRepository.markNotificationRead(notification.id, user.id)
      ).resolves.toBeNull();
    } finally {
      await prisma.club.deleteMany({ where: { id: club.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });
});
