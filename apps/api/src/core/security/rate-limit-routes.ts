import type { Application } from "express";

import type { RateLimiters } from "./rate-limit.js";

export type RateLimiterApp = Pick<
  Application,
  "delete" | "get" | "patch" | "post" | "use"
>;

export const registerRateLimiters = (
  app: RateLimiterApp,
  rateLimiters: RateLimiters
) => {
  const {
    accountDeleteRateLimiter,
    clubCreateRateLimiter,
    clubInviteCreateRateLimiter,
    clubJoinRateLimiter,
    clubLeaveRateLimiter,
    clubMemberManagementRateLimiter,
    clubMilestoneCreateRateLimiter,
    clubMilestoneMutationRateLimiter,
    clubPostCreateRateLimiter,
    clubProgressUpdateRateLimiter,
    clubSettingsUpdateRateLimiter,
    commentReactionToggleRateLimiter,
    contentRevealRateLimiter,
    deepReadinessRateLimiter,
    eventConnectionRateLimiter,
    expensiveReadRateLimiter,
    forgotPasswordRateLimiter,
    inviteAcceptRateLimiter,
    loginRateLimiter,
    logoutRateLimiter,
    moderationActionRateLimiter,
    notificationMutationRateLimiter,
    postCommentCreateRateLimiter,
    postReactionToggleRateLimiter,
    profileUpdateRateLimiter,
    postImageUploadRateLimiter,
    publicAssetUploadRateLimiter,
    publicSeoReadRateLimiter,
    resetPasswordRateLimiter,
    reportCreateRateLimiter,
    searchRateLimiter,
    signupRateLimiter,
    verificationConfirmRateLimiter,
    verificationResendRateLimiter
  } = rateLimiters;

  // Keep these before JSON parsing so blocked requests avoid expensive work.
  app.use("/api/auth/login", loginRateLimiter);
  app.use("/api/auth/refresh", loginRateLimiter);
  app.use("/api/auth/logout", logoutRateLimiter);
  app.post("/api/auth/logout-all", logoutRateLimiter);
  app.use("/api/auth/signup", signupRateLimiter);
  app.use("/api/auth/verification/resend", verificationResendRateLimiter);
  app.use("/api/auth/verification/confirm", verificationConfirmRateLimiter);
  app.use("/api/auth/password/forgot", forgotPasswordRateLimiter);
  app.use("/api/auth/password/reset", resetPasswordRateLimiter);
  app.get("/api/health/ready", deepReadinessRateLimiter);
  app.get("/sitemap.xml", publicSeoReadRateLimiter);
  app.get("/api/public/clubs", publicSeoReadRateLimiter);
  app.get("/api/public/clubs/:linkName", publicSeoReadRateLimiter);
  app.post("/api/clubs", clubCreateRateLimiter);
  app.post("/api/clubs/:linkName/invites", clubInviteCreateRateLimiter);
  app.post("/api/clubs/:linkName/join", clubJoinRateLimiter);
  app.post("/api/clubs/:linkName/leave", clubLeaveRateLimiter);
  app.patch(
    "/api/clubs/:linkName/members/:membershipId/role",
    clubMemberManagementRateLimiter
  );
  app.post(
    "/api/clubs/:linkName/members/:membershipId/ban",
    clubMemberManagementRateLimiter
  );
  app.post(
    "/api/clubs/:linkName/bans/:banId/unban",
    clubMemberManagementRateLimiter
  );
  app.patch("/api/clubs/:linkName/settings", clubSettingsUpdateRateLimiter);
  app.post("/api/clubs/:linkName/milestones", clubMilestoneCreateRateLimiter);
  app.post(
    "/api/clubs/:linkName/milestones/templates",
    clubMilestoneCreateRateLimiter
  );
  app.patch(
    "/api/clubs/:linkName/milestones/:milestoneId",
    clubMilestoneMutationRateLimiter
  );
  app.post(
    "/api/clubs/:linkName/milestones/:milestoneId/move",
    clubMilestoneMutationRateLimiter
  );
  app.post("/api/clubs/:linkName/posts", clubPostCreateRateLimiter);
  app.get("/api/clubs/:linkName/posts", expensiveReadRateLimiter);
  app.post("/api/posts/:postId/comments", postCommentCreateRateLimiter);
  app.use(
    "/api/comments/:commentId/reactions/:emoji",
    commentReactionToggleRateLimiter
  );
  app.post("/api/comments/:commentId/delete", moderationActionRateLimiter);
  app.use("/api/posts/:postId/reactions/:emoji", postReactionToggleRateLimiter);
  app.post("/api/posts/:postId/delete", moderationActionRateLimiter);
  app.post("/api/posts/:postId/reveal", contentRevealRateLimiter);
  app.post(
    "/api/posts/:postId/comments/:commentId/reveal",
    contentRevealRateLimiter
  );
  app.post("/api/reports", reportCreateRateLimiter);
  app.get("/api/search", searchRateLimiter);
  app.get("/api/events", eventConnectionRateLimiter);
  app.get("/api/clubs/:linkName/stats", expensiveReadRateLimiter);
  app.get("/api/clubs/:linkName/popular-discussions", expensiveReadRateLimiter);
  app.get("/api/clubs/:linkName/progress/summary", expensiveReadRateLimiter);
  app.get("/api/clubs/:linkName/moderation/reports", expensiveReadRateLimiter);
  app.post(
    "/api/clubs/:linkName/moderation/reports/:reportId/reveal",
    contentRevealRateLimiter
  );
  app.get(
    "/api/clubs/:linkName/recently-unlocked/summary",
    expensiveReadRateLimiter
  );
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
  app.delete("/api/users/me", accountDeleteRateLimiter);
  app.post("/api/uploads/public-assets", publicAssetUploadRateLimiter);
  app.post("/api/uploads/post-images", postImageUploadRateLimiter);
  app.post("/api/uploads/:assetId/complete", publicAssetUploadRateLimiter);
  app.post("/api/notifications/read-all", notificationMutationRateLimiter);
  app.post("/api/notifications/:id/read", notificationMutationRateLimiter);
  app.delete("/api/notifications", notificationMutationRateLimiter);
  app.delete("/api/notifications/selected", notificationMutationRateLimiter);
  app.delete("/api/notifications/:id", notificationMutationRateLimiter);
};

export const registerParsedBodyRateLimiters = (
  app: RateLimiterApp,
  {
    forgotPasswordAccountRateLimiter,
    loginAccountBurstRateLimiter,
    loginAccountSustainedRateLimiter,
    resetPasswordTokenRateLimiter,
    signupAccountRateLimiter,
    verificationResendAccountRateLimiter
  }: RateLimiters
) => {
  // These account-keyed buckets require the validated-shape JSON body and must
  // still run before database lookup or Argon2 verification.
  app.use("/api/auth/login", loginAccountBurstRateLimiter);
  app.use("/api/auth/login", loginAccountSustainedRateLimiter);
  app.use("/api/auth/signup", signupAccountRateLimiter);
  app.use(
    "/api/auth/verification/resend",
    verificationResendAccountRateLimiter
  );
  app.use("/api/auth/password/forgot", forgotPasswordAccountRateLimiter);
  app.use("/api/auth/password/reset", resetPasswordTokenRateLimiter);
};
