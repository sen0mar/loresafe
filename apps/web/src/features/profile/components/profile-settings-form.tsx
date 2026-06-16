import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { AtSign, FileText, ImageUp, Save, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authQueryKeys } from "@/features/auth/api/auth";
import type { AuthUser } from "@/features/auth/api/auth";
import { usePublicAssetUpload } from "@/features/uploads/hooks/use-public-asset-upload";
import { ApiError } from "@/shared/api/api-client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { getUserInitials } from "@/shared/lib/user-display";

import { useUpdateCurrentUserProfile } from "../api/profile.js";
import {
  profileFormSchema,
  type ProfileFormValues
} from "../schemas/profile.schema.js";

type ProfileFieldErrors = Partial<Record<keyof ProfileFormValues, string>>;

type ProfileSettingsFormProps = {
  currentUser: AuthUser;
};

export const ProfileSettingsForm = ({
  currentUser
}: ProfileSettingsFormProps) => {
  const queryClient = useQueryClient();
  const updateProfileMutation = useUpdateCurrentUserProfile();
  const avatarUpload = usePublicAssetUpload({
    purpose: "AVATAR",
    onCompleted: async () => {
      await queryClient.invalidateQueries({
        queryKey: authQueryKeys.me
      });
      toast.success("Avatar updated");
    }
  });
  const [values, setValues] = useState<ProfileFormValues>(
    getInitialValues(currentUser)
  );
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setValues(getInitialValues(currentUser));
    setFieldErrors({});
    setFormError(null);
  }, [
    currentUser.bio,
    currentUser.displayName,
    currentUser.username,
    currentUser.avatarUrl,
    currentUser.id
  ]);

  const updateField =
    (field: keyof ProfileFormValues) =>
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

  const submitProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parseResult = profileFormSchema.safeParse(values);

    if (!parseResult.success) {
      const flattenedErrors = parseResult.error.flatten().fieldErrors;

      setFieldErrors({
        displayName: flattenedErrors.displayName?.[0],
        username: flattenedErrors.username?.[0],
        bio: flattenedErrors.bio?.[0]
      });
      return;
    }

    setFieldErrors({});
    setFormError(null);
    updateProfileMutation.mutate(parseResult.data, {
      onSuccess: (response) => {
        toast.success("Profile updated");
        setValues(getInitialValues(response.user));
      },
      onError: (error) => {
        if (error instanceof ApiError && error.statusCode === 409) {
          setFieldErrors((currentErrors) => ({
            ...currentErrors,
            username: error.message
          }));
          return;
        }

        setFormError(
          error instanceof ApiError
            ? error.message
            : "Something went wrong while saving your profile."
        );
      }
    });
  };

  const uploadAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    void avatarUpload.uploadFile(file);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-4">
        <Avatar className="size-14">
          {currentUser.avatarUrl ? (
            <AvatarImage
              src={currentUser.avatarUrl}
              alt={`${currentUser.displayName} avatar`}
            />
          ) : null}
          <AvatarFallback className="text-base">
            {getUserInitials(values.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <CardTitle className="truncate text-xl">Profile settings</CardTitle>
          <p className="mt-1 truncate text-sm text-faint">{currentUser.email}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 rounded-lg border border-default bg-inset p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-medium text-primary">
                <ImageUp className="size-4 text-brand" />
                Avatar
              </h2>
              <p className="mt-1 text-sm text-muted">JPEG, PNG, or WebP up to 2 MB.</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={avatarUpload.isUploading}
              asChild
            >
              <label htmlFor="avatar-upload">
                <ImageUp />
                {avatarUpload.isUploading ? "Uploading..." : "Choose image"}
              </label>
            </Button>
            <input
              id="avatar-upload"
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={avatarUpload.isUploading}
              onChange={uploadAvatar}
            />
          </div>
          {avatarUpload.isUploading ? (
            <UploadProgress progress={avatarUpload.progress} />
          ) : null}
          {avatarUpload.error ? (
            <p className="mt-3 text-sm text-error" role="alert">
              {avatarUpload.error}
            </p>
          ) : null}
        </div>

        <form className="grid gap-4" onSubmit={submitProfile} noValidate>
          {formError ? (
            <div className="rounded-lg border border-default bg-inset p-3" role="alert">
              <p className="text-sm text-error">{formError}</p>
            </div>
          ) : null}

          <ProfileFormField
            id="displayName"
            label="Display name"
            icon={<UserRound className="size-4" />}
            error={fieldErrors.displayName}
          >
            <Input
              id="displayName"
              type="text"
              autoComplete="name"
              value={values.displayName}
              onChange={updateField("displayName")}
              disabled={updateProfileMutation.isPending}
              aria-invalid={!!fieldErrors.displayName}
              aria-describedby={
                fieldErrors.displayName ? "displayName-error" : undefined
              }
            />
          </ProfileFormField>

          <ProfileFormField
            id="username"
            label="Username"
            icon={<AtSign className="size-4" />}
            error={fieldErrors.username}
          >
            <Input
              id="username"
              type="text"
              autoComplete="username"
              value={values.username}
              onChange={updateField("username")}
              disabled={updateProfileMutation.isPending}
              aria-invalid={!!fieldErrors.username}
              aria-describedby={fieldErrors.username ? "username-error" : undefined}
            />
          </ProfileFormField>

          <ProfileFormField
            id="bio"
            label="Bio"
            icon={<FileText className="size-4" />}
            error={fieldErrors.bio}
          >
            <Textarea
              id="bio"
              value={values.bio}
              onChange={updateField("bio")}
              disabled={updateProfileMutation.isPending}
              aria-invalid={!!fieldErrors.bio}
              aria-describedby={fieldErrors.bio ? "bio-error" : undefined}
              maxLength={180}
            />
          </ProfileFormField>

          <Button
            type="submit"
            className="mt-2 justify-self-start"
            disabled={updateProfileMutation.isPending}
          >
            <Save />
            {updateProfileMutation.isPending ? "Saving..." : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const ProfileFormField = ({
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

const UploadProgress = ({ progress }: { progress: number }) => (
  <div className="mt-3 grid gap-2" aria-live="polite">
    <div className="h-2 overflow-hidden rounded-full bg-surface">
      <div
        className="h-full rounded-full bg-brand transition-all"
        style={{ width: `${progress}%` }}
      />
    </div>
    <p className="text-xs text-faint">{progress}% uploaded</p>
  </div>
);

const getInitialValues = (user: AuthUser): ProfileFormValues => ({
  displayName: user.displayName,
  username: user.username ?? "",
  bio: user.bio ?? ""
});
