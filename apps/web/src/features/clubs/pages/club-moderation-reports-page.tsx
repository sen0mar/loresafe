import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  ChevronDown,
  Eye,
  EyeOff,
  FileWarning,
  Flag,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  Trash2,
  ShieldCheck,
  UserCircle
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
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
import { Textarea } from "@/shared/components/ui/textarea";

import {
  type ClubMilestone,
  type ModerationReport,
  type ReportReason,
  type RevealedModerationReport,
  useClubQuery,
  useBanReportedContentAuthorMutation,
  useDeleteReportedContentMutation,
  useHideReportedContentMutation,
  useResolveModerationReportMutation,
  useUpdateReportRequiredMilestoneMutation,
  useModerationReportsQuery,
  useRevealModerationReportMutation,
  useWarnReportedContentAuthorMutation,
  useClubMilestonesQuery
} from "../api/clubs.js";

const reasonLabels: Record<ReportReason, string> = {
  SPOILER: "Spoiler",
  HARASSMENT: "Harassment",
  HATE: "Hate",
  SPAM: "Spam",
  OFF_TOPIC: "Off topic",
  OTHER: "Other"
};

const statusLabels: Record<ModerationReport["target"]["status"], string> = {
  VISIBLE: "Visible",
  HIDDEN: "Hidden",
  DELETED: "Deleted",
  UNAVAILABLE: "Unavailable"
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

const formatUser = (user: { displayName: string; username: string | null }) =>
  user.username ? `${user.displayName} / ${user.username}` : user.displayName;

export const ClubModerationReportsPage = () => {
  const { slug = "" } = useParams();
  const clubQuery = useClubQuery(slug);
  const reportsQuery = useModerationReportsQuery(slug);
  const milestonesQuery = useClubMilestonesQuery(slug, 1);
  const reports =
    reportsQuery.data?.pages.flatMap((page) => page.reports) ?? [];

  return (
    <AuthenticatedAppShell>
      <div className="space-y-4">
        <section className="flex flex-wrap items-start justify-between gap-4 border-b border-default pb-4">
          <div className="min-w-0 space-y-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/app/clubs/${slug}`}>
                <ArrowLeft />
                Club settings
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-primary sm:text-3xl">
                Moderation reports
              </h1>
              <p className="mt-1 text-sm text-faint">
                {clubQuery.data?.club.title ?? `/${slug}`}
              </p>
            </div>
          </div>
          <Badge>
            <ShieldCheck className="size-3" />
            Open queue
          </Badge>
        </section>

        {reportsQuery.isPending ? (
          <ModerationReportsLoading />
        ) : reportsQuery.isError ? (
          <ModerationReportsError
            error={reportsQuery.error}
            onRetry={() => void reportsQuery.refetch()}
          />
        ) : reports.length === 0 ? (
          <ModerationReportsEmpty />
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <ModerationReportCard
                key={report.id}
                report={report}
                slug={slug}
                milestones={milestonesQuery.data?.milestones ?? []}
              />
            ))}
          </div>
        )}

        {reportsQuery.hasNextPage ? (
          <div className="flex flex-col gap-3 rounded-xl border border-default bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">{reports.length} loaded</p>
            <Button
              className="w-full sm:w-fit"
              type="button"
              variant="secondary"
              size="sm"
              disabled={reportsQuery.isFetchingNextPage}
              onClick={() => void reportsQuery.fetchNextPage()}
            >
              <ChevronDown />
              {reportsQuery.isFetchingNextPage ? "Loading..." : "Load more"}
            </Button>
          </div>
        ) : null}
      </div>
    </AuthenticatedAppShell>
  );
};

const ModerationReportCard = ({
  report,
  slug,
  milestones
}: {
  report: ModerationReport;
  slug: string;
  milestones: ClubMilestone[];
}) => {
  const [revealedReport, setRevealedReport] =
    useState<RevealedModerationReport | null>(null);
  const revealMutation = useRevealModerationReportMutation(slug);
  const target = revealedReport?.target ?? report.target;

  const revealReport = () => {
    revealMutation.mutate(report.id, {
      onSuccess: (response) => {
        setRevealedReport(response.report);
      },
      onError: (error) => {
        const message =
          error instanceof ApiError
            ? error.message
            : "Could not reveal this report.";

        toast.error(message);
      }
    });
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
              <Badge variant="warning">
                <FileWarning className="size-3" />
                {reasonLabels[report.reason]}
              </Badge>
              <Badge variant="outline">{report.targetType}</Badge>
              <Badge variant="secondary">
                {statusLabels[report.target.status]}
              </Badge>
              <span>{formatDateTime(report.createdAt)}</span>
            </div>
            <h2 className="text-base font-semibold text-primary">
              Reported {report.targetType.toLowerCase()}
            </h2>
          </div>
          <Badge>{report.status}</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ReportMetric
            icon={UserCircle}
            label="Reporter"
            value={formatUser(report.reporter)}
          />
          <ReportMetric
            icon={MessageSquareText}
            label="Target author"
            value={
              report.target.author
                ? formatUser(report.target.author)
                : "Unavailable"
            }
          />
        </div>

        <div className="rounded-lg border border-default bg-inset p-4">
          <p className="text-xs text-faint">Required milestone</p>
          <p className="mt-1 text-sm font-medium text-primary">
            {report.target.requiredMilestone
              ? `Milestone ${report.target.requiredMilestone.position}: ${report.target.requiredMilestone.label}`
              : "Unavailable"}
          </p>
        </div>

        {target.visibility === "REVEALED" && revealedReport ? (
          <RevealedReportContent report={revealedReport} />
        ) : (
          <HiddenReportWarning
            detailsHidden={report.detailsHidden}
            isRevealing={revealMutation.isPending}
            onReveal={revealReport}
          />
        )}

        <ModerationActionControls
          report={report}
          slug={slug}
          milestones={milestones}
        />
      </CardContent>
    </Card>
  );
};

const ModerationActionControls = ({
  report,
  slug,
  milestones
}: {
  report: ModerationReport;
  slug: string;
  milestones: ClubMilestone[];
}) => {
  const [moderatorNote, setModeratorNote] = useState("");
  const [requiredMilestoneId, setRequiredMilestoneId] = useState(
    report.target.requiredMilestone?.id ?? ""
  );
  const [banExpiresAt, setBanExpiresAt] = useState("");
  const updateMilestoneMutation = useUpdateReportRequiredMilestoneMutation(slug);
  const hideMutation = useHideReportedContentMutation(slug);
  const deleteMutation = useDeleteReportedContentMutation(slug);
  const warnMutation = useWarnReportedContentAuthorMutation(slug);
  const banMutation = useBanReportedContentAuthorMutation(slug);
  const resolveMutation = useResolveModerationReportMutation(slug);
  const isWorking =
    updateMilestoneMutation.isPending ||
    hideMutation.isPending ||
    deleteMutation.isPending ||
    warnMutation.isPending ||
    banMutation.isPending ||
    resolveMutation.isPending;
  const noteInput = moderatorNote.trim()
    ? {
        moderatorNote: moderatorNote.trim()
      }
    : {};

  const showActionError = (error: unknown) => {
    const message =
      error instanceof ApiError
        ? error.message
        : "Could not apply this moderation action.";

    toast.error(message);
  };

  const showActionSuccess = (message: string) => {
    toast.success(message);
    setModeratorNote("");
  };

  const submitRequiredMilestone = () => {
    if (!requiredMilestoneId) {
      toast.error("Choose a milestone first.");
      return;
    }

    updateMilestoneMutation.mutate(
      {
        reportId: report.id,
        input: {
          ...noteInput,
          requiredMilestoneId
        }
      },
      {
        onSuccess: () => showActionSuccess("Required milestone updated."),
        onError: showActionError
      }
    );
  };

  const submitNoteAction = (
    action: "hide" | "delete" | "warn",
    successMessage: string
  ) => {
    const mutation =
      action === "hide"
        ? hideMutation
        : action === "delete"
          ? deleteMutation
          : warnMutation;

    mutation.mutate(
      {
        reportId: report.id,
        input: noteInput
      },
      {
        onSuccess: () => showActionSuccess(successMessage),
        onError: showActionError
      }
    );
  };

  const submitBan = () => {
    banMutation.mutate(
      {
        reportId: report.id,
        input: {
          ...noteInput,
          ...(banExpiresAt
            ? {
                expiresAt: new Date(banExpiresAt).toISOString()
              }
            : {})
        }
      },
      {
        onSuccess: () => showActionSuccess("User banned."),
        onError: showActionError
      }
    );
  };

  const submitResolve = (status: "RESOLVED" | "DISMISSED") => {
    resolveMutation.mutate(
      {
        reportId: report.id,
        input: {
          ...noteInput,
          status
        }
      },
      {
        onSuccess: () =>
          showActionSuccess(
            status === "RESOLVED" ? "Report resolved." : "Report dismissed."
          ),
        onError: showActionError
      }
    );
  };

  return (
    <div className="space-y-3 rounded-lg border border-default bg-inset p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-2">
          <label
            className="text-xs font-medium text-faint"
            htmlFor={`report-${report.id}-milestone`}
          >
            Required milestone
          </label>
          <select
            id={`report-${report.id}-milestone`}
            className="h-10 w-full rounded-md border border-subtle bg-surface px-3 text-sm text-primary outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
            value={requiredMilestoneId}
            disabled={isWorking || milestones.length === 0}
            onChange={(event) => setRequiredMilestoneId(event.target.value)}
          >
            {milestones.length === 0 ? (
              <option value="">No milestones loaded</option>
            ) : (
              milestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.position}. {milestone.safeTitle}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="space-y-2">
          <label
            className="text-xs font-medium text-faint"
            htmlFor={`report-${report.id}-ban-expiry`}
          >
            Ban expires
          </label>
          <input
            id={`report-${report.id}-ban-expiry`}
            className="h-10 w-full rounded-md border border-subtle bg-surface px-3 text-sm text-primary outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
            type="datetime-local"
            value={banExpiresAt}
            disabled={isWorking}
            onChange={(event) => setBanExpiresAt(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          className="text-xs font-medium text-faint"
          htmlFor={`report-${report.id}-note`}
        >
          Moderator notes
        </label>
        <Textarea
          id={`report-${report.id}-note`}
          value={moderatorNote}
          maxLength={1000}
          disabled={isWorking}
          placeholder="Internal note for audit history"
          onChange={(event) => setModeratorNote(event.target.value)}
        />
      </div>

      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <Button
          className="w-full sm:w-fit"
          type="button"
          size="sm"
          variant="secondary"
          disabled={isWorking}
          onClick={submitRequiredMilestone}
        >
          <Flag />
          Adjust
        </Button>
        <Button
          className="w-full sm:w-fit"
          type="button"
          size="sm"
          variant="secondary"
          disabled={isWorking}
          onClick={() => submitNoteAction("hide", "Content hidden.")}
        >
          <EyeOff />
          Hide
        </Button>
        <Button
          className="w-full sm:w-fit"
          type="button"
          size="sm"
          variant="destructive"
          disabled={isWorking}
          onClick={() => submitNoteAction("delete", "Content deleted.")}
        >
          <Trash2 />
          Delete
        </Button>
        <Button
          className="w-full sm:w-fit"
          type="button"
          size="sm"
          variant="secondary"
          disabled={isWorking}
          onClick={() => submitNoteAction("warn", "User warned.")}
        >
          <AlertTriangle />
          Warn
        </Button>
        <Button
          className="w-full sm:w-fit"
          type="button"
          size="sm"
          variant="destructive"
          disabled={isWorking}
          onClick={submitBan}
        >
          <Ban />
          Ban
        </Button>
        <Button
          className="w-full sm:w-fit"
          type="button"
          size="sm"
          variant="outline"
          disabled={isWorking}
          onClick={() => submitResolve("RESOLVED")}
        >
          <ShieldCheck />
          Resolve
        </Button>
        <Button
          className="w-full sm:w-fit"
          type="button"
          size="sm"
          variant="ghost"
          disabled={isWorking}
          onClick={() => submitResolve("DISMISSED")}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
};

const RevealedReportContent = ({
  report
}: {
  report: RevealedModerationReport;
}) => (
  <div className="space-y-3 rounded-lg border border-strong bg-inset p-4">
    <div className="flex items-center gap-2 text-sm font-medium text-primary">
      <Eye className="size-4 text-warning" />
      Revealed content
    </div>
    {report.target.targetType === "POST" ? (
      <div>
        <p className="text-xs text-faint">Post title</p>
        <p className="mt-1 text-sm font-medium text-primary">
          {report.target.title}
        </p>
      </div>
    ) : null}
    <div>
      <p className="text-xs text-faint">Reported content</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted">
        {report.target.body}
      </p>
    </div>
    <div className="border-t border-subtle pt-3">
      <p className="text-xs text-faint">Reporter details</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted">
        {report.details ?? "No additional details."}
      </p>
    </div>
  </div>
);

const HiddenReportWarning = ({
  detailsHidden,
  isRevealing,
  onReveal
}: {
  detailsHidden: boolean;
  isRevealing: boolean;
  onReveal: () => void;
}) => (
  <div className="space-y-3 rounded-lg border border-default bg-inset p-4">
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-default bg-surface text-warning">
        <AlertTriangle className="size-4" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-primary">
          Reported content is hidden
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted">
          Revealing may show spoilers or unsafe text. Continue only when you
          need to inspect the report.
        </p>
        {detailsHidden ? (
          <p className="mt-2 text-xs text-faint">
            Reporter details are also hidden.
          </p>
        ) : null}
      </div>
    </div>
    <Button
      className="w-full sm:w-fit"
      type="button"
      variant="secondary"
      size="sm"
      disabled={isRevealing}
      onClick={onReveal}
    >
      <Eye />
      {isRevealing ? "Revealing..." : "Reveal content"}
    </Button>
  </div>
);

const ReportMetric = ({
  icon: Icon,
  label,
  value
}: {
  icon: typeof UserCircle;
  label: string;
  value: string;
}) => (
  <div className="rounded-lg border border-default bg-inset p-4">
    <span className="flex items-center gap-2 text-xs text-faint">
      <Icon className="size-4" />
      {label}
    </span>
    <p className="mt-2 truncate text-sm font-medium text-primary">{value}</p>
  </div>
);

const ModerationReportsLoading = () => (
  <div className="space-y-3">
    {Array.from({ length: 3 }).map((_, index) => (
      <Card key={index}>
        <CardHeader className="space-y-3">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    ))}
  </div>
);

const ModerationReportsEmpty = () => (
  <Card>
    <CardContent className="flex min-h-56 flex-col justify-center gap-3">
      <ShieldCheck className="size-8 text-faint" />
      <div>
        <h2 className="text-base font-semibold text-primary">
          No open reports
        </h2>
        <p className="mt-1 max-w-lg text-sm leading-6 text-muted">
          New reports from club members will appear here.
        </p>
      </div>
    </CardContent>
  </Card>
);

const ModerationReportsError = ({
  error,
  onRetry
}: {
  error: Error;
  onRetry: () => void;
}) => {
  const isDenied =
    error instanceof ApiError &&
    (error.statusCode === 403 || error.statusCode === 404);

  return (
    <Card>
      <CardContent className="flex min-h-56 flex-col justify-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg border border-default bg-inset text-warning">
          {isDenied ? (
            <LockKeyhole className="size-5" />
          ) : (
            <FileWarning className="size-5" />
          )}
        </span>
        <div>
          <h2 className="text-base font-semibold text-primary">
            {isDenied
              ? "Moderation queue unavailable"
              : "Could not load reports"}
          </h2>
          <p className="mt-1 max-w-lg text-sm leading-6 text-muted">
            {isDenied
              ? "Only club owners and moderators can review reports."
              : "Refresh this page and try again."}
          </p>
        </div>
        {isDenied ? null : (
          <Button className="w-fit" variant="secondary" onClick={onRetry}>
            <RefreshCw />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
