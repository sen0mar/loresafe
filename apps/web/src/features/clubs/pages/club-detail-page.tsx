import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams
} from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  FileWarning,
  Globe2,
  KeyRound,
  ListChecks,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
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
import { ClubSettingsForm } from "@/features/clubs/components/club-settings-form";
import { ClubTimelineTab } from "@/features/clubs/components/club-timeline-tab";
import { ClubWelcomeProgressDialog } from "@/features/clubs/components/club-welcome-progress-dialog";
import { ClubInviteSection } from "@/features/invites/components/club-invite-section";
import { ApiError } from "@/shared/api/api-client";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader
} from "@/shared/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/shared/components/ui/dialog";
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
  useJoinClubMutation,
  useLeaveClubMutation
} from "../api/clubs.js";

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

type ClubDetailTab =
  | "feed"
  | "progress"
  | "overview"
  | "members"
  | "timeline"
  | "settings";

const clubDetailTabs = new Set<ClubDetailTab>([
  "feed",
  "progress",
  "overview",
  "members",
  "timeline",
  "settings"
]);

const getClubDetailTab = (value: string | null): ClubDetailTab =>
  value && clubDetailTabs.has(value as ClubDetailTab)
    ? (value as ClubDetailTab)
    : "overview";

export const ClubDetailPage = () => {
  const { linkName = "" } = useParams();
  const clubQuery = useClubQuery(linkName);

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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const VisibilityIcon = visibilityMeta[club.settings.visibility].icon;
  const joinClubMutation = useJoinClubMutation();
  const leaveClubMutation = useLeaveClubMutation();
  const role = club.membership.role;
  const canModerate = role === "OWNER" || role === "MODERATOR";
  const canJoin =
    club.settings.visibility === "PUBLIC" && !club.membership.isMember;
  const activeTab = getClubDetailTab(searchParams.get("tab"));

  const handleTabChange = (tab: string) => {
    const nextTab = getClubDetailTab(tab);
    const nextParams = new URLSearchParams(searchParams);

    if (nextTab === "overview") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", nextTab);
    }

    setSearchParams(nextParams, { replace: true });
  };

  const joinClub = () => {
    joinClubMutation.mutate(club.linkName, {
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

  const leaveClub = () => {
    leaveClubMutation.mutate(club.linkName, {
      onSuccess: () => {
        toast.success("Left club");
        navigate("/app/clubs", { replace: true });
      },
      onError: (error) => {
        const message =
          error instanceof ApiError
            ? error.message
            : "Could not leave club. Try again.";

        toast.error(message);
      }
    });
  };

  return (
    <>
      <ClubWelcomeProgressDialog
        clubTitle={club.title}
        isMember={club.membership.isMember}
        linkName={club.linkName}
      />
      <section className="soft-section-divider-bottom grid gap-4 pb-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start">
          {club.coverUrl ? (
            <img
              className="size-24 shrink-0 rounded-full border border-default object-cover sm:size-28"
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
            <p className="text-sm text-faint">/{club.linkName}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2 md:justify-end">
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
          {club.membership.isMember ? (
            <LeaveClubDialog
              clubTitle={club.title}
              isLeaving={leaveClubMutation.isPending}
              onLeave={leaveClub}
            />
          ) : null}
        </div>
      </section>

      <Tabs
        className="min-w-0 max-w-full"
        value={activeTab}
        onValueChange={handleTabChange}
      >
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="feed">
            <MessageSquareText className="mr-2 size-4" />
            Feed
          </TabsTrigger>
          <TabsTrigger value="progress">
            <TrendingUp className="mr-2 size-4" />
            Progress
          </TabsTrigger>
          <TabsTrigger value="overview">
            <BookOpen className="mr-2 size-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="mr-2 size-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <ListChecks className="mr-2 size-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="settings">
            <ShieldCheck className="mr-2 size-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed">
          <ClubFeedTab club={club} />
        </TabsContent>

        <TabsContent value="progress">
          <ClubProgressPanel
            linkName={club.linkName}
            clubTitle={club.title}
            isMember={club.membership.isMember}
          />
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <ClubDashboardPanels club={club} />
        </TabsContent>

        <TabsContent value="members">
          <ClubMembersTab club={club} />
        </TabsContent>

        <TabsContent value="timeline">
          <ClubTimelineTab club={club} />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardContent className="space-y-4 pt-4">
              <ClubSettingsForm club={club} />
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
                    <Link
                      to={`/app/clubs/${club.linkName}/settings/moderation`}
                    >
                      Open queue
                    </Link>
                  </Button>
                </div>
              ) : null}
              <ClubMilestoneBuilderPanel club={club} />
              <ClubInviteSection club={club} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
};

const LeaveClubDialog = ({
  clubTitle,
  isLeaving,
  onLeave
}: {
  clubTitle: string;
  isLeaving: boolean;
  onLeave: () => void;
}) => {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isLeaving) {
      setOpen(nextOpen);
    }
  };

  const handleLeave = () => {
    onLeave();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive" disabled={isLeaving}>
          <LogOut />
          {isLeaving ? "Leaving" : "Leave club"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave {clubTitle}?</DialogTitle>
          <DialogDescription>
            You will lose member access until you join again or receive a new
            invite.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isLeaving}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={isLeaving}
            onClick={handleLeave}
          >
            <LogOut />
            {isLeaving ? "Leaving" : "Leave club"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ClubDetailLoading = () => (
  <div className="space-y-4">
    <section className="soft-section-divider-bottom space-y-3 pb-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-5 w-72" />
      <Skeleton className="h-4 w-32" />
    </section>
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
  const isBanned = error instanceof ApiError && error.code === "BANNED";

  return (
    <Card>
      <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl border border-default bg-inset text-warning">
          <LockKeyhole className="size-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-primary">
            {isBanned
              ? "You're banned from this club"
              : isNotFound
                ? "Club not found"
                : "Could not load club"}
          </h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted">
            {isBanned
              ? error.message
              : isNotFound
                ? "This club is unavailable from your account."
                : "Refresh the club page and try again."}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {isNotFound || isBanned ? null : (
            <Button variant="secondary" onClick={onRetry}>
              <RefreshCw />
              Retry
            </Button>
          )}
          <Button variant={isNotFound || isBanned ? "secondary" : "ghost"} asChild>
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
