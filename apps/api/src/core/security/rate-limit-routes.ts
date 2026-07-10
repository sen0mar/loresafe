import type { Application } from "express";

import {
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
  eventConnectionRateLimiter,
  expensiveReadRateLimiter,
  inviteAcceptRateLimiter,
  loginRateLimiter,
  logoutRateLimiter,
  moderationActionRateLimiter,
  notificationMutationRateLimiter,
  postCommentCreateRateLimiter,
  postReactionToggleRateLimiter,
  profileUpdateRateLimiter,
  postImageUploadRateLimiter,
  publicSeoReadRateLimiter,
  publicAssetUploadRateLimiter,
  reportCreateRateLimiter,
  searchRateLimiter,
  signupRateLimiter
} from "./rate-limit.js";

export type RateLimiterApp = Pick<
  Application,
  "delete" | "get" | "patch" | "post" | "use"
>;

export const registerRateLimiters = (app: RateLimiterApp) => {
  // Keep these before JSON parsing so blocked requests avoid expensive work.
  app.use("/api/auth/login", loginRateLimiter);
  app.use("/api/auth/logout", logoutRateLimiter);
  app.use("/api/auth/signup", signupRateLimiter);
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
  app.post("/api/posts/:postId/reveal", contentRevealRateLimiter);
  app.post(
    "/api/posts/:postId/comments/:commentId/reveal",
    contentRevealRateLimiter
  );
  app.post("/api/reports", reportCreateRateLimiter);
  app.get("/api/search", searchRateLimiter);
  app.get("/api/events", eventConnectionRateLimiter);
  app.get("/api/clubs/:linkName/stats", expensiveReadRateLimiter);
  app.get(
    "/api/clubs/:linkName/popular-discussions",
    expensiveReadRateLimiter
  );
  app.get("/api/clubs/:linkName/progress/summary", expensiveReadRateLimiter);
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
  app.delete("/api/notifications", notificationMutationRateLimiter);
  app.delete("/api/notifications/selected", notificationMutationRateLimiter);
};
