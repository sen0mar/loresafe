import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Globe2,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import { toast } from "sonner";

import { useLogout, useMe } from "@/features/auth/api/auth";
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
    icon: typeof Globe2;
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
          <ClubDetailError onRetry={() => void clubQuery.refetch()} />
        ) : (
          <ClubDetailContent club={clubQuery.data.club} />
        )}
      </div>
    </AppShell>
  );
};

const ClubDetailContent = ({ club }: { club: Club }) => {
  const VisibilityIcon = visibilityMeta[club.visibility].icon;

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
            {visibilityMeta[club.visibility].label}
          </Badge>
          {club.currentUserRole ? (
            <Badge>
              <ShieldCheck className="size-3" />
              {roleLabels[club.currentUserRole]}
            </Badge>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted">
              {club.description ?? "No description yet."}
            </p>
            {club.rules ? (
              <div className="rounded-lg border border-default bg-inset p-4">
                <h2 className="text-sm font-medium text-primary">Rules</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                  {club.rules}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Club details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted">
            <span className="flex items-center gap-2">
              <Users className="size-4 text-faint" />
              {memberFormatter.format(club.memberCount)}{" "}
              {club.memberCount === 1 ? "member" : "members"}
            </span>
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

const ClubDetailLoading = () => (
  <div className="space-y-4">
    <section className="space-y-3 border-b border-default pb-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-5 w-72" />
      <Skeleton className="h-4 w-32" />
    </section>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
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

const ClubDetailError = ({ onRetry }: { onRetry: () => void }) => (
  <Card>
    <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-default bg-inset text-warning">
        <LockKeyhole className="size-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-primary">Club not found</h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted">
          The club may be private, invite-only, or unavailable.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw />
          Retry
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/app/explore">
            <ArrowLeft />
            Explore
          </Link>
        </Button>
      </div>
    </CardContent>
  </Card>
);
