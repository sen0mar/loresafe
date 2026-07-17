import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useId, useState } from "react";
import { Clock3, Copy, KeyRound, LinkIcon, Users } from "lucide-react";
import { toast } from "sonner";

import type { Club } from "@/features/clubs/api/clubs";
import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ClubSettingsDisclosure } from "@/features/clubs/components/club-settings-disclosure";

import {
  type ClubInvite,
  useCreateClubInviteMutation
} from "../api/invites.js";
import {
  createInviteFormSchema,
  type CreateInviteFormValues
} from "../schemas/invite.schema.js";

type InviteFieldErrors = Partial<Record<keyof CreateInviteFormValues, string>>;

type CreatedInvite = ClubInvite & {
  inviteUrl: string;
};

const initialValues: CreateInviteFormValues = {
  expiresInDays: "7",
  maxUses: "10"
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});

export const ClubInviteSection = ({ club }: { club: Club }) => {
  const role = club.membership.role;
  const canCreateInvite = role === "OWNER" || role === "MODERATOR";
  const createInviteMutation = useCreateClubInviteMutation(club.linkName);
  const [values, setValues] = useState<CreateInviteFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<InviteFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<CreatedInvite | null>(
    null
  );
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const inviteContentId = useId();

  if (!canCreateInvite) {
    return null;
  }

  const updateField =
    (field: keyof CreateInviteFormValues) =>
    (event: ChangeEvent<HTMLInputElement>) => {
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

  const submitInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parseResult = createInviteFormSchema.safeParse(values);

    if (!parseResult.success) {
      const flattenedErrors = parseResult.error.flatten().fieldErrors;

      setFieldErrors({
        expiresInDays: flattenedErrors.expiresInDays?.[0],
        maxUses: flattenedErrors.maxUses?.[0]
      });
      return;
    }

    setFieldErrors({});
    setFormError(null);
    createInviteMutation.mutate(parseResult.data, {
      onSuccess: (response) => {
        setCreatedInvite({
          ...response.invite,
          inviteUrl: new URL(
            `/invite/${response.invite.token}`,
            window.location.origin
          ).toString()
        });
        toast.success("Invite created");
      },
      onError: (error) => {
        setFormError(
          error instanceof ApiError
            ? error.message
            : "Could not create invite. Try again."
        );
      }
    });
  };

  const copyInviteUrl = () => {
    if (!createdInvite) {
      return;
    }

    void navigator.clipboard
      .writeText(createdInvite.inviteUrl)
      .then(() => {
        toast.success("Invite link copied");
      })
      .catch(() => {
        toast.error("Could not copy invite link");
      });
  };

  return (
    <ClubSettingsDisclosure
      contentId={inviteContentId}
      description="Generate a link for readers who should join this club."
      icon={KeyRound}
      isOpen={isInviteOpen}
      onOpenChange={setIsInviteOpen}
      title="Invites"
    >
      <form className="grid gap-3" onSubmit={submitInvite} noValidate>
        {formError ? (
          <div className="rounded-lg border border-default bg-surface p-3">
            <p className="text-sm text-error">{formError}</p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <InviteFormField
            id="invite-expires-in-days"
            label="Expires in days"
            error={fieldErrors.expiresInDays}
            icon={<Clock3 className="size-4" />}
          >
            <Input
              id="invite-expires-in-days"
              type="number"
              min={1}
              max={30}
              value={values.expiresInDays}
              onChange={updateField("expiresInDays")}
              disabled={createInviteMutation.isPending}
              aria-invalid={!!fieldErrors.expiresInDays}
              aria-describedby={
                fieldErrors.expiresInDays
                  ? "invite-expires-in-days-error"
                  : undefined
              }
            />
          </InviteFormField>

          <InviteFormField
            id="invite-max-uses"
            label="Max uses"
            error={fieldErrors.maxUses}
            icon={<Users className="size-4" />}
          >
            <Input
              id="invite-max-uses"
              type="number"
              min={1}
              max={100}
              value={values.maxUses}
              onChange={updateField("maxUses")}
              disabled={createInviteMutation.isPending}
              aria-invalid={!!fieldErrors.maxUses}
              aria-describedby={
                fieldErrors.maxUses ? "invite-max-uses-error" : undefined
              }
            />
          </InviteFormField>
        </div>

        <Button
          type="submit"
          className="justify-self-start"
          disabled={createInviteMutation.isPending}
        >
          <LinkIcon />
          {createInviteMutation.isPending ? "Generating..." : "Generate invite"}
        </Button>
      </form>

      {createdInvite ? (
        <div className="mt-4 space-y-3 rounded-lg border border-default bg-surface p-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
            <span>
              Expires{" "}
              {dateTimeFormatter.format(new Date(createdInvite.expiresAt))}
            </span>
            <span>
              {createdInvite.usedCount}/{createdInvite.maxUses} uses
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={createdInvite.inviteUrl}
              aria-label="Generated invite link"
            />
            <Button type="button" variant="secondary" onClick={copyInviteUrl}>
              <Copy />
              Copy
            </Button>
          </div>
        </div>
      ) : null}
    </ClubSettingsDisclosure>
  );
};

const InviteFormField = ({
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
