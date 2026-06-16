import type { ReactNode } from "react";
import { toast } from "sonner";

import { useJoinedClubsQuery } from "@/features/clubs/api/clubs";
import { useUnreadNotificationsQuery } from "@/features/notifications/api/notifications";
import { AppShell } from "@/shared/components/layout/app-shell";

import { useLogout, useMe } from "../api/auth.js";

type AuthenticatedAppShellProps = {
  children: ReactNode;
  rightRail?: ReactNode;
};

export const AuthenticatedAppShell = ({
  children,
  rightRail
}: AuthenticatedAppShellProps) => {
  const meQuery = useMe();
  const logoutMutation = useLogout();
  const joinedClubsQuery = useJoinedClubsQuery(Boolean(meQuery.data));
  const unreadNotificationsQuery = useUnreadNotificationsQuery(
    Boolean(meQuery.data)
  );
  const currentUser = meQuery.data;

  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Logged out");
      },
      onError: () => {
        toast.error("Could not log out. Try again.");
      }
    });
  };

  if (!currentUser) {
    return null;
  }

  return (
    <AppShell
      currentUser={currentUser}
      isCurrentUserLoading={meQuery.isPending}
      isJoinedClubsError={joinedClubsQuery.isError}
      isJoinedClubsLoading={joinedClubsQuery.isPending}
      isLoggingOut={logoutMutation.isPending}
      joinedClubs={joinedClubsQuery.data?.clubs ?? []}
      joinedClubsTotal={joinedClubsQuery.data?.pagination.total ?? 0}
      notificationUnreadCount={unreadNotificationsQuery.data?.unreadCount ?? 0}
      onLogout={logout}
      onRetryJoinedClubs={() => void joinedClubsQuery.refetch()}
      rightRail={rightRail}
    >
      {children}
    </AppShell>
  );
};
