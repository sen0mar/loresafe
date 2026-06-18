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

type ClubDiscoveryCardProps = {
  club: ClubDiscoveryClub;
};

const memberFormatter = new Intl.NumberFormat();

export const ClubDiscoveryCard = ({ club }: ClubDiscoveryCardProps) => (
  <Card className="group h-full transition-colors hover:border-strong">
    <Link
      aria-label={`Open ${club.title}`}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      to={`/app/clubs/${club.slug}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-brand bg-active text-brand shadow-glow">
            <Globe2 className="size-5" />
          </span>
          <Badge>
            <Globe2 className="size-3" />
            Public
          </Badge>
        </div>
        <div className="min-w-0">
          <CardTitle className="truncate text-lg transition-colors group-hover:text-brand">
            {club.title}
          </CardTitle>
          <p className="mt-1 truncate text-xs text-faint">/{club.slug}</p>
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
          {club.category ? (
            <span className="inline-flex items-center gap-2">
              <Sparkles className="size-4 text-faint" />
              {club.category}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Link>
  </Card>
);
