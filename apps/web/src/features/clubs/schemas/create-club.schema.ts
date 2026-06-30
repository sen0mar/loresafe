import { z } from "zod";
import type { ClubCategory, ClubVisibility } from "../api/clubs.js";
import { clubCategoryOptions } from "../lib/club-categories.js";

const optionalTrimmedText = (maxLength: number, message: string) =>
  z
    .string()
    .trim()
    .max(maxLength, message)
    .transform((value) => (value.length > 0 ? value : null))
    .optional();

const clubCategoryValues = clubCategoryOptions.map((option) => option.value) as [
  ClubCategory,
  ...ClubCategory[]
];

const clubCategoryFormSchema = z
  .union([z.enum(clubCategoryValues), z.literal("")])
  .refine((category): category is ClubCategory => category !== "", {
    message: "Choose a category."
  });

export const createClubFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters.")
    .max(120, "Title must be 120 characters or fewer."),
  linkName: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Link name must be at least 3 characters.")
    .max(80, "Link name must be 80 characters or fewer.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Link name can use lowercase letters, numbers, and single hyphens."
    ),
  description: optionalTrimmedText(
    280,
    "Description must be 280 characters or fewer."
  ),
  category: clubCategoryFormSchema,
  visibility: z.enum(["PUBLIC", "PRIVATE", "INVITE_ONLY"]),
  rules: optionalTrimmedText(2000, "Rules must be 2000 characters or fewer.")
});

export type CreateClubFormValues = {
  title: string;
  linkName: string;
  description: string;
  category: ClubCategory | "";
  visibility: ClubVisibility;
  rules: string;
};
export type CreateClubFormPayload = z.output<typeof createClubFormSchema>;
