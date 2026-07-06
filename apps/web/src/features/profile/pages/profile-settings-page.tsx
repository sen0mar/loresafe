import { useMe } from "@/features/auth/api/auth";
import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";

import { AccountDangerZone } from "../components/account-danger-zone.js";
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
        <ProfileSettingsForm currentUser={currentUser} />
        <AccountDangerZone />
      </div>
    </AuthenticatedAppShell>
  );
};
