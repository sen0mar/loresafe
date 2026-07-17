import { z, type ZodType } from "zod";

import {
  loginRequestSchema,
  signupRequestSchema
} from "../modules/auth/auth.schema.js";
import {
  banClubMemberRequestSchema,
  createClubRequestSchema,
  listClubBansQuerySchema,
  listClubMembersQuerySchema,
  listClubsQuerySchema,
  listPublicSeoClubsQuerySchema,
  updateClubMemberRoleRequestSchema,
  updateClubSettingsRequestSchema
} from "../modules/clubs/clubs.schema.js";
import {
  createPostCommentRequestSchema,
  listPostCommentsQuerySchema
} from "../modules/comments/comments.schema.js";
import {
  popularDiscussionsQuerySchema,
  recentlyUnlockedSummaryQuerySchema
} from "../modules/dashboard/dashboard.schema.js";
import { createClubInviteRequestSchema } from "../modules/invites/invites.schema.js";
import {
  createMilestoneRequestSchema,
  createMilestoneTemplateRequestSchema,
  listMilestonesQuerySchema,
  moveMilestoneRequestSchema,
  updateMilestoneRequestSchema
} from "../modules/milestones/milestones.schema.js";
import {
  deleteSelectedNotificationsBodySchema,
  listNotificationsQuerySchema
} from "../modules/notifications/notifications.schema.js";
import {
  createClubPostRequestSchema,
  listClubPostsQuerySchema
} from "../modules/posts/posts.schema.js";
import {
  recentlyUnlockedQuerySchema,
  updateProgressRequestSchema
} from "../modules/progress/progress.schema.js";
import {
  createReportRequestSchema,
  listModerationReportsQuerySchema,
  moderationReportBanRequestSchema,
  moderationReportNoteRequestSchema,
  moderationReportRequiredMilestoneRequestSchema,
  moderationReportResolveRequestSchema
} from "../modules/reports/reports.schema.js";
import { searchQuerySchema } from "../modules/search/search.schema.js";
import {
  createPostImageUploadRequestSchema,
  createPublicAssetUploadRequestSchema
} from "../modules/uploads/uploads.schema.js";
import {
  deleteCurrentUserAccountRequestSchema,
  listCurrentUserClubsQuerySchema,
  updateCurrentUserProfileRequestSchema
} from "../modules/users/users.schema.js";

type HttpMethod = "delete" | "get" | "patch" | "post" | "put";

type RouteContract = {
  auth?: boolean;
  body?: keyof typeof contractSchemas;
  idempotent?: boolean;
  method: HttpMethod;
  operationId: string;
  operationsAuth?: boolean;
  path: string;
  query?: keyof typeof contractSchemas;
  responseDto: string;
  responseMediaType?: "application/json" | "text/event-stream" | "text/plain";
  successStatus?: 200 | 201 | 204;
  summary: string;
  tag: string;
};

const contractSchemas = {
  BanClubMemberRequest: banClubMemberRequestSchema,
  CreateClubInviteRequest: createClubInviteRequestSchema,
  CreateClubPostRequest: createClubPostRequestSchema,
  CreateClubRequest: createClubRequestSchema,
  CreateMilestoneRequest: createMilestoneRequestSchema,
  CreateMilestoneTemplateRequest: createMilestoneTemplateRequestSchema,
  CreatePostCommentRequest: createPostCommentRequestSchema,
  CreatePostImageUploadRequest: createPostImageUploadRequestSchema,
  CreatePublicAssetUploadRequest: createPublicAssetUploadRequestSchema,
  CreateReportRequest: createReportRequestSchema,
  DeleteCurrentUserAccountRequest: deleteCurrentUserAccountRequestSchema,
  DeleteSelectedNotificationsRequest: deleteSelectedNotificationsBodySchema,
  ListClubBansQuery: listClubBansQuerySchema,
  ListClubMembersQuery: listClubMembersQuerySchema,
  ListClubPostsQuery: listClubPostsQuerySchema,
  ListClubsQuery: listClubsQuerySchema,
  ListCurrentUserClubsQuery: listCurrentUserClubsQuerySchema,
  ListMilestonesQuery: listMilestonesQuerySchema,
  ListModerationReportsQuery: listModerationReportsQuerySchema,
  ListNotificationsQuery: listNotificationsQuerySchema,
  ListPostCommentsQuery: listPostCommentsQuerySchema,
  ListPublicClubsQuery: listPublicSeoClubsQuerySchema,
  LoginRequest: loginRequestSchema,
  ModerationBanRequest: moderationReportBanRequestSchema,
  ModerationNoteRequest: moderationReportNoteRequestSchema,
  ModerationRequiredMilestoneRequest:
    moderationReportRequiredMilestoneRequestSchema,
  ModerationResolveRequest: moderationReportResolveRequestSchema,
  MoveMilestoneRequest: moveMilestoneRequestSchema,
  PopularDiscussionsQuery: popularDiscussionsQuerySchema,
  RecentlyUnlockedQuery: recentlyUnlockedQuerySchema,
  RecentlyUnlockedSummaryQuery: recentlyUnlockedSummaryQuerySchema,
  SearchQuery: searchQuerySchema,
  SignupRequest: signupRequestSchema,
  UpdateClubMemberRoleRequest: updateClubMemberRoleRequestSchema,
  UpdateClubSettingsRequest: updateClubSettingsRequestSchema,
  UpdateCurrentUserProfileRequest: updateCurrentUserProfileRequestSchema,
  UpdateMilestoneRequest: updateMilestoneRequestSchema,
  UpdateProgressRequest: updateProgressRequestSchema
} satisfies Record<string, ZodType>;

const secure = (
  method: HttpMethod,
  path: string,
  tag: string,
  operationId: string,
  responseDto: string,
  options: Pick<
    RouteContract,
    | "body"
    | "idempotent"
    | "operationsAuth"
    | "query"
    | "responseMediaType"
    | "successStatus"
  > = {}
): RouteContract => ({
  auth: true,
  method,
  path,
  tag,
  operationId,
  responseDto,
  summary: operationId.replace(
    /[A-Z]/g,
    (letter) => ` ${letter.toLowerCase()}`
  ),
  ...options
});

const publicRoute = (
  method: HttpMethod,
  path: string,
  tag: string,
  operationId: string,
  responseDto: string,
  options: Pick<
    RouteContract,
    | "body"
    | "idempotent"
    | "operationsAuth"
    | "query"
    | "responseMediaType"
    | "successStatus"
  > = {}
): RouteContract => ({
  ...secure(method, path, tag, operationId, responseDto, options),
  auth: false
});

const apiRouteContracts: RouteContract[] = [
  publicRoute("get", "/api/health", "Operations", "getLiveness", "LivenessDto"),
  publicRoute(
    "get",
    "/api/health/ready",
    "Operations",
    "getReadiness",
    "ReadinessDto"
  ),
  publicRoute(
    "get",
    "/api/health/metrics",
    "Operations",
    "getMetrics",
    "PrometheusTextDto",
    { operationsAuth: true, responseMediaType: "text/plain" }
  ),
  publicRoute(
    "get",
    "/api/public/clubs",
    "Public clubs",
    "listPublicClubs",
    "PublicClubListDto",
    { query: "ListPublicClubsQuery" }
  ),
  publicRoute(
    "get",
    "/api/public/clubs/{linkName}",
    "Public clubs",
    "getPublicClub",
    "PublicClubDto"
  ),
  publicRoute(
    "post",
    "/api/auth/signup",
    "Authentication",
    "signup",
    "AuthUserDto",
    { body: "SignupRequest", successStatus: 201 }
  ),
  publicRoute(
    "post",
    "/api/auth/login",
    "Authentication",
    "login",
    "AuthUserDto",
    { body: "LoginRequest" }
  ),
  publicRoute(
    "post",
    "/api/auth/refresh",
    "Authentication",
    "refreshSession",
    "AuthUserDto"
  ),
  secure(
    "get",
    "/api/auth/me",
    "Authentication",
    "getCurrentSessionUser",
    "AuthUserDto"
  ),
  secure("post", "/api/auth/logout", "Authentication", "logout", "EmptyDto", {
    idempotent: true,
    successStatus: 204
  }),
  secure(
    "post",
    "/api/auth/logout-all",
    "Authentication",
    "logoutAll",
    "EmptyDto",
    { idempotent: true, successStatus: 204 }
  ),
  secure("get", "/api/events", "Events", "streamEvents", "EventStreamDto", {
    responseMediaType: "text/event-stream"
  }),
  secure(
    "post",
    "/api/uploads/public-assets",
    "Uploads",
    "createPublicAssetUpload",
    "UploadIntentDto",
    { body: "CreatePublicAssetUploadRequest", successStatus: 201 }
  ),
  secure(
    "post",
    "/api/uploads/post-images",
    "Uploads",
    "createPostImageUpload",
    "UploadIntentDto",
    { body: "CreatePostImageUploadRequest", successStatus: 201 }
  ),
  secure(
    "post",
    "/api/uploads/{assetId}/complete",
    "Uploads",
    "completeUpload",
    "FileAssetDto",
    { idempotent: true }
  ),
  secure(
    "get",
    "/api/notifications",
    "Notifications",
    "listNotifications",
    "NotificationListDto",
    { query: "ListNotificationsQuery" }
  ),
  secure(
    "post",
    "/api/notifications/read-all",
    "Notifications",
    "markAllNotificationsRead",
    "NotificationMutationDto",
    { idempotent: true }
  ),
  secure(
    "delete",
    "/api/notifications",
    "Notifications",
    "deleteAllNotifications",
    "NotificationMutationDto",
    { idempotent: true }
  ),
  secure(
    "delete",
    "/api/notifications/selected",
    "Notifications",
    "deleteSelectedNotifications",
    "NotificationMutationDto",
    { body: "DeleteSelectedNotificationsRequest", idempotent: true }
  ),
  secure(
    "post",
    "/api/notifications/{id}/read",
    "Notifications",
    "markNotificationRead",
    "NotificationDto",
    { idempotent: true }
  ),
  secure(
    "delete",
    "/api/notifications/{id}",
    "Notifications",
    "deleteNotification",
    "EmptyDto",
    { idempotent: true }
  ),
  secure("get", "/api/search", "Search", "search", "SearchResultsDto", {
    query: "SearchQuery"
  }),
  secure("post", "/api/reports", "Reports", "createReport", "ReportDto", {
    body: "CreateReportRequest",
    successStatus: 201
  }),
  secure(
    "get",
    "/api/clubs/{linkName}/moderation/reports",
    "Moderation",
    "listModerationReports",
    "ModerationReportListDto",
    { query: "ListModerationReportsQuery" }
  ),
  secure(
    "post",
    "/api/clubs/{linkName}/moderation/reports/{reportId}/reveal",
    "Moderation",
    "revealModerationReport",
    "ModerationReportDto"
  ),
  secure(
    "patch",
    "/api/clubs/{linkName}/moderation/reports/{reportId}/required-milestone",
    "Moderation",
    "updateReportMilestone",
    "ModerationReportDto",
    { body: "ModerationRequiredMilestoneRequest" }
  ),
  secure(
    "post",
    "/api/clubs/{linkName}/moderation/reports/{reportId}/hide",
    "Moderation",
    "hideReportedContent",
    "ModerationReportDto",
    { body: "ModerationNoteRequest", idempotent: true }
  ),
  secure(
    "post",
    "/api/clubs/{linkName}/moderation/reports/{reportId}/delete",
    "Moderation",
    "deleteReportedContent",
    "ModerationReportDto",
    { body: "ModerationNoteRequest", idempotent: true }
  ),
  secure(
    "post",
    "/api/clubs/{linkName}/moderation/reports/{reportId}/warn",
    "Moderation",
    "warnReportedAuthor",
    "ModerationReportDto",
    { body: "ModerationNoteRequest" }
  ),
  secure(
    "post",
    "/api/clubs/{linkName}/moderation/reports/{reportId}/ban",
    "Moderation",
    "banReportedAuthor",
    "ModerationReportDto",
    { body: "ModerationBanRequest", idempotent: true }
  ),
  secure(
    "patch",
    "/api/clubs/{linkName}/moderation/reports/{reportId}/resolve",
    "Moderation",
    "resolveModerationReport",
    "ModerationReportDto",
    { body: "ModerationResolveRequest", idempotent: true }
  ),
  secure(
    "get",
    "/api/posts/{postId}/comments",
    "Comments",
    "listPostComments",
    "CommentListDto",
    { query: "ListPostCommentsQuery" }
  ),
  secure(
    "post",
    "/api/posts/{postId}/comments",
    "Comments",
    "createPostComment",
    "CommentDto",
    { body: "CreatePostCommentRequest", successStatus: 201 }
  ),
  secure(
    "post",
    "/api/posts/{postId}/comments/{commentId}/reveal",
    "Comments",
    "revealPostComment",
    "CommentDto"
  ),
  secure(
    "put",
    "/api/comments/{commentId}/reactions/{emoji}",
    "Comments",
    "addCommentReaction",
    "ReactionDto",
    { idempotent: true }
  ),
  secure(
    "delete",
    "/api/comments/{commentId}/reactions/{emoji}",
    "Comments",
    "removeCommentReaction",
    "ReactionDto",
    { idempotent: true }
  ),
  secure(
    "post",
    "/api/comments/{commentId}/delete",
    "Comments",
    "softDeleteComment",
    "CommentDto",
    { idempotent: true }
  ),
  secure("get", "/api/posts/{postId}", "Posts", "getPost", "PostDto"),
  secure(
    "post",
    "/api/posts/{postId}/reveal",
    "Posts",
    "revealPost",
    "PostDto"
  ),
  secure(
    "put",
    "/api/posts/{postId}/reactions/{emoji}",
    "Posts",
    "addPostReaction",
    "ReactionDto",
    { idempotent: true }
  ),
  secure(
    "delete",
    "/api/posts/{postId}/reactions/{emoji}",
    "Posts",
    "removePostReaction",
    "ReactionDto",
    { idempotent: true }
  ),
  secure(
    "post",
    "/api/posts/{postId}/delete",
    "Posts",
    "softDeletePost",
    "PostDto",
    { idempotent: true }
  ),
  secure(
    "get",
    "/api/clubs/{linkName}/stats",
    "Dashboard",
    "getClubStats",
    "ClubStatsDto"
  ),
  secure(
    "get",
    "/api/clubs/{linkName}/popular-discussions",
    "Dashboard",
    "getPopularDiscussions",
    "PostListDto",
    { query: "PopularDiscussionsQuery" }
  ),
  secure(
    "get",
    "/api/clubs/{linkName}/progress/summary",
    "Dashboard",
    "getProgressSummary",
    "ProgressSummaryDto"
  ),
  secure(
    "get",
    "/api/clubs/{linkName}/recently-unlocked/summary",
    "Dashboard",
    "getRecentlyUnlockedSummary",
    "RecentlyUnlockedSummaryDto",
    { query: "RecentlyUnlockedSummaryQuery" }
  ),
  secure(
    "get",
    "/api/clubs/{linkName}/progress",
    "Progress",
    "getProgress",
    "ProgressDto"
  ),
  secure(
    "get",
    "/api/clubs/{linkName}/recently-unlocked",
    "Progress",
    "listRecentlyUnlocked",
    "PostListDto",
    { query: "RecentlyUnlockedQuery" }
  ),
  secure(
    "patch",
    "/api/clubs/{linkName}/progress",
    "Progress",
    "updateProgress",
    "ProgressDto",
    { body: "UpdateProgressRequest", idempotent: true }
  ),
  secure(
    "post",
    "/api/clubs/{linkName}/progress/next",
    "Progress",
    "advanceProgress",
    "ProgressDto"
  ),
  secure(
    "post",
    "/api/clubs/{linkName}/posts",
    "Posts",
    "createClubPost",
    "PostDto",
    { body: "CreateClubPostRequest", successStatus: 201 }
  ),
  secure(
    "get",
    "/api/clubs/{linkName}/posts",
    "Posts",
    "listClubPosts",
    "PostListDto",
    { query: "ListClubPostsQuery" }
  ),
  secure(
    "post",
    "/api/clubs/{linkName}/milestones/templates",
    "Milestones",
    "createMilestoneTemplate",
    "MilestoneListDto",
    { body: "CreateMilestoneTemplateRequest", successStatus: 201 }
  ),
  secure(
    "post",
    "/api/clubs/{linkName}/milestones",
    "Milestones",
    "createMilestone",
    "MilestoneDto",
    { body: "CreateMilestoneRequest", successStatus: 201 }
  ),
  secure(
    "patch",
    "/api/clubs/{linkName}/milestones/{milestoneId}",
    "Milestones",
    "updateMilestone",
    "MilestoneDto",
    { body: "UpdateMilestoneRequest" }
  ),
  secure(
    "post",
    "/api/clubs/{linkName}/milestones/{milestoneId}/move",
    "Milestones",
    "moveMilestone",
    "MilestoneListDto",
    { body: "MoveMilestoneRequest" }
  ),
  secure(
    "get",
    "/api/clubs/{linkName}/milestones",
    "Milestones",
    "listMilestones",
    "MilestoneListDto",
    { query: "ListMilestonesQuery" }
  ),
  secure("post", "/api/clubs", "Clubs", "createClub", "ClubDto", {
    body: "CreateClubRequest",
    successStatus: 201
  }),
  secure("get", "/api/clubs", "Clubs", "listClubs", "ClubListDto", {
    query: "ListClubsQuery"
  }),
  secure("post", "/api/clubs/{linkName}/join", "Clubs", "joinClub", "ClubDto", {
    idempotent: true
  }),
  secure(
    "post",
    "/api/clubs/{linkName}/leave",
    "Clubs",
    "leaveClub",
    "EmptyDto",
    { idempotent: true }
  ),
  secure(
    "get",
    "/api/clubs/{linkName}/members",
    "Clubs",
    "listClubMembers",
    "ClubMemberListDto",
    { query: "ListClubMembersQuery" }
  ),
  secure(
    "get",
    "/api/clubs/{linkName}/bans",
    "Clubs",
    "listClubBans",
    "ClubBanListDto",
    { query: "ListClubBansQuery" }
  ),
  secure(
    "patch",
    "/api/clubs/{linkName}/members/{membershipId}/role",
    "Clubs",
    "updateClubMemberRole",
    "ClubMemberDto",
    { body: "UpdateClubMemberRoleRequest" }
  ),
  secure(
    "patch",
    "/api/clubs/{linkName}/settings",
    "Clubs",
    "updateClubSettings",
    "ClubDto",
    { body: "UpdateClubSettingsRequest", idempotent: true }
  ),
  secure(
    "post",
    "/api/clubs/{linkName}/members/{membershipId}/ban",
    "Clubs",
    "banClubMember",
    "ClubBanDto",
    { body: "BanClubMemberRequest", idempotent: true }
  ),
  secure(
    "post",
    "/api/clubs/{linkName}/bans/{banId}/unban",
    "Clubs",
    "unbanClubMember",
    "EmptyDto",
    { idempotent: true }
  ),
  secure("get", "/api/clubs/{linkName}", "Clubs", "getClub", "ClubDto"),
  secure(
    "post",
    "/api/clubs/{linkName}/invites",
    "Invites",
    "createClubInvite",
    "ClubInviteDto",
    { body: "CreateClubInviteRequest", successStatus: 201 }
  ),
  secure(
    "post",
    "/api/invites/{token}/accept",
    "Invites",
    "acceptInvite",
    "ClubDto",
    { idempotent: true }
  ),
  secure("delete", "/api/users/me", "Users", "deleteCurrentUser", "EmptyDto", {
    body: "DeleteCurrentUserAccountRequest",
    idempotent: true,
    successStatus: 204
  }),
  secure(
    "get",
    "/api/users/me/clubs",
    "Users",
    "listCurrentUserClubs",
    "ClubListDto",
    { query: "ListCurrentUserClubsQuery" }
  ),
  secure(
    "patch",
    "/api/users/me",
    "Users",
    "updateCurrentUser",
    "AuthUserDto",
    { body: "UpdateCurrentUserProfileRequest", idempotent: true }
  )
];

export const generateOpenApiDocument = () => {
  validateRouteContracts();
  const generatedSchemas = Object.fromEntries(
    Object.entries(contractSchemas).map(([name, schema]) => [
      name,
      withoutJsonSchemaDialect(
        z.toJSONSchema(schema, { io: "input", unrepresentable: "any" })
      )
    ])
  );
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of apiRouteContracts) {
    paths[route.path] ??= {};
    paths[route.path]![route.method] = toOpenApiOperation(
      route,
      generatedSchemas
    );
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "LoreSafe API",
      version: "1.0.0",
      description:
        "Versioned contract for LoreSafe's spoiler-safe REST and SSE API. Governance and compatibility rules live in context/api-governance.md."
    },
    servers: [{ url: "https://api.loresafe.org" }],
    security: [{ cookieSession: [] }],
    paths,
    components: {
      securitySchemes: {
        cookieSession: {
          type: "apiKey",
          in: "cookie",
          name: "loresafe_session",
          description:
            "Short-lived JWT stored only in a Secure, HttpOnly cookie."
        },
        operationsBearer: {
          type: "http",
          scheme: "bearer",
          description: "Dedicated operations token required only for metrics."
        }
      },
      schemas: {
        ...generatedSchemas,
        ApiError: {
          type: "object",
          additionalProperties: false,
          required: ["error"],
          properties: {
            error: {
              type: "object",
              additionalProperties: false,
              required: ["code", "message", "requestId"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                requestId: {
                  type: "string",
                  description:
                    "Server request correlation ID. Client x-request-id values are accepted only as 1-64 character trace-compatible tokens containing letters, digits, dot, underscore, colon, or hyphen; invalid values are replaced with a server UUID. Correlation IDs are not uniqueness or authorization keys."
                }
              }
            }
          }
        }
      },
      responses: {
        BadRequest: errorResponse("Invalid request."),
        Unauthorized: errorResponse(
          "Authentication required or credentials invalid."
        ),
        Forbidden: errorResponse("Authenticated but not authorized."),
        NotFound: errorResponse("Resource not found."),
        Conflict: errorResponse(
          "Request conflicts with current resource state."
        ),
        TooManyRequests: {
          ...errorResponse(
            "Rate limit exceeded; retry after the advertised reset."
          ),
          headers: rateLimitHeaders
        },
        ServiceUnavailable: errorResponse(
          "A required dependency is temporarily unavailable."
        )
      }
    }
  };
};

const toOpenApiOperation = (
  route: RouteContract,
  schemas: Record<string, Record<string, unknown>>
) => ({
  operationId: route.operationId,
  summary: route.summary,
  tags: [route.tag],
  security: route.operationsAuth
    ? [{ operationsBearer: [] }]
    : route.auth
      ? [{ cookieSession: [] }]
      : [],
  parameters: [
    ...pathParameters(route.path),
    ...queryParameters(route.query ? schemas[route.query] : undefined)
  ],
  ...(route.body
    ? {
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: `#/components/schemas/${route.body}` }
            }
          }
        }
      }
    : {}),
  responses: {
    [String(route.successStatus ?? 200)]: {
      description:
        route.responseDto === "EmptyDto"
          ? "No response body."
          : "Successful response.",
      "x-response-dto": route.responseDto,
      ...(route.responseDto === "EmptyDto"
        ? {}
        : {
            content: {
              [route.responseMediaType ?? "application/json"]: {
                schema:
                  route.responseMediaType &&
                  route.responseMediaType !== "application/json"
                    ? { type: "string" }
                    : { type: "object" }
              }
            }
          })
    },
    "400": { $ref: "#/components/responses/BadRequest" },
    ...(route.auth
      ? { "401": { $ref: "#/components/responses/Unauthorized" } }
      : {}),
    "403": { $ref: "#/components/responses/Forbidden" },
    "404": { $ref: "#/components/responses/NotFound" },
    "409": { $ref: "#/components/responses/Conflict" },
    "429": { $ref: "#/components/responses/TooManyRequests" },
    "503": { $ref: "#/components/responses/ServiceUnavailable" }
  },
  "x-idempotent":
    route.idempotent ??
    (route.method === "get" ||
      route.method === "put" ||
      route.method === "delete")
});

const pathParameters = (path: string) =>
  [...path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string", minLength: 1 }
  }));

const queryParameters = (schema: Record<string, unknown> | undefined) => {
  if (!schema || !isRecord(schema.properties)) {
    return [];
  }

  const required = new Set(
    Array.isArray(schema.required) ? schema.required : []
  );

  return Object.entries(schema.properties).map(([name, propertySchema]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema: propertySchema
  }));
};

const withoutJsonSchemaDialect = (schema: Record<string, unknown>) => {
  const { $schema: _dialect, ...openApiSchema } = schema;

  return openApiSchema;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ApiError" }
    }
  }
});

const rateLimitHeaders = {
  RateLimit: {
    description: "Structured limit, remaining quota, and reset parameters.",
    schema: { type: "string" }
  },
  "Retry-After": {
    description: "Seconds until a retry is permitted when present.",
    schema: { type: "integer", minimum: 0 }
  }
};

const validateRouteContracts = () => {
  const routeKeys = new Set<string>();
  const operationIds = new Set<string>();

  for (const route of apiRouteContracts) {
    const routeKey = `${route.method.toUpperCase()} ${route.path}`;

    if (routeKeys.has(routeKey)) {
      throw new Error(`Duplicate OpenAPI operation: ${routeKey}`);
    }

    if (operationIds.has(route.operationId)) {
      throw new Error(`Duplicate OpenAPI operationId: ${route.operationId}`);
    }

    if (!route.path.startsWith("/api/")) {
      throw new Error(`API contract path must start with /api/: ${route.path}`);
    }

    routeKeys.add(routeKey);
    operationIds.add(route.operationId);
  }
};
