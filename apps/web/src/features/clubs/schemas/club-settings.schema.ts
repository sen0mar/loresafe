import { z } from "zod";

import type { ClubVisibility } from "../api/clubs.js";

export const clubSettingsFormSchema = z.object({
  visibility: z.enum(["PUBLIC", "PRIVATE", "INVITE_ONLY"]),
  rules: z
    .string()
    .trim()
    .max(2000, "Rules must be 2000 characters or fewer.")
    .transform((value) => (value.length > 0 ? value : null))
});

export type ClubSettingsFormValues = {
  visibility: ClubVisibility;
  rules: string;
};
export type ClubSettingsFormPayload = z.output<typeof clubSettingsFormSchema>;
