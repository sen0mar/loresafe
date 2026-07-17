import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useId, useState } from "react";
import { Save, ScrollText } from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";
import { ClubSettingsDisclosure } from "./club-settings-disclosure.js";

import {
  type Club,
  type ClubVisibility,
  useUpdateClubSettingsMutation
} from "../api/clubs.js";
import {
  clubSettingsFormSchema,
  type ClubSettingsFormValues
} from "../schemas/club-settings.schema.js";
import {
  clubVisibilityMetadata,
  clubVisibilityOptions
} from "../lib/club-visibility.js";

type ClubSettingsFieldErrors = Partial<
  Record<keyof ClubSettingsFormValues, string>
>;

export const ClubSettingsForm = ({ club }: { club: Club }) => {
  const canManageSettings =
    club.membership.role === "OWNER" || club.membership.role === "MODERATOR";
  const updateSettingsMutation = useUpdateClubSettingsMutation(club.linkName);
  const [values, setValues] = useState<ClubSettingsFormValues>(
    getClubSettingsFormValues(club)
  );
  const [fieldErrors, setFieldErrors] = useState<ClubSettingsFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsContentId = useId();
  const isDirty =
    values.visibility !== club.settings.visibility ||
    values.rules !== (club.settings.rules ?? "");

  useEffect(() => {
    setValues(getClubSettingsFormValues(club));
    setFieldErrors({});
    setFormError(null);
  }, [club]);

  if (!canManageSettings) {
    return <ClubSettingsReadOnly club={club} />;
  }

  const updateRules = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setValues((currentValues) => ({
      ...currentValues,
      rules: event.target.value
    }));
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      rules: undefined
    }));
    setFormError(null);
  };

  const updateVisibility = (visibility: ClubVisibility) => {
    setValues((currentValues) => ({
      ...currentValues,
      visibility
    }));
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      visibility: undefined
    }));
    setFormError(null);
  };

  const resetSettings = () => {
    setValues(getClubSettingsFormValues(club));
    setFieldErrors({});
    setFormError(null);
  };

  const submitSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parseResult = clubSettingsFormSchema.safeParse(values);

    if (!parseResult.success) {
      const flattenedErrors = parseResult.error.flatten().fieldErrors;

      setFieldErrors({
        visibility: flattenedErrors.visibility?.[0],
        rules: flattenedErrors.rules?.[0]
      });
      return;
    }

    setFieldErrors({});
    setFormError(null);
    updateSettingsMutation.mutate(parseResult.data, {
      onSuccess: (response) => {
        setValues(getClubSettingsFormValues(response.club));
        toast.success("Club settings updated");
      },
      onError: (error) => {
        setFormError(
          error instanceof ApiError
            ? error.message
            : "Could not update club settings."
        );
      }
    });
  };

  return (
    <ClubSettingsDisclosure
      contentId={settingsContentId}
      description="Update how readers find this club and what they see before posting."
      icon={ScrollText}
      isOpen={isSettingsOpen}
      onOpenChange={setIsSettingsOpen}
      title="Club rules and visibility"
    >
      <form className="grid gap-4" onSubmit={submitSettings} noValidate>
        {formError ? (
          <div className="rounded-lg border border-default bg-surface p-3">
            <p className="text-sm text-error" role="alert">
              {formError}
            </p>
          </div>
        ) : null}

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-secondary">
            Visibility
          </legend>
          <div className="grid gap-3 md:grid-cols-3">
            {clubVisibilityOptions.map((option) => {
              const isSelected = values.visibility === option.value;
              const VisibilityIcon = option.icon;

              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex min-h-28 cursor-pointer flex-col gap-2 rounded-lg border border-default bg-surface p-3 text-sm transition-colors duration-150 hover:border-strong hover:bg-active",
                    isSelected &&
                      "border-brand bg-active text-brand shadow-glow",
                    updateSettingsMutation.isPending &&
                      "cursor-not-allowed opacity-70"
                  )}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="club-settings-visibility"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => updateVisibility(option.value)}
                    disabled={updateSettingsMutation.isPending}
                  />
                  <span className="flex items-center gap-2 font-medium text-primary">
                    <span className="text-brand">
                      <VisibilityIcon className="size-4" />
                    </span>
                    {option.label}
                  </span>
                  <span className="text-xs leading-5 text-muted">
                    {option.description}
                  </span>
                </label>
              );
            })}
          </div>
          {fieldErrors.visibility ? (
            <p
              className="text-sm text-error"
              id="club-settings-visibility-error"
            >
              {fieldErrors.visibility}
            </p>
          ) : null}
        </fieldset>

        <div className="grid gap-2">
          <label
            className="text-sm font-medium text-secondary"
            htmlFor="club-settings-rules"
          >
            Rules
          </label>
          <Textarea
            id="club-settings-rules"
            value={values.rules}
            onChange={updateRules}
            disabled={updateSettingsMutation.isPending}
            aria-invalid={!!fieldErrors.rules}
            aria-describedby={
              fieldErrors.rules ? "club-settings-rules-error" : undefined
            }
            maxLength={2000}
          />
          {fieldErrors.rules ? (
            <p className="text-sm text-error" id="club-settings-rules-error">
              {fieldErrors.rules}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            disabled={!isDirty || updateSettingsMutation.isPending}
          >
            <Save />
            {updateSettingsMutation.isPending ? "Saving..." : "Save settings"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!isDirty || updateSettingsMutation.isPending}
            onClick={resetSettings}
          >
            Reset
          </Button>
          <span className="text-xs text-faint" aria-live="polite">
            {isDirty ? "Unsaved changes" : "Settings are up to date"}
          </span>
        </div>
      </form>
    </ClubSettingsDisclosure>
  );
};

const ClubSettingsReadOnly = ({ club }: { club: Club }) => {
  const VisibilityIcon = clubVisibilityMetadata[club.settings.visibility].icon;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div className="rounded-lg border border-default bg-inset p-4">
        <span className="flex items-center gap-2 text-xs text-faint">
          <VisibilityIcon className="size-4" />
          Visibility
        </span>
        <p className="mt-2 text-sm font-medium text-primary">
          {clubVisibilityMetadata[club.settings.visibility].label}
        </p>
      </div>
      <div className="rounded-lg border border-default bg-inset p-4">
        <h2 className="text-sm font-medium text-primary">Rules</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
          {club.settings.rules ?? "No rules posted yet."}
        </p>
      </div>
    </div>
  );
};

const getClubSettingsFormValues = (club: Club): ClubSettingsFormValues => ({
  visibility: club.settings.visibility,
  rules: club.settings.rules ?? ""
});
