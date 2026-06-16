import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Eye,
  FileWarning,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
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

import {
  type ModerationReport,
  type ReportReason,
  type RevealedModerationReport,
  useClubQuery,
  useModerationReportsQuery,
  useRevealModerationReportMutation
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
              />
            ))}
          </div>
        )}

        {reportsQuery.hasNextPage ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-default bg-surface p-3">
            <p className="text-sm text-muted">{reports.length} loaded</p>
            <Button
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
  slug
}: {
  report: ModerationReport;
  slug: string;
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
      </CardContent>
    </Card>
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
