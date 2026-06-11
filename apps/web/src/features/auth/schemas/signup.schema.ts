import { z } from "zod";

export const signupFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters.")
    .max(80, "Display name must be 80 characters or fewer."),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters.")
    .max(128, "Password must be 128 characters or fewer.")
});

export type SignupFormValues = z.infer<typeof signupFormSchema>;
