import { z } from "zod";

const clubVisibilitySchema = z.enum(["PUBLIC", "PRIVATE", "INVITE_ONLY"]);
const clubMembershipRoleSchema = z.enum(["OWNER", "MODERATOR", "MEMBER"]);
export const clubCategorySchema = z.enum([
  "BOOKS",
  "TV_SHOWS",
  "ANIME",
  "MANGA",
  "MOVIES",
  "GAMES",
  "PODCASTS",
  "COURSES",
  "COMICS_GRAPHIC_NOVELS",
  "WEB_SERIALS",
  "CUSTOM_TIMELINE"
]);

const optionalTrimmedText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value.length > 0 ? value : null))
    .optional();

export const clubLinkNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const listClubsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    sort: z.enum(["newest", "popular"]).default("newest")
  })
  .strict()
  .superRefine((query, context) => {
    if (query.sort === "popular" && query.limit > 20) {
      context.addIssue({
        code: "custom",
        path: ["limit"],
        message: "Most popular discovery is limited to 20 clubs."
      });
    }
  });

export const listPublicSeoClubsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    sort: z.enum(["newest", "popular"]).default("newest")
  })
  .strict()
  .superRefine((query, context) => {
    if (query.sort === "popular" && query.limit > 20) {
      context.addIssue({
        code: "custom",
        path: ["limit"],
        message: "Most popular public club pages are limited to 20 clubs."
      });
    }
  });

export const listClubMembersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    q: z
      .string()
      .trim()
      .max(80)
      .transform((value) => (value.length > 0 ? value : null))
      .optional()
  })
  .strict();

export const listClubBansQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  })
  .strict();

export const createClubRequestSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    linkName: clubLinkNameSchema,
    description: optionalTrimmedText(280),
    category: clubCategorySchema,
    visibility: clubVisibilitySchema,
    rules: optionalTrimmedText(2000)
  })
  .strict();

export const updateClubSettingsRequestSchema = z
  .object({
    visibility: clubVisibilitySchema,
    rules: z
      .union([
        z
          .string()
          .trim()
          .max(2000)
          .transform((value) => (value.length > 0 ? value : null)),
        z.null()
      ])
  })
  .strict();

export const clubLinkNameParamsSchema = z
  .object({
    linkName: clubLinkNameSchema
  })
  .strict();

export const clubMemberParamsSchema = z
  .object({
    linkName: clubLinkNameSchema,
    membershipId: z.uuid()
  })
  .strict();

export const clubBanParamsSchema = z
  .object({
    linkName: clubLinkNameSchema,
    banId: z.uuid()
  })
  .strict();

export const updateClubMemberRoleRequestSchema = z
  .object({
    role: clubMembershipRoleSchema
  })
  .strict();

export const banClubMemberRequestSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .max(500)
      .transform((value) => (value.length > 0 ? value : null))
      .optional(),
    expiresAt: z
      .string()
      .datetime({ offset: true })
      .refine((value) => new Date(value).getTime() > Date.now(), {
        message: "Ban expiration must be in the future."
      })
      .optional(),
    deleteAuthoredPosts: z.boolean().optional()
  })
  .strict();

export type ListClubsQuery = z.infer<typeof listClubsQuerySchema>;
export type ListPublicSeoClubsQuery = z.infer<
  typeof listPublicSeoClubsQuerySchema
>;
export type ListClubMembersQuery = z.infer<typeof listClubMembersQuerySchema>;
export type ListClubBansQuery = z.infer<typeof listClubBansQuerySchema>;
export type ClubCategory = z.infer<typeof clubCategorySchema>;
export type CreateClubRequest = z.infer<typeof createClubRequestSchema>;
export type UpdateClubSettingsRequest = z.infer<
  typeof updateClubSettingsRequestSchema
>;
export type ClubLinkNameParams = z.infer<typeof clubLinkNameParamsSchema>;
export type ClubMemberParams = z.infer<typeof clubMemberParamsSchema>;
export type ClubBanParams = z.infer<typeof clubBanParamsSchema>;
export type UpdateClubMemberRoleRequest = z.infer<
  typeof updateClubMemberRoleRequestSchema
>;
export type BanClubMemberRequest = z.infer<typeof banClubMemberRequestSchema>;
