import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useId, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Clapperboard,
  EyeOff,
  FileText,
  Film,
  Gamepad2,
  GraduationCap,
  ListChecks,
  ListPlus,
  Podcast,
  Sparkles,
  Type
} from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  LiquidSelectionIndicator,
  useLiquidSelection
} from "@/shared/components/ui/liquid-selection";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";

import {
  type Club,
  type MilestoneTemplate,
  useCreateClubMilestoneMutation,
  useCreateClubMilestoneTemplateMutation
} from "../api/clubs.js";
import {
  createMilestoneFormSchema,
  createMilestoneTemplateFormSchema,
  type CreateMilestoneFormValues
} from "../schemas/milestone.schema.js";

type BuilderMode = "manual" | "template";
type MilestoneFieldErrors = Partial<
  Record<keyof CreateMilestoneFormValues, string>
>;
type TemplateFormValues = {
  template: MilestoneTemplate;
  count: string;
};
type TemplateFieldErrors = Partial<Record<keyof TemplateFormValues, string>>;

const initialValues: CreateMilestoneFormValues = {
  safeTitle: "",
  fullTitle: "",
  description: "",
  spoilerName: false
};

const initialTemplateValues: TemplateFormValues = {
  template: "BOOK",
  count: "12"
};

const templateOptions: Array<{
  value: MilestoneTemplate;
  label: string;
  previewPrefix: string;
  icon: ReactNode;
}> = [
  {
    value: "BOOK",
    label: "Book",
    previewPrefix: "Chapter",
    icon: <BookOpen className="size-4" />
  },
  {
    value: "SHOW",
    label: "Show",
    previewPrefix: "Episode",
    icon: <Clapperboard className="size-4" />
  },
  {
    value: "MOVIE",
    label: "Movie",
    previewPrefix: "Part",
    icon: <Film className="size-4" />
  },
  {
    value: "GAME",
    label: "Game",
    previewPrefix: "Mission",
    icon: <Gamepad2 className="size-4" />
  },
  {
    value: "PODCAST_COURSE",
    label: "Podcast/course",
    previewPrefix: "Episode",
    icon: <Podcast className="size-4" />
  },
  {
    value: "CUSTOM",
    label: "Custom",
    previewPrefix: "Checkpoint",
    icon: <GraduationCap className="size-4" />
  }
];

export const ClubMilestoneBuilderPanel = ({ club }: { club: Club }) => {
  const role = club.membership.role;
  const canCreateMilestone = role === "OWNER" || role === "MODERATOR";
  const createMilestoneMutation = useCreateClubMilestoneMutation(club.linkName);
  const createTemplateMutation = useCreateClubMilestoneTemplateMutation(
    club.linkName
  );
  const [mode, setMode] = useState<BuilderMode>("template");
  const [values, setValues] =
    useState<CreateMilestoneFormValues>(initialValues);
  const [templateValues, setTemplateValues] =
    useState<TemplateFormValues>(initialTemplateValues);
  const [fieldErrors, setFieldErrors] = useState<MilestoneFieldErrors>({});
  const [templateErrors, setTemplateErrors] = useState<TemplateFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const builderContentId = useId();
  const templatePreviewNames = useMemo(
    () => generatePreviewNames(templateValues),
    [templateValues]
  );
  const isManualPending = createMilestoneMutation.isPending;
  const isTemplatePending = createTemplateMutation.isPending;

  if (!canCreateMilestone) {
    return null;
  }

  const setBuilderMode = (nextMode: BuilderMode) => {
    setMode(nextMode);
    setFormError(null);
    setTemplateError(null);
  };

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

  const updateTemplate = (template: MilestoneTemplate) => {
    setTemplateValues((currentValues) => ({
      ...currentValues,
      template
    }));
    setTemplateErrors((currentErrors) => ({
      ...currentErrors,
      template: undefined
    }));
    setTemplateError(null);
  };

  const updateTemplateCount = (event: ChangeEvent<HTMLInputElement>) => {
    setTemplateValues((currentValues) => ({
      ...currentValues,
      count: event.target.value
    }));
    setTemplateErrors((currentErrors) => ({
      ...currentErrors,
      count: undefined
    }));
    setTemplateError(null);
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

  const submitTemplate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parseResult = createMilestoneTemplateFormSchema.safeParse({
      template: templateValues.template,
      count: Number(templateValues.count)
    });

    if (!parseResult.success) {
      const flattenedErrors = parseResult.error.flatten().fieldErrors;

      setTemplateErrors({
        template: flattenedErrors.template?.[0],
        count: flattenedErrors.count?.[0]
      });
      return;
    }

    setTemplateErrors({});
    setTemplateError(null);
    createTemplateMutation.mutate(parseResult.data, {
      onSuccess: (response) => {
        toast.success(`${response.milestones.length} milestones generated`);
      },
      onError: (error) => {
        setTemplateError(
          error instanceof ApiError
            ? error.message
            : "Could not generate milestones. Try again."
        );
      }
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-default bg-inset">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors duration-150 hover:bg-active focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        aria-controls={builderContentId}
        aria-expanded={isBuilderOpen}
        onClick={() => setIsBuilderOpen((isOpen) => !isOpen)}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium text-primary">
            <ListPlus className="size-4 text-brand" />
            Milestone builder
          </span>
          <span className="mt-1 block text-sm leading-6 text-muted">
            Add one checkpoint or generate an empty timeline from a template.
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-faint transition-transform duration-150",
            isBuilderOpen && "rotate-180 text-brand"
          )}
          aria-hidden="true"
        />
      </button>

      <div
        id={builderContentId}
        className={cn(
          "grid transition-[border-color,grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          isBuilderOpen
            ? "grid-rows-[1fr] border-t border-default"
            : "grid-rows-[0fr] border-t border-transparent"
        )}
        aria-hidden={!isBuilderOpen}
        data-state={isBuilderOpen ? "open" : "closed"}
        inert={!isBuilderOpen}
      >
        <div
          className={cn(
            "min-h-0 overflow-hidden transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
            isBuilderOpen
              ? "translate-y-0 opacity-100 delay-75"
              : "-translate-y-1 opacity-0"
          )}
        >
          <div className="px-4 pb-4 pt-4">
            <BuilderModeSelector
              disabled={isManualPending || isTemplatePending}
              mode={mode}
              onModeChange={setBuilderMode}
            />

            {mode === "manual" ? (
              <form
                className="mt-4 grid gap-3"
                onSubmit={submitMilestone}
                noValidate
              >
                {formError ? <FormError message={formError} /> : null}

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
                    disabled={isManualPending}
                    aria-invalid={!!fieldErrors.safeTitle}
                    aria-describedby={
                      fieldErrors.safeTitle
                        ? "milestone-safe-title-error"
                        : undefined
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
                    disabled={isManualPending}
                    aria-invalid={!!fieldErrors.fullTitle}
                    aria-describedby={
                      fieldErrors.fullTitle
                        ? "milestone-full-title-error"
                        : undefined
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
                    disabled={isManualPending}
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
                    disabled={isManualPending}
                  />
                  <span className="grid gap-1">
                    <span className="flex items-center gap-2 font-medium text-secondary">
                      <EyeOff className="size-4 text-faint" />
                      Hide full title on the public timeline
                    </span>
                    <span>
                      Readers will see the safe title until this name is safe to
                      show.
                    </span>
                  </span>
                </label>

                <Button
                  type="submit"
                  className="justify-self-start"
                  disabled={isManualPending}
                >
                  <ListPlus />
                  {isManualPending ? "Adding..." : "Add milestone"}
                </Button>
              </form>
            ) : (
              <form
                className="mt-4 grid gap-4"
                onSubmit={submitTemplate}
                noValidate
              >
                {templateError ? <FormError message={templateError} /> : null}

                <fieldset className="grid gap-2">
                  <legend className="text-sm font-medium text-secondary">
                    Template
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {templateOptions.map((option) => {
                      const isSelected =
                        templateValues.template === option.value;

                      return (
                        <label
                          className={cn(
                            "flex min-h-20 cursor-pointer flex-col gap-2 rounded-lg border border-default bg-surface p-3 text-sm transition-colors duration-150 hover:border-strong hover:bg-active",
                            isSelected &&
                              "border-brand bg-active text-brand shadow-glow"
                          )}
                          key={option.value}
                        >
                          <input
                            className="sr-only"
                            type="radio"
                            name="milestone-template"
                            value={option.value}
                            checked={isSelected}
                            onChange={() => updateTemplate(option.value)}
                            disabled={isTemplatePending}
                          />
                          <span className="flex items-center gap-2 font-medium text-primary">
                            <span className="text-brand">{option.icon}</span>
                            {option.label}
                          </span>
                          <span className="text-xs leading-5 text-muted">
                            {option.previewPrefix} 1, {option.previewPrefix} 2
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {templateErrors.template ? (
                    <p className="text-sm text-error" id="template-error">
                      {templateErrors.template}
                    </p>
                  ) : null}
                </fieldset>

                <MilestoneFormField
                  id="milestone-template-count"
                  label="Count"
                  error={templateErrors.count}
                  icon={<ListChecks className="size-4" />}
                >
                  <Input
                    id="milestone-template-count"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={200}
                    value={templateValues.count}
                    onChange={updateTemplateCount}
                    disabled={isTemplatePending}
                    aria-invalid={!!templateErrors.count}
                    aria-describedby={
                      templateErrors.count
                        ? "milestone-template-count-error"
                        : undefined
                    }
                  />
                </MilestoneFormField>

                <div className="rounded-lg border border-default bg-surface p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-sm font-medium text-secondary">
                      <Sparkles className="size-4 text-brand" />
                      Safe name preview
                    </h3>
                    <span className="font-mono text-xs text-faint">
                      {templatePreviewNames.length}
                    </span>
                  </div>
                  {templatePreviewNames.length > 0 ? (
                    <ol className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1">
                      {templatePreviewNames.map((name, index) => (
                        <li
                          className="flex items-center gap-3 rounded-md border border-subtle bg-inset px-3 py-2 text-sm text-secondary"
                          key={name}
                        >
                          <span className="w-8 font-mono text-xs text-brand">
                            {index + 1}
                          </span>
                          <span>{name}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-muted">
                      Enter a count from 1 to 200.
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="justify-self-start"
                  disabled={isTemplatePending}
                >
                  <ListChecks />
                  {isTemplatePending ? "Generating..." : "Generate milestones"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const BuilderModeSelector = ({
  disabled,
  mode,
  onModeChange
}: {
  disabled: boolean;
  mode: BuilderMode;
  onModeChange: (mode: BuilderMode) => void;
}) => {
  const builderModeSelection = useLiquidSelection<HTMLDivElement>(mode);

  return (
    <div
      ref={builderModeSelection.groupRef}
      className="liquid-selection-surface relative isolate grid grid-cols-2 gap-1 overflow-hidden rounded-lg border border-default bg-surface p-1"
    >
      <LiquidSelectionIndicator
        indicatorStyle={builderModeSelection.indicatorStyle}
        isVisible={builderModeSelection.isIndicatorVisible}
        settleAnimationKey={builderModeSelection.settleAnimationKey}
        shouldPlaySettleAnimation={
          builderModeSelection.shouldPlaySettleAnimation
        }
      />
      <BuilderModeButton
        active={mode === "template"}
        disabled={disabled}
        icon={<ListChecks className="size-4" />}
        label="Template"
        value="template"
        onClick={() => onModeChange("template")}
      />
      <BuilderModeButton
        active={mode === "manual"}
        disabled={disabled}
        icon={<ListPlus className="size-4" />}
        label="Single"
        value="manual"
        onClick={() => onModeChange("manual")}
      />
    </div>
  );
};

const BuilderModeButton = ({
  active,
  disabled,
  icon,
  label,
  value,
  onClick
}: {
  active: boolean;
  disabled: boolean;
  icon: ReactNode;
  label: string;
  value: BuilderMode;
  onClick: () => void;
}) => (
  <button
    data-active={active ? "true" : "false"}
    data-liquid-selection-item
    data-liquid-selection-value={value}
    type="button"
    className={cn(
      "relative z-10 inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:text-disabled",
      active
        ? "text-brand hover:text-brand"
        : "hover:bg-active hover:text-primary"
    )}
    disabled={disabled}
    onClick={onClick}
  >
    {icon}
    {label}
  </button>
);

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

const FormError = ({ message }: { message: string }) => (
  <div
    className="rounded-lg border border-default bg-surface p-3"
    role="alert"
  >
    <p className="text-sm text-error">{message}</p>
  </div>
);

const generatePreviewNames = ({ template, count }: TemplateFormValues) => {
  const parsedCount = Number(count);

  if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 200) {
    return [];
  }

  const selectedTemplate = templateOptions.find(
    (option) => option.value === template
  );

  if (!selectedTemplate) {
    return [];
  }

  return Array.from(
    { length: parsedCount },
    (_, index) => `${selectedTemplate.previewPrefix} ${index + 1}`
  );
};
