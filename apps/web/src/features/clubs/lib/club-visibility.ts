import { Globe2, KeyRound, LockKeyhole, type LucideIcon } from "lucide-react";

import type { ClubVisibility } from "../api/clubs.types.js";

export type ClubVisibilityMetadata = {
  description: string;
  icon: LucideIcon;
  label: string;
  value: ClubVisibility;
};

export const clubVisibilityMetadata: Record<
  ClubVisibility,
  ClubVisibilityMetadata
> = {
  PUBLIC: {
    value: "PUBLIC",
    label: "Public",
    description: "Listed in discovery for signed-in readers.",
    icon: Globe2
  },
  PRIVATE: {
    value: "PRIVATE",
    label: "Private",
    description: "Only members can open the club page.",
    icon: LockKeyhole
  },
  INVITE_ONLY: {
    value: "INVITE_ONLY",
    label: "Invite-only",
    description: "Hidden from discovery and reserved for invites.",
    icon: KeyRound
  }
};

export const clubVisibilityOptions = [
  clubVisibilityMetadata.PUBLIC,
  clubVisibilityMetadata.PRIVATE,
  clubVisibilityMetadata.INVITE_ONLY
];

export const formatClubVisibility = (visibility: ClubVisibility) =>
  clubVisibilityMetadata[visibility].label;
