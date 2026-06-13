import { z } from "zod";

export const createInviteFormSchema = z.object({
  expiresInDays: z.coerce
    .number()
    .int("Expiry must be a whole number of days.")
    .min(1, "Expiry must be at least 1 day.")
    .max(30, "Expiry must be 30 days or fewer."),
  maxUses: z.coerce
    .number()
    .int("Max uses must be a whole number.")
    .min(1, "Max uses must be at least 1.")
    .max(100, "Max uses must be 100 or fewer.")
});

export type CreateInviteFormValues = {
  expiresInDays: string;
  maxUses: string;
};

export type CreateInvitePayload = z.output<typeof createInviteFormSchema>;
