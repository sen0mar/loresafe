import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  FileText,
  ScrollText,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";

import {
  type ClubCategory,
  type ClubVisibility,
  useCreateClubMutation
} from "../api/clubs.js";
import { clubCategoryOptions } from "../lib/club-categories.js";
import { clubVisibilityOptions } from "../lib/club-visibility.js";
import {
  createClubFormSchema,
  type CreateClubFormValues
} from "../schemas/create-club.schema.js";

type CreateClubFieldErrors = Partial<
  Record<keyof CreateClubFormValues, string>
>;

const initialValues: CreateClubFormValues = {
  title: "",
  linkName: "",
  description: "",
  category: "",
  visibility: "PUBLIC",
  rules: ""
};

export const CreateClubForm = () => {
  const navigate = useNavigate();
  const createClubMutation = useCreateClubMutation();
  const [values, setValues] = useState<CreateClubFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<CreateClubFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const updateField =
    (field: keyof CreateClubFormValues) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
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

  const updateCategory = (event: ChangeEvent<HTMLSelectElement>) => {
    setValues((currentValues) => ({
      ...currentValues,
      category: event.target.value as ClubCategory | ""
    }));
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      category: undefined
    }));
    setFormError(null);
  };

  const submitClub = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parseResult = createClubFormSchema.safeParse(values);

    if (!parseResult.success) {
      const flattenedErrors = parseResult.error.flatten().fieldErrors;

      setFieldErrors({
        title: flattenedErrors.title?.[0],
        linkName: flattenedErrors.linkName?.[0],
        description: flattenedErrors.description?.[0],
        category: flattenedErrors.category?.[0],
        visibility: flattenedErrors.visibility?.[0],
        rules: flattenedErrors.rules?.[0]
      });
      return;
    }

    setFieldErrors({});
    setFormError(null);
    createClubMutation.mutate(parseResult.data, {
      onSuccess: (response) => {
        toast.success("Club created");
        navigate(`/app/clubs/${response.club.linkName}`, { replace: true });
      },
      onError: (error) => {
        if (error instanceof ApiError && error.statusCode === 409) {
          setFieldErrors((currentErrors) => ({
            ...currentErrors,
            linkName: error.message
          }));
          return;
        }

        setFormError(
          error instanceof ApiError
            ? error.message
            : "Something went wrong while creating the club."
        );
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create club</CardTitle>
        <CardDescription>
          Set the basics for a spoiler-safe space before adding milestones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submitClub} noValidate>
          {formError ? (
            <div
              className="rounded-lg border border-default bg-inset p-3"
              role="alert"
            >
              <p className="text-sm text-error">{formError}</p>
            </div>
          ) : null}

          <CreateClubFormField
            id="title"
            label="Title"
            icon={<BookOpen className="size-4" />}
            error={fieldErrors.title}
          >
            <Input
              id="title"
              type="text"
              value={values.title}
              onChange={updateField("title")}
              disabled={createClubMutation.isPending}
              aria-invalid={!!fieldErrors.title}
              aria-describedby={fieldErrors.title ? "title-error" : undefined}
            />
          </CreateClubFormField>

          <CreateClubFormField
            id="linkName"
            label="Link name"
            icon={<Sparkles className="size-4" />}
            error={fieldErrors.linkName}
          >
            <p
              className="text-xs leading-5 text-muted"
              id="linkName-description"
            >
              This becomes the club's public link, like
              /app/clubs/the-first-law-book-club.
            </p>
            <Input
              id="linkName"
              type="text"
              value={values.linkName}
              onChange={updateField("linkName")}
              disabled={createClubMutation.isPending}
              aria-invalid={!!fieldErrors.linkName}
              aria-describedby={
                fieldErrors.linkName
                  ? "linkName-description linkName-error"
                  : "linkName-description"
              }
              placeholder="the-first-law-book-club"
            />
          </CreateClubFormField>

          <CreateClubFormField
            id="description"
            label="Description"
            icon={<FileText className="size-4" />}
            error={fieldErrors.description}
          >
            <Textarea
              id="description"
              value={values.description ?? ""}
              onChange={updateField("description")}
              disabled={createClubMutation.isPending}
              aria-invalid={!!fieldErrors.description}
              aria-describedby={
                fieldErrors.description ? "description-error" : undefined
              }
              maxLength={280}
            />
          </CreateClubFormField>

          <CreateClubFormField
            id="category"
            label="Category"
            icon={<Sparkles className="size-4" />}
            error={fieldErrors.category}
          >
            <select
              className="flex h-10 w-full rounded-md border border-subtle bg-inset px-3 py-2 text-sm text-primary outline-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-faint hover:border-strong focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
              id="category"
              value={values.category ?? ""}
              onChange={updateCategory}
              disabled={createClubMutation.isPending}
              aria-invalid={!!fieldErrors.category}
              aria-describedby={
                fieldErrors.category ? "category-error" : undefined
              }
            >
              <option value="">Choose a category</option>
              {clubCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </CreateClubFormField>

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
                      "flex min-h-28 cursor-pointer flex-col gap-2 rounded-lg border border-default bg-inset p-3 text-sm transition-colors duration-150 hover:border-strong hover:bg-active",
                      isSelected &&
                        "border-brand bg-active text-brand shadow-glow"
                    )}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="visibility"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => updateVisibility(option.value)}
                      disabled={createClubMutation.isPending}
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
              <p className="text-sm text-error" id="visibility-error">
                {fieldErrors.visibility}
              </p>
            ) : null}
          </fieldset>

          <CreateClubFormField
            id="rules"
            label="Rules"
            icon={<ScrollText className="size-4" />}
            error={fieldErrors.rules}
          >
            <Textarea
              id="rules"
              value={values.rules ?? ""}
              onChange={updateField("rules")}
              disabled={createClubMutation.isPending}
              aria-invalid={!!fieldErrors.rules}
              aria-describedby={fieldErrors.rules ? "rules-error" : undefined}
              maxLength={2000}
            />
          </CreateClubFormField>

          <Button
            type="submit"
            className="mt-2 justify-self-start"
            disabled={createClubMutation.isPending}
          >
            {createClubMutation.isPending ? "Creating..." : "Create club"}
            <ArrowRight />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const CreateClubFormField = ({
  id,
  label,
  icon,
  error,
  children
}: {
  id: string;
  label: string;
  icon: ReactNode;
  error?: string;
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
