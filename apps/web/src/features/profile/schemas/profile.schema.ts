import { z } from "zod";

export const profileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters.")
    .max(80, "Display name must be 80 characters or fewer."),
  bio: z
    .string()
    .trim()
    .max(160, "Bio must be 160 characters or fewer.")
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
