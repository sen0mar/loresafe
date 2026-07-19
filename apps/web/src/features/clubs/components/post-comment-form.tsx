import { type ChangeEvent, type FormEvent, useState } from "react";
import { Send, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";

import {
  type ClubMilestone,
  type ClubPostRequiredMilestone,
  useCreatePostCommentMutation
} from "../api/clubs.js";
import {
  createCommentSchema,
  type CreateCommentFormValues
} from "../schemas/create-comment.schema.js";

export const CommentForm = ({
  baseMilestone,
  label,
  milestoneHelp,
  milestones,
  onCancel,
  onPosted,
  parentId,
  postId,
  submitLabel
}: {
  baseMilestone: ClubPostRequiredMilestone;
  label: string;
  milestoneHelp?: string;
  milestones: ClubMilestone[];
  onCancel?: () => void;
  onPosted?: () => void;
  parentId?: string;
  postId: string;
  submitLabel: string;
}) => {
  const [body, setBody] = useState("");
  const [requiredMilestoneId, setRequiredMilestoneId] = useState(
    baseMilestone.id
  );
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [errors, setErrors] = useState<{
    body?: string;
    requiredMilestoneId?: string;
  }>({});
  const createCommentMutation = useCreatePostCommentMutation(postId);
  const isSaving = createCommentMutation.isPending;
  const bodyId = parentId ? `reply-${parentId}-body` : "comment-body";
  const milestoneId = parentId
    ? `reply-${parentId}-required-milestone`
    : "comment-required-milestone";
  const advancedOptionsId = parentId
    ? `reply-${parentId}-advanced-options`
    : "comment-advanced-options";
  const eligibleMilestones = milestones.filter(
    (milestone) => milestone.position >= baseMilestone.position
  );
  const milestoneOptions = eligibleMilestones.some(
    (milestone) => milestone.id === baseMilestone.id
  )
    ? eligibleMilestones
    : [
        {
          id: baseMilestone.id,
          position: baseMilestone.position,
          safeTitle: baseMilestone.label,
          fullTitle: null,
          description: null,
          spoilerName: false,
          isFullTitleHidden: false
        },
        ...eligibleMilestones
      ];

  const updateBody = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setBody(event.target.value);
    setErrors((currentErrors) => ({
      ...currentErrors,
      body: undefined
    }));
  };

  const updateMilestone = (event: ChangeEvent<HTMLSelectElement>) => {
    setRequiredMilestoneId(event.target.value);
    setErrors((currentErrors) => ({
      ...currentErrors,
      requiredMilestoneId: undefined
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const values: CreateCommentFormValues = {
      body,
      parentId,
      requiredMilestoneId:
        requiredMilestoneId === baseMilestone.id
          ? undefined
          : requiredMilestoneId
    };
    const parseResult = createCommentSchema.safeParse(values);

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      setErrors({
        body: fieldErrors.body?.[0],
        requiredMilestoneId: fieldErrors.requiredMilestoneId?.[0]
      });
      return;
    }

    createCommentMutation.mutate(parseResult.data, {
      onSuccess: () => {
        toast.success("Comment posted");
        setBody("");
        setRequiredMilestoneId(baseMilestone.id);
        setErrors({});
        onPosted?.();
      },
      onError: (mutationError) => {
        toast.error(
          mutationError instanceof ApiError
            ? mutationError.message
            : "Could not post comment. Try again."
        );
      }
    });
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <label
        className="grid gap-2 text-sm font-medium text-secondary"
        htmlFor={bodyId}
      >
        {label}
        <Textarea
          id={bodyId}
          value={body}
          onChange={updateBody}
          disabled={isSaving}
          rows={parentId ? 3 : 4}
          maxLength={8000}
          placeholder="Share a spoiler-safe thought..."
          aria-invalid={!!errors.body}
          aria-describedby={errors.body ? `${bodyId}-error` : undefined}
        />
        {errors.body ? (
          <span id={`${bodyId}-error`} className="text-xs text-warning">
            {errors.body}
          </span>
        ) : null}
      </label>
      <div className="space-y-3 rounded-lg border border-default bg-inset p-3">
        <button
          className="flex w-full items-center justify-between gap-3 rounded-md text-left text-xs font-medium text-secondary transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          type="button"
          aria-controls={advancedOptionsId}
          aria-expanded={isAdvancedOpen}
          onClick={() => setIsAdvancedOpen((isOpen) => !isOpen)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <SlidersHorizontal className="size-4 text-brand" />
            Advanced comment options
          </span>
          <span className="shrink-0 text-faint">
            Milestone{" "}
            {getSelectedMilestoneLabel(requiredMilestoneId, milestoneOptions)}
          </span>
        </button>
        {isAdvancedOpen ? (
          <label
            id={advancedOptionsId}
            className="grid gap-2 text-xs font-medium text-secondary"
            htmlFor={milestoneId}
          >
            Requires later milestone
            <select
              id={milestoneId}
              className="h-10 w-full rounded-md border border-subtle bg-inset px-3 text-sm text-primary outline-none transition focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
              value={requiredMilestoneId}
              onChange={updateMilestone}
              disabled={isSaving}
              aria-invalid={!!errors.requiredMilestoneId}
              aria-describedby={
                errors.requiredMilestoneId
                  ? `${milestoneId}-error`
                  : milestoneHelp
                    ? `${milestoneId}-help`
                    : undefined
              }
            >
              {milestoneOptions.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.position}. {milestone.safeTitle}
                </option>
              ))}
            </select>
            {errors.requiredMilestoneId ? (
              <span id={`${milestoneId}-error`} className="text-warning">
                {errors.requiredMilestoneId}
              </span>
            ) : milestoneHelp ? (
              <span id={`${milestoneId}-help`} className="text-faint">
                {milestoneHelp}
              </span>
            ) : null}
          </label>
        ) : null}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            className="w-full sm:w-fit"
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSaving}
          >
            <X />
            Cancel
          </Button>
        ) : null}
        <Button className="w-full sm:w-fit" type="submit" disabled={isSaving}>
          <Send />
          {isSaving ? "Posting..." : submitLabel}
        </Button>
      </div>
    </form>
  );
};

const getSelectedMilestoneLabel = (
  selectedMilestoneId: string,
  milestones: ClubMilestone[]
) =>
  milestones.find((milestone) => milestone.id === selectedMilestoneId)
    ?.position ?? "";
