import { z } from "zod";

const signupRequestSchema = z.object({
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

export const signupFormSchema = signupRequestSchema
  .extend({
    confirmPassword: z.string().min(1, "Confirm your password.")
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

export type SignupFormValues = z.infer<typeof signupFormSchema>;
export type SignupRequestValues = z.infer<typeof signupRequestSchema>;

export const toSignupRequest = ({
  email,
  displayName,
  password
}: SignupFormValues): SignupRequestValues => ({
  email,
  displayName,
  password
});
