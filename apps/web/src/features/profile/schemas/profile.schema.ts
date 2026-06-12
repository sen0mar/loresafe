import { z } from "zod";

export const profileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters.")
    .max(80, "Display name must be 80 characters or fewer."),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters.")
    .max(30, "Username must be 30 characters or fewer.")
    .regex(
      /^[a-z0-9_]+$/,
      "Username can only use lowercase letters, numbers, and underscores."
    ),
  bio: z
    .string()
    .trim()
    .max(160, "Bio must be 160 characters or fewer.")
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
