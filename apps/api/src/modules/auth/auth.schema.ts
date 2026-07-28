import { z } from "zod";

import { USERNAME_PATTERN } from "../../core/identity/user-names.js";

export const signupRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(30)
      .regex(USERNAME_PATTERN),
    password: z.string().min(12).max(128)
  })
  .strict();

export const loginRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320),
    password: z.string().min(1).max(128)
  })
  .strict();

const emailRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320)
  })
  .strict();

const emailTokenSchema = z.string().min(40).max(128);

export const resendVerificationRequestSchema = emailRequestSchema;
export const forgotPasswordRequestSchema = emailRequestSchema;
export const verifyEmailRequestSchema = z
  .object({
    token: emailTokenSchema
  })
  .strict();
export const resetPasswordRequestSchema = z
  .object({
    token: emailTokenSchema,
    password: z.string().min(12).max(128)
  })
  .strict();

export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type ResendVerificationRequest = z.infer<
  typeof resendVerificationRequestSchema
>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
