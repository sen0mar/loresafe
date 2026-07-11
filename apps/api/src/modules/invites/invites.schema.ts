import { z } from "zod";

import { clubLinkNameSchema } from "../clubs/clubs.schema.js";

const inviteTokenSchema = z
  .string()
  .trim()
  .length(43)
  .regex(/^[A-Za-z0-9_-]+$/);

export const createClubInviteParamsSchema = z
  .object({
    linkName: clubLinkNameSchema
  })
  .strict();

export const createClubInviteRequestSchema = z
  .object({
    expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
    maxUses: z.coerce.number().int().min(1).max(100).default(10)
  })
  .strict();

export const acceptInviteParamsSchema = z
  .object({
    token: inviteTokenSchema
  })
  .strict();

export type CreateClubInviteRequest = z.infer<
  typeof createClubInviteRequestSchema
>;
