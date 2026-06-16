import { type ChangeEvent, type FormEvent, useState } from "react";
import { CheckCircle2, Flag, Send } from "lucide-react";

import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
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
import { Textarea } from "@/shared/components/ui/textarea";

import {
  type ReportReason,
  type ReportTargetType,
  useCreateReportMutation
} from "../api/clubs.js";
import {
  createReportSchema,
  type CreateReportFormValues
} from "../schemas/report.schema.js";

type ReportDialogProps = {
  targetId: string;
  targetType: ReportTargetType;
};

const reasonLabels: Record<ReportReason, string> = {
  SPOILER: "Spoiler issue",
  HARASSMENT: "Harassment",
  HATE: "Hate or abuse",
  SPAM: "Spam",
  OFF_TOPIC: "Off topic",
  OTHER: "Other"
};

const reasonOptions = Object.entries(reasonLabels) as Array<
  [ReportReason, string]
>;

export const ReportDialog = ({ targetId, targetType }: ReportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CreateReportFormValues>({
    reason: "SPOILER",
    details: ""
  });
  const [errors, setErrors] = useState<{
    details?: string;
    form?: string;
    reason?: string;
  }>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const createReportMutation = useCreateReportMutation();
  const isSaving = createReportMutation.isPending;
  const targetLabel = targetType === "POST" ? "post" : "comment";

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen && !isSaving) {
      setValues({
        reason: "SPOILER",
        details: ""
      });
      setErrors({});
      setIsSuccess(false);
    }
  };

  const updateReason = (event: ChangeEvent<HTMLSelectElement>) => {
    setValues((currentValues) => ({
      ...currentValues,
      reason: event.target.value as ReportReason
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      reason: undefined,
      form: undefined
    }));
  };

  const updateDetails = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setValues((currentValues) => ({
      ...currentValues,
      details: event.target.value
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      details: undefined,
      form: undefined
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parseResult = createReportSchema.safeParse(values);

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;

      setErrors({
        reason: fieldErrors.reason?.[0],
        details: fieldErrors.details?.[0]
      });
      return;
    }

    createReportMutation.mutate(
      {
        targetType,
        targetId,
        reason: parseResult.data.reason,
        details: parseResult.data.details || undefined
      },
      {
        onSuccess: () => {
          setIsSuccess(true);
          setErrors({});
        },
        onError: (error) => {
          setErrors({
            form:
              error instanceof ApiError
                ? error.message
                : "Could not submit this report. Try again."
          });
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost">
          <Flag />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        {isSuccess ? (
          <div className="space-y-4">
            <DialogHeader>
              <span className="flex size-10 items-center justify-center rounded-lg border border-default bg-active text-success">
                <CheckCircle2 className="size-5" />
              </span>
              <DialogTitle>Report submitted</DialogTitle>
              <DialogDescription>
                Moderators can review this {targetLabel} without exposing unsafe
                content to anyone else.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button">Done</Button>
              </DialogClose>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Report {targetLabel}</DialogTitle>
              <DialogDescription>
                Send this to moderators for review.
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label
                className="grid gap-2 text-sm font-medium text-secondary"
                htmlFor={`report-${targetType}-${targetId}-reason`}
              >
                Reason
                <select
                  id={`report-${targetType}-${targetId}-reason`}
                  className="h-10 rounded-md border border-subtle bg-inset px-3 text-sm text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
                  value={values.reason}
                  onChange={updateReason}
                  disabled={isSaving}
                  aria-invalid={!!errors.reason}
                >
                  {reasonOptions.map(([reason, label]) => (
                    <option key={reason} value={reason}>
                      {label}
                    </option>
                  ))}
                </select>
                {errors.reason ? (
                  <span className="text-xs font-normal text-warning">
                    {errors.reason}
                  </span>
                ) : null}
              </label>

              <label
                className="grid gap-2 text-sm font-medium text-secondary"
                htmlFor={`report-${targetType}-${targetId}-details`}
              >
                Details
                <Textarea
                  id={`report-${targetType}-${targetId}-details`}
                  value={values.details ?? ""}
                  onChange={updateDetails}
                  disabled={isSaving}
                  maxLength={1000}
                  rows={4}
                  placeholder="Add context for moderators."
                  aria-invalid={!!errors.details}
                />
                {errors.details ? (
                  <span className="text-xs font-normal text-warning">
                    {errors.details}
                  </span>
                ) : null}
              </label>

              {errors.form ? (
                <p className="rounded-lg border border-default bg-inset p-3 text-sm text-warning">
                  {errors.form}
                </p>
              ) : null}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary" disabled={isSaving}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSaving}>
                  <Send />
                  {isSaving ? "Submitting..." : "Submit report"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
