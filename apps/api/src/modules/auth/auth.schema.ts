import { z } from "zod";

export const signupRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320),
    displayName: z.string().trim().min(2).max(80),
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
