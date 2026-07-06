import type { ReactNode } from "react";
import { toast } from "sonner";

import { useJoinedClubsQuery } from "@/features/clubs/api/clubs";
import { useAuthenticatedEvents } from "@/features/events/hooks/use-authenticated-events";
import { useUnreadNotificationsQuery } from "@/features/notifications/api/notifications";
import { AppShell } from "@/shared/components/layout/app-shell";

import { useLogout, useMe } from "../api/auth.js";

type AuthenticatedAppShellProps = {
  children: ReactNode;
  rightRail?: ReactNode;
};

const sidebarJoinedClubsLimit = 3;

export const AuthenticatedAppShell = ({
  children,
  rightRail
}: AuthenticatedAppShellProps) => {
  const meQuery = useMe();
  const logoutMutation = useLogout();
  const joinedClubsQuery = useJoinedClubsQuery({
    enabled: Boolean(meQuery.data),
    limit: sidebarJoinedClubsLimit
  });
  const unreadNotificationsQuery = useUnreadNotificationsQuery(
    Boolean(meQuery.data)
  );
  const currentUser = meQuery.data;
  useAuthenticatedEvents(Boolean(currentUser));

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
