import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  FileText,
  ListChecks,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
  Type,
  X
} from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/api-client";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Textarea } from "@/shared/components/ui/textarea";

import {
  type Club,
  type ClubMilestone,
  useClubProgressQuery,
  useClubMilestonesQuery,
  useMoveClubMilestoneMutation,
  useUpdateClubMilestoneMutation
} from "../api/clubs.js";
import {
  createMilestoneFormSchema,
  type CreateMilestoneFormValues,
  type CreateMilestonePayload
} from "../schemas/milestone.schema.js";

type ClubTimelineTabProps = {
  club?: Club;
  linkName?: string;
};
type MilestoneFieldErrors = Partial<
  Record<keyof CreateMilestoneFormValues, string>
>;

export const ClubTimelineTab = ({
  club,
  linkName: fallbackLinkName
}: ClubTimelineTabProps) => {
  const linkName = club?.linkName ?? fallbackLinkName ?? "";
  const [page, setPage] = useState(1);
  const milestonesQuery = useClubMilestonesQuery(linkName, page);
  const { refetch: refetchMilestones } = milestonesQuery;
  const progressQuery = useClubProgressQuery(
    linkName,
    !!club?.membership.isMember
  );
  const updateMilestoneMutation = useUpdateClubMilestoneMutation(linkName);
  const moveMilestoneMutation = useMoveClubMilestoneMutation(linkName);
  const progress = progressQuery.data?.progress;
  const canManageMilestones =
    club?.membership.role === "OWNER" || club?.membership.role === "MODERATOR";

  useEffect(() => {
    setPage(1);
  }, [linkName]);

  useEffect(() => {
    if (!progress) {
      return;
    }

    void refetchMilestones();
  }, [progress, refetchMilestones]);

  if (milestonesQuery.isPending) {
    return <TimelineLoading />;
  }

  if (milestonesQuery.isError) {
    return (
      <Card>
        <CardContent className="flex min-h-48 flex-col justify-center gap-3">
          <h2 className="text-base font-semibold text-primary">
            Timeline unavailable
          </h2>
          <p className="max-w-lg text-sm leading-6 text-muted">
            Milestones could not be loaded right now.
          </p>
          <Button
            className="w-fit"
            variant="secondary"
            onClick={() => void milestonesQuery.refetch()}
          >
            <RefreshCw />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { milestones, pagination } = milestonesQuery.data;

  if (milestones.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-48 flex-col justify-center gap-2">
          <ListChecks className="size-8 text-faint" />
          <h2 className="text-base font-semibold text-primary">
            No milestones yet
          </h2>
          <p className="max-w-lg text-sm leading-6 text-muted">
            This club does not have timeline checkpoints yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {milestones.map((milestone) => (
          <TimelineMilestoneCard
            canManage={canManageMilestones}
            isMutating={
              updateMilestoneMutation.isPending ||
              moveMilestoneMutation.isPending
            }
            key={milestone.id}
            milestone={milestone}
            totalMilestones={pagination.total}
            onMove={(direction) => {
              moveMilestoneMutation.mutate(
                {
                  milestoneId: milestone.id,
                  direction
                },
                {
                  onSuccess: () => {
                    toast.success("Milestone moved");
                  },
                  onError: (error) => {
                    toast.error(
                      error instanceof ApiError
                        ? error.message
                        : "Could not move milestone. Try again."
                    );
                  }
                }
              );
            }}
            onUpdate={(input, onSuccess) => {
              updateMilestoneMutation.mutate(
                {
                  milestoneId: milestone.id,
                  input
                },
                {
                  onSuccess: () => {
                    onSuccess();
                    toast.success("Milestone updated");
                  }
                }
              );
            }}
            updateError={
              updateMilestoneMutation.error instanceof ApiError
                ? updateMilestoneMutation.error.message
                : updateMilestoneMutation.isError
                  ? "Could not update milestone. Try again."
                  : null
            }
          />
        ))}
      </ol>

      {pagination.pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-default bg-surface p-3">
          <p className="text-sm text-muted">
            Page {pagination.page} of {pagination.pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pagination.page <= 1 || milestonesQuery.isFetching}
              onClick={() => setPage((currentPage) => currentPage - 1)}
            >
              <ChevronLeft />
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={
                pagination.page >= pagination.pageCount ||
                milestonesQuery.isFetching
              }
              onClick={() => setPage((currentPage) => currentPage + 1)}
            >
              Next
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const TimelineMilestoneCard = ({
  canManage,
  isMutating,
  milestone,
  totalMilestones,
  onMove,
  onUpdate,
  updateError
}: {
  canManage: boolean;
  isMutating: boolean;
  milestone: ClubMilestone;
  totalMilestones: number;
  onMove: (direction: "UP" | "DOWN") => void;
  onUpdate: (input: CreateMilestonePayload, onSuccess: () => void) => void;
  updateError: string | null;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState<CreateMilestoneFormValues>(() =>
    milestoneToFormValues(milestone)
  );
  const [fieldErrors, setFieldErrors] = useState<MilestoneFieldErrors>({});
  const displayTitle = getMilestoneDisplayTitle(milestone);
  const hasUnlockedSpoilerTitle =
    milestone.fullTitle !== null && milestone.fullTitle !== milestone.safeTitle;

  useEffect(() => {
    if (!isEditing) {
      setValues(milestoneToFormValues(milestone));
    }
  }, [isEditing, milestone]);

  const updateField =
    (field: keyof Omit<CreateMilestoneFormValues, "spoilerName">) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((currentValues) => ({
        ...currentValues,
        [field]: event.target.value
      }));
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        [field]: undefined
      }));
    };

  const updateSpoilerName = (event: ChangeEvent<HTMLInputElement>) => {
    setValues((currentValues) => ({
      ...currentValues,
      spoilerName: event.target.checked
    }));
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      spoilerName: undefined
    }));
  };

  const submitUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parseResult = createMilestoneFormSchema.safeParse(values);

    if (!parseResult.success) {
      const flattenedErrors = parseResult.error.flatten().fieldErrors;

      setFieldErrors({
        safeTitle: flattenedErrors.safeTitle?.[0],
        fullTitle: flattenedErrors.fullTitle?.[0],
        description: flattenedErrors.description?.[0],
        spoilerName: flattenedErrors.spoilerName?.[0]
      });
      return;
    }

    setFieldErrors({});
    onUpdate(parseResult.data, () => setIsEditing(false));
  };

  return (
    <li className="grid gap-3 rounded-xl border border-default bg-elevated p-4 sm:grid-cols-[3rem_minmax(0,1fr)]">
      <div className="flex size-11 items-center justify-center rounded-lg border border-strong bg-active font-mono text-sm font-medium text-brand">
        {milestone.position}
      </div>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="text-base font-semibold tracking-normal text-primary">
              {displayTitle}
            </h3>
            {hasUnlockedSpoilerTitle ? (
              <p className="text-sm text-secondary">
                Spoiler free title: {milestone.safeTitle}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {milestone.isFullTitleHidden ? (
              <Badge variant="secondary">
                <EyeOff className="size-3" />
                Name hidden
              </Badge>
            ) : null}
            {canManage ? (
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  disabled={isMutating || milestone.position <= 1}
                  aria-label={`Move ${milestone.safeTitle} up`}
                  onClick={() => onMove("UP")}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  disabled={isMutating || milestone.position >= totalMilestones}
                  aria-label={`Move ${milestone.safeTitle} down`}
                  onClick={() => onMove("DOWN")}
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  disabled={isMutating}
                  aria-label={`Edit ${milestone.safeTitle}`}
                  onClick={() => setIsEditing((current) => !current)}
                >
                  {isEditing ? <X /> : <Pencil />}
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        {milestone.description ? (
          <p className="text-sm leading-6 text-muted">
            {milestone.description}
          </p>
        ) : null}

        {isEditing ? (
          <form
            className="grid gap-3 rounded-lg border border-default bg-surface p-3"
            onSubmit={submitUpdate}
            noValidate
          >
            {updateError ? (
              <p className="text-sm text-error" role="alert">
                {updateError}
              </p>
            ) : null}
            <MilestoneEditField
              id={`${milestone.id}-safe-title`}
              label="Spoiler free title"
              error={fieldErrors.safeTitle}
              icon={<Sparkles className="size-4 text-faint" />}
            >
              <Input
                id={`${milestone.id}-safe-title`}
                value={values.safeTitle}
                onChange={updateField("safeTitle")}
                disabled={isMutating}
                maxLength={120}
                aria-invalid={!!fieldErrors.safeTitle}
              />
            </MilestoneEditField>
            <MilestoneEditField
              id={`${milestone.id}-full-title`}
              label="Full spoiler title"
              error={fieldErrors.fullTitle}
              icon={<Type className="size-4 text-faint" />}
            >
              <Input
                id={`${milestone.id}-full-title`}
                value={values.fullTitle ?? ""}
                onChange={updateField("fullTitle")}
                disabled={isMutating}
                maxLength={160}
                aria-invalid={!!fieldErrors.fullTitle}
              />
            </MilestoneEditField>
            <MilestoneEditField
              id={`${milestone.id}-description`}
              label="Description"
              error={fieldErrors.description}
              icon={<FileText className="size-4 text-faint" />}
            >
              <Textarea
                id={`${milestone.id}-description`}
                value={values.description ?? ""}
                onChange={updateField("description")}
                disabled={isMutating}
                maxLength={500}
                aria-invalid={!!fieldErrors.description}
              />
            </MilestoneEditField>
            <label className="flex items-start gap-3 rounded-lg border border-default bg-inset p-3 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border-default bg-inset accent-[var(--accent-primary)]"
                checked={values.spoilerName}
                onChange={updateSpoilerName}
                disabled={isMutating}
              />
              <span className="grid gap-1">
                <span className="flex items-center gap-2 font-medium text-secondary">
                  <EyeOff className="size-4 text-faint" />
                  Hide full spoiler title on the public timeline
                </span>
                <span>
                  Readers will see the spoiler free title until the spoiler
                  title is safe to show, once the needed milestone has been
                  reached.
                </span>
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={isMutating}>
                <Save />
                {isMutating ? "Saving" : "Save"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isMutating}
                onClick={() => {
                  setValues(milestoneToFormValues(milestone));
                  setFieldErrors({});
                  setIsEditing(false);
                }}
              >
                <X />
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </li>
  );
};

const MilestoneEditField = ({
  id,
  label,
  error,
  icon,
  children
}: {
  id: string;
  label: string;
  error?: string;
  icon: ReactNode;
  children: ReactNode;
}) => (
  <div className="grid gap-2">
    <label
      className="flex items-center gap-2 text-sm font-medium text-secondary"
      htmlFor={id}
    >
      {icon}
      {label}
    </label>
    {children}
    {error ? (
      <p className="text-sm text-error" id={`${id}-error`}>
        {error}
      </p>
    ) : null}
  </div>
);

const milestoneToFormValues = (
  milestone: ClubMilestone
): CreateMilestoneFormValues => ({
  safeTitle: milestone.safeTitle,
  fullTitle: milestone.fullTitle ?? "",
  description: milestone.description ?? "",
  spoilerName: milestone.spoilerName
});

const getMilestoneDisplayTitle = (milestone: ClubMilestone) =>
  milestone.fullTitle ?? milestone.safeTitle;

const TimelineLoading = () => (
  <Card>
    <CardContent className="space-y-3 p-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          className="grid gap-3 rounded-xl border border-default bg-elevated p-4 sm:grid-cols-[3rem_minmax(0,1fr)]"
          key={index}
        >
          <Skeleton className="size-11" />
          <div className="space-y-3">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);
