import type { Application } from "express";

import {
  clubCreateRateLimiter,
  clubInviteCreateRateLimiter,
  clubJoinRateLimiter,
  clubMemberManagementRateLimiter,
  clubMilestoneCreateRateLimiter,
  clubPostCreateRateLimiter,
  clubProgressUpdateRateLimiter,
  commentReactionToggleRateLimiter,
  inviteAcceptRateLimiter,
  loginRateLimiter,
  logoutRateLimiter,
  moderationActionRateLimiter,
  postCommentCreateRateLimiter,
  postReactionToggleRateLimiter,
  profileUpdateRateLimiter,
  publicAssetUploadRateLimiter,
  reportCreateRateLimiter,
  searchRateLimiter,
  signupRateLimiter
} from "./rate-limit.js";

export type RateLimiterApp = Pick<
  Application,
  "get" | "patch" | "post" | "use"
>;

export const registerRateLimiters = (app: RateLimiterApp) => {
  // Keep these before JSON parsing so blocked requests avoid expensive work.
  app.use("/api/auth/login", loginRateLimiter);
  app.use("/api/auth/logout", logoutRateLimiter);
  app.use("/api/auth/signup", signupRateLimiter);
  app.post("/api/clubs", clubCreateRateLimiter);
  app.post("/api/clubs/:linkName/invites", clubInviteCreateRateLimiter);
  app.post("/api/clubs/:linkName/join", clubJoinRateLimiter);
  app.patch(
    "/api/clubs/:linkName/members/:membershipId/role",
    clubMemberManagementRateLimiter
  );
  app.post(
    "/api/clubs/:linkName/members/:membershipId/ban",
    clubMemberManagementRateLimiter
  );
  app.post(
    "/api/clubs/:linkName/members/:membershipId/unban",
    clubMemberManagementRateLimiter
  );
  app.post("/api/clubs/:linkName/milestones", clubMilestoneCreateRateLimiter);
  app.post(
    "/api/clubs/:linkName/milestones/templates",
    clubMilestoneCreateRateLimiter
  );
  app.post("/api/clubs/:linkName/posts", clubPostCreateRateLimiter);
  app.post("/api/posts/:postId/comments", postCommentCreateRateLimiter);
  app.post(
    "/api/comments/:commentId/reactions/toggle",
    commentReactionToggleRateLimiter
  );
  app.post(
    "/api/comments/:commentId/delete",
    moderationActionRateLimiter
  );
  app.post(
    "/api/posts/:postId/reactions/toggle",
    postReactionToggleRateLimiter
  );
  app.post("/api/posts/:postId/delete", moderationActionRateLimiter);
  app.post("/api/reports", reportCreateRateLimiter);
  app.get("/api/search", searchRateLimiter);
  app.patch(
    "/api/clubs/:linkName/moderation/reports/:reportId/required-milestone",
    moderationActionRateLimiter
  );
  app.post(
    "/api/clubs/:linkName/moderation/reports/:reportId/hide",
    moderationActionRateLimiter
  );
  app.post(
    "/api/clubs/:linkName/moderation/reports/:reportId/delete",
    moderationActionRateLimiter
  );
  app.post(
    "/api/clubs/:linkName/moderation/reports/:reportId/warn",
    moderationActionRateLimiter
  );
  app.post(
    "/api/clubs/:linkName/moderation/reports/:reportId/ban",
    moderationActionRateLimiter
  );
  app.patch(
    "/api/clubs/:linkName/moderation/reports/:reportId/resolve",
    moderationActionRateLimiter
  );
  app.patch("/api/clubs/:linkName/progress", clubProgressUpdateRateLimiter);
  app.post("/api/clubs/:linkName/progress/next", clubProgressUpdateRateLimiter);
  app.post("/api/invites/:token/accept", inviteAcceptRateLimiter);
  app.patch("/api/users/me", profileUpdateRateLimiter);
  app.post("/api/uploads/public-assets", publicAssetUploadRateLimiter);
  app.post("/api/uploads/:assetId/complete", publicAssetUploadRateLimiter);
};
