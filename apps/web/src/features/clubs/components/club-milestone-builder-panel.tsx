import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useState } from "react";
import { EyeOff, FileText, ListPlus, Sparkles, Type } from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";

import { type Club, useCreateClubMilestoneMutation } from "../api/clubs.js";
import {
  createMilestoneFormSchema,
  type CreateMilestoneFormValues
} from "../schemas/milestone.schema.js";

type MilestoneFieldErrors = Partial<
  Record<keyof CreateMilestoneFormValues, string>
>;

const initialValues: CreateMilestoneFormValues = {
  safeTitle: "",
  fullTitle: "",
  description: "",
  spoilerName: false
};

export const ClubMilestoneBuilderPanel = ({ club }: { club: Club }) => {
  const role = club.membership.role;
  const canCreateMilestone = role === "OWNER" || role === "MODERATOR";
  const createMilestoneMutation = useCreateClubMilestoneMutation(club.slug);
  const [values, setValues] =
    useState<CreateMilestoneFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<MilestoneFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (!canCreateMilestone) {
    return null;
  }

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
      setFormError(null);
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
    setFormError(null);
  };

  const submitMilestone = (event: FormEvent<HTMLFormElement>) => {
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
    setFormError(null);
    createMilestoneMutation.mutate(parseResult.data, {
      onSuccess: () => {
        setValues(initialValues);
        toast.success("Milestone added");
      },
      onError: (error) => {
        setFormError(
          error instanceof ApiError
            ? error.message
            : "Could not add milestone. Try again."
        );
      }
    });
  };

  return (
    <div className="rounded-lg border border-default bg-inset p-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-medium text-primary">
          <ListPlus className="size-4 text-brand" />
          Milestone builder
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Add one checkpoint to the end of this club timeline.
        </p>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={submitMilestone} noValidate>
        {formError ? (
          <div
            className="rounded-lg border border-default bg-surface p-3"
            role="alert"
          >
            <p className="text-sm text-error">{formError}</p>
          </div>
        ) : null}

        <MilestoneFormField
          id="milestone-safe-title"
          label="Safe title"
          error={fieldErrors.safeTitle}
          icon={<Sparkles className="size-4" />}
        >
          <Input
            id="milestone-safe-title"
            type="text"
            value={values.safeTitle}
            onChange={updateField("safeTitle")}
            disabled={createMilestoneMutation.isPending}
            aria-invalid={!!fieldErrors.safeTitle}
            aria-describedby={
              fieldErrors.safeTitle ? "milestone-safe-title-error" : undefined
            }
            maxLength={120}
          />
        </MilestoneFormField>

        <MilestoneFormField
          id="milestone-full-title"
          label="Full title"
          error={fieldErrors.fullTitle}
          icon={<Type className="size-4" />}
        >
          <Input
            id="milestone-full-title"
            type="text"
            value={values.fullTitle ?? ""}
            onChange={updateField("fullTitle")}
            disabled={createMilestoneMutation.isPending}
            aria-invalid={!!fieldErrors.fullTitle}
            aria-describedby={
              fieldErrors.fullTitle ? "milestone-full-title-error" : undefined
            }
            maxLength={160}
          />
        </MilestoneFormField>

        <MilestoneFormField
          id="milestone-description"
          label="Description"
          error={fieldErrors.description}
          icon={<FileText className="size-4" />}
        >
          <Textarea
            id="milestone-description"
            value={values.description ?? ""}
            onChange={updateField("description")}
            disabled={createMilestoneMutation.isPending}
            aria-invalid={!!fieldErrors.description}
            aria-describedby={
              fieldErrors.description
                ? "milestone-description-error"
                : undefined
            }
            maxLength={500}
          />
        </MilestoneFormField>

        <label className="flex items-start gap-3 rounded-lg border border-default bg-surface p-3 text-sm text-muted">
          <input
            type="checkbox"
            className="mt-1 size-4 rounded border-default bg-inset accent-[var(--accent-primary)]"
            checked={values.spoilerName}
            onChange={updateSpoilerName}
            disabled={createMilestoneMutation.isPending}
          />
          <span className="grid gap-1">
            <span className="flex items-center gap-2 font-medium text-secondary">
              <EyeOff className="size-4 text-faint" />
              Hide full title on the public timeline
            </span>
            <span>
              Readers will see the safe title until this name is safe to show.
            </span>
          </span>
        </label>

        <Button
          type="submit"
          className="justify-self-start"
          disabled={createMilestoneMutation.isPending}
        >
          <ListPlus />
          {createMilestoneMutation.isPending ? "Adding..." : "Add milestone"}
        </Button>
      </form>
    </div>
  );
};

const MilestoneFormField = ({
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
      <span className="text-faint">{icon}</span>
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
