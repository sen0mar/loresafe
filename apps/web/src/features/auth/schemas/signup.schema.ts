import { z } from "zod";

const signupRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
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
  username,
  password
}: SignupFormValues): SignupRequestValues => ({
  email,
  username,
  password
});
