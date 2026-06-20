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

export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
