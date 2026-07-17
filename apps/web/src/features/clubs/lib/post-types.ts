import type { PostType } from "../api/clubs.types.js";

export const postTypeLabels: Record<PostType, string> = {
  DISCUSSION: "Discussion",
  QUESTION: "Question",
  THEORY: "Theory",
  PREDICTION: "Prediction",
  POLL: "Poll",
  REACTION: "Reaction",
  REVIEW: "Review",
  IMAGE_MEME: "Image/meme",
  QUOTE_COMMENTARY: "Quote",
  JUST_REACHED: "Just reached"
};
