import { ShieldCheck } from "lucide-react";

import { useMe } from "@/features/auth/api/auth";
import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { Badge } from "@/shared/components/ui/badge";

import { ModerationSettingsPanel } from "../components/moderation-settings-panel.js";
import { ProfileSettingsForm } from "../components/profile-settings-form.js";

export const ProfileSettingsPage = () => {
  const meQuery = useMe();
  const currentUser = meQuery.data;

  if (!currentUser) {
    return null;
  }

  return (
    <AuthenticatedAppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <section className="flex flex-wrap items-start justify-between gap-3 border-b border-default pb-4">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium text-brand">Settings</p>
            <h1 className="truncate text-2xl font-semibold tracking-normal text-primary sm:text-3xl">
              {currentUser.displayName}
            </h1>
            <p className="truncate text-sm text-muted">
              {currentUser.username ? `@${currentUser.username}` : currentUser.email}
            </p>
          </div>
          <Badge>
            <ShieldCheck className="size-3" />
            Authenticated
          </Badge>
        </section>

        <ProfileSettingsForm currentUser={currentUser} />
        <ModerationSettingsPanel />
      </div>
    </AuthenticatedAppShell>
  );
};
