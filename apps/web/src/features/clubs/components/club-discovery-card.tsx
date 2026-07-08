import { Link } from "react-router-dom";
import { Globe2, Sparkles, Users } from "lucide-react";

import type { ClubDiscoveryClub } from "@/features/clubs/api/clubs";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";

import { ClubAvatar } from "./club-avatar.js";
import { formatClubCategory } from "../lib/club-categories.js";

type ClubDiscoveryCardProps = {
  club: ClubDiscoveryClub;
  to?: string;
};

const memberFormatter = new Intl.NumberFormat();

export const ClubDiscoveryCard = ({
  club,
  to = `/app/clubs/${club.linkName}`
}: ClubDiscoveryCardProps) => (
  <Card className="group h-full transition-colors hover:border-strong">
    <Link
      aria-label={`Open ${club.title}`}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      to={to}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <ClubAvatar
            title={club.title}
            coverUrl={club.coverUrl}
            className="size-10 border-brand shadow-glow"
          />
          <Badge>
            <Globe2 className="size-3" />
            Public
          </Badge>
        </div>
        <div className="min-w-0">
          <CardTitle className="truncate text-lg transition-colors group-hover:text-brand">
            {club.title}
          </CardTitle>
          <p className="mt-1 truncate text-xs text-faint">/{club.linkName}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-muted">
          {club.description ?? "No description yet."}
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-muted">
          <span className="inline-flex items-center gap-2">
            <Users className="size-4 text-faint" />
            {memberFormatter.format(club.memberCount)}{" "}
            {club.memberCount === 1 ? "member" : "members"}
          </span>
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-faint" />
            {formatClubCategory(club.category)}
          </span>
        </div>
      </CardContent>
    </Link>
  </Card>
);
