import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Globe2,
  KeyRound,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon
} from "lucide-react";
import { toast } from "sonner";

import { useLogout, useMe } from "@/features/auth/api/auth";
import { ApiError } from "@/shared/api/api-client";
import { AppShell } from "@/shared/components/layout/app-shell";
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
  useClubQuery
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
  const meQuery = useMe();
  const logoutMutation = useLogout();
  const clubQuery = useClubQuery(slug);
  const currentUser = meQuery.data;

  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Logged out");
      },
      onError: () => {
        toast.error("Could not log out. Try again.");
      }
    });
  };

  if (!currentUser) {
    return null;
  }

  return (
    <AppShell
      currentUser={currentUser}
      isCurrentUserLoading={meQuery.isPending}
      isLoggingOut={logoutMutation.isPending}
      onLogout={logout}
    >
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
    </AppShell>
  );
};

const ClubDetailContent = ({ club }: { club: Club }) => {
  const VisibilityIcon = visibilityMeta[club.settings.visibility].icon;
  const role = club.membership.role;

  return (
    <>
      <section className="flex flex-wrap items-start justify-between gap-4 border-b border-default pb-4">
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
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Tabs defaultValue="overview" className="min-w-0">
          <TabsList className="w-full overflow-x-auto sm:w-fit">
            <TabsTrigger value="overview">
              <BookOpen className="mr-2 size-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="settings">
              <ShieldCheck className="mr-2 size-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="activity">
              <MessageSquareText className="mr-2 size-4" />
              Activity
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
                <div className="rounded-lg border border-default bg-inset p-4">
                  <h2 className="text-sm font-medium text-primary">Rules</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                    {club.settings.rules ?? "No rules posted yet."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardContent className="flex min-h-48 flex-col justify-center gap-2">
                <h2 className="text-base font-semibold text-primary">
                  No discussions yet
                </h2>
                <p className="max-w-lg text-sm leading-6 text-muted">
                  Club conversations will appear here after posts are added.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Membership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted">
            <div className="rounded-lg border border-default bg-inset p-4">
              <p className="text-xs text-faint">Status</p>
              <p className="mt-1 font-medium text-primary">
                {club.membership.isMember ? "Member" : "Not a member"}
              </p>
            </div>
            {role ? (
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-brand" />
                {roleLabels[role]}
              </span>
            ) : null}
            {club.category ? (
              <span className="flex items-center gap-2">
                <Sparkles className="size-4 text-faint" />
                {club.category}
              </span>
            ) : null}
          </CardContent>
        </Card>
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
