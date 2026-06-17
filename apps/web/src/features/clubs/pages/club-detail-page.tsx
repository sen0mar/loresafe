import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  FileWarning,
  Globe2,
  KeyRound,
  ListChecks,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
  type LucideIcon
} from "lucide-react";
import { toast } from "sonner";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { ClubFeedTab } from "@/features/clubs/components/club-feed-tab";
import { ClubMembersTab } from "@/features/clubs/components/club-members-tab";
import { ClubCoverUploadPanel } from "@/features/clubs/components/club-cover-upload-panel";
import { ClubDashboardPanels } from "@/features/clubs/components/club-dashboard-panels";
import { ClubMilestoneBuilderPanel } from "@/features/clubs/components/club-milestone-builder-panel";
import { ClubProgressPanel } from "@/features/clubs/components/club-progress-panel";
import { ClubTimelineTab } from "@/features/clubs/components/club-timeline-tab";
import { ClubInviteSection } from "@/features/invites/components/club-invite-section";
import { ApiError } from "@/shared/api/api-client";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/shared/components/ui/tabs";

import {
  type Club,
  type ClubMembershipRole,
  type ClubVisibility,
  useClubQuery,
  useJoinClubMutation
} from "../api/clubs.js";

const memberFormatter = new Intl.NumberFormat();

const visibilityMeta: Record<
  ClubVisibility,
  {
    label: string;
    icon: LucideIcon;
  }
> = {
  PUBLIC: {
    label: "Public",
    icon: Globe2
  },
  PRIVATE: {
    label: "Private",
    icon: LockKeyhole
  },
  INVITE_ONLY: {
    label: "Invite-only",
    icon: KeyRound
  }
};

const roleLabels: Record<ClubMembershipRole, string> = {
  OWNER: "Owner",
  MODERATOR: "Moderator",
  MEMBER: "Member"
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));

export const ClubDetailPage = () => {
  const { slug = "" } = useParams();
  const clubQuery = useClubQuery(slug);

  return (
    <AuthenticatedAppShell>
      <div className="space-y-4">
        {clubQuery.isPending ? (
          <ClubDetailLoading />
        ) : clubQuery.isError ? (
          <ClubDetailError
            error={clubQuery.error}
            onRetry={() => void clubQuery.refetch()}
          />
        ) : (
          <ClubDetailContent club={clubQuery.data.club} />
        )}
      </div>
    </AuthenticatedAppShell>
  );
};

const ClubDetailContent = ({ club }: { club: Club }) => {
  const VisibilityIcon = visibilityMeta[club.settings.visibility].icon;
  const joinClubMutation = useJoinClubMutation();
  const role = club.membership.role;
  const canModerate = role === "OWNER" || role === "MODERATOR";
  const canJoin =
    club.settings.visibility === "PUBLIC" && !club.membership.isMember;

  const joinClub = () => {
    joinClubMutation.mutate(club.slug, {
      onSuccess: () => {
        toast.success("Joined club");
      },
      onError: (error) => {
        const message =
          error instanceof ApiError
            ? error.message
            : "Could not join club. Try again.";

        toast.error(message);
      }
    });
  };

  return (
    <>
      <section className="flex flex-wrap items-start justify-between gap-4 border-b border-default pb-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start">
          {club.coverUrl ? (
            <img
              className="h-28 w-full rounded-xl border border-default object-cover sm:w-44"
              src={club.coverUrl}
              alt={`${club.title} cover`}
            />
          ) : null}
          <div className="min-w-0 space-y-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/explore">
                <ArrowLeft />
                Explore
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-normal text-primary sm:text-3xl">
              {club.title}
            </h1>
            <p className="text-sm text-faint">/{club.slug}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>
            <VisibilityIcon className="size-3" />
            {visibilityMeta[club.settings.visibility].label}
          </Badge>
          {role ? (
            <Badge>
              <ShieldCheck className="size-3" />
              {roleLabels[role]}
            </Badge>
          ) : (
            <Badge variant="secondary">
              <Users className="size-3" />
              Not a member
            </Badge>
          )}
          {canJoin ? (
            <Button onClick={joinClub} disabled={joinClubMutation.isPending}>
              <UserPlus />
              {joinClubMutation.isPending ? "Joining" : "Join club"}
            </Button>
          ) : null}
        </div>
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Tabs defaultValue="overview" className="min-w-0 max-w-full">
            <TabsList className="w-full overflow-x-auto sm:w-fit">
              <TabsTrigger value="overview">
                <BookOpen className="mr-2 size-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="settings">
                <ShieldCheck className="mr-2 size-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="timeline">
                <ListChecks className="mr-2 size-4" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="members">
                <Users className="mr-2 size-4" />
                Members
              </TabsTrigger>
              <TabsTrigger value="feed">
                <MessageSquareText className="mr-2 size-4" />
                Feed
              </TabsTrigger>
            </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-muted">
                  {club.description ?? "No description yet."}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ClubMetric
                    icon={Users}
                    label="Members"
                    value={memberFormatter.format(club.memberCount)}
                  />
                  <ClubMetric
                    icon={CalendarDays}
                    label="Created"
                    value={formatDate(club.createdAt)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Safe settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ClubMetric
                  icon={VisibilityIcon}
                  label="Visibility"
                  value={visibilityMeta[club.settings.visibility].label}
                />
                <ClubCoverUploadPanel club={club} />
                {canModerate ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default bg-inset p-4">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 text-sm font-medium text-primary">
                        <FileWarning className="size-4 text-warning" />
                        Moderation reports
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        Review open reports without revealing unsafe content by default.
                      </p>
                    </div>
                    <Button asChild variant="secondary" size="sm">
                      <Link to={`/app/clubs/${club.slug}/settings/moderation`}>
                        Open queue
                      </Link>
                    </Button>
                  </div>
                ) : null}
                <div className="rounded-lg border border-default bg-inset p-4">
                  <h2 className="text-sm font-medium text-primary">Rules</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                    {club.settings.rules ?? "No rules posted yet."}
                  </p>
                </div>
                <ClubMilestoneBuilderPanel club={club} />
                <ClubInviteSection club={club} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline">
            <ClubTimelineTab club={club} />
          </TabsContent>

          <TabsContent value="members">
            <ClubMembersTab club={club} />
          </TabsContent>

          <TabsContent value="feed">
            <ClubFeedTab club={club} />
          </TabsContent>
          </Tabs>

          <ClubDashboardPanels club={club} />
        </div>

        <ClubProgressPanel
          slug={club.slug}
          clubTitle={club.title}
          isMember={club.membership.isMember}
        />
      </div>
    </>
  );
};

const ClubMetric = ({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) => (
  <div className="rounded-lg border border-default bg-inset p-4">
    <span className="flex items-center gap-2 text-xs text-faint">
      <Icon className="size-4" />
      {label}
    </span>
    <p className="mt-2 text-sm font-medium text-primary">{value}</p>
  </div>
);

const ClubDetailLoading = () => (
  <div className="space-y-4">
    <section className="space-y-3 border-b border-default pb-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-5 w-72" />
      <Skeleton className="h-4 w-32" />
    </section>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader>
          <Skeleton className="h-10 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </CardContent>
      </Card>
    </div>
  </div>
);

const ClubDetailError = ({
  error,
  onRetry
}: {
  error: Error;
  onRetry: () => void;
}) => {
  const isNotFound = error instanceof ApiError && error.statusCode === 404;

  return (
    <Card>
      <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl border border-default bg-inset text-warning">
          <LockKeyhole className="size-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-primary">
            {isNotFound ? "Club not found" : "Could not load club"}
          </h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted">
            {isNotFound
              ? "This club is unavailable from your account."
              : "Refresh the club page and try again."}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {isNotFound ? null : (
            <Button variant="secondary" onClick={onRetry}>
              <RefreshCw />
              Retry
            </Button>
          )}
          <Button variant={isNotFound ? "secondary" : "ghost"} asChild>
            <Link to="/app/explore">
              <ArrowLeft />
              Explore
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
