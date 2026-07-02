import { type ReactNode } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

import {
  DesktopSidebar,
  MobileNav,
  type AppShellJoinedClub
} from "./app-shell-navigation.js";
import {
  SessionMenu,
  type AppShellUser
} from "./app-shell-session-menu.js";

type AppShellProps = {
  children: ReactNode;
  currentUser?: AppShellUser | null;
  isCurrentUserLoading?: boolean;
  isJoinedClubsError?: boolean;
  isJoinedClubsLoading?: boolean;
  isLoggingOut?: boolean;
  joinedClubs?: AppShellJoinedClub[];
  joinedClubsTotal?: number;
  notificationUnreadCount?: number;
  onLogout?: () => void;
  onRetryJoinedClubs?: () => void;
  rightRail?: ReactNode;
};

export const AppShell = ({
  children,
  currentUser,
  isCurrentUserLoading = false,
  isJoinedClubsError = false,
  isJoinedClubsLoading = false,
  isLoggingOut = false,
  joinedClubs = [],
  joinedClubsTotal,
  notificationUnreadCount = 0,
  onLogout,
  onRetryJoinedClubs,
  rightRail
}: AppShellProps) => {
  return (
    <div className="min-h-screen bg-gradient-app text-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-[112rem] p-2 lg:p-3">
        <DesktopSidebar
          joinedClubs={joinedClubs}
          joinedClubsTotal={joinedClubsTotal}
          isJoinedClubsError={isJoinedClubsError}
          isJoinedClubsLoading={isJoinedClubsLoading}
          onRetryJoinedClubs={onRetryJoinedClubs}
          notificationUnreadCount={notificationUnreadCount}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-default bg-base-90 px-2 py-3 backdrop-blur-md lg:px-6">
            <MobileNav
              joinedClubs={joinedClubs}
              joinedClubsTotal={joinedClubsTotal}
              isJoinedClubsError={isJoinedClubsError}
              isJoinedClubsLoading={isJoinedClubsLoading}
              onRetryJoinedClubs={onRetryJoinedClubs}
              notificationUnreadCount={notificationUnreadCount}
            />
            <div className="min-w-0 flex-1" />
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Notifications"
            >
              <Link to="/app/notifications">
                <Bell />
                {notificationUnreadCount > 0 ? (
                  <Badge className="absolute -right-1 -top-1 px-1.5 py-0 text-[10px]">
                    {formatNotificationBadgeCount(notificationUnreadCount)}
                  </Badge>
                ) : null}
              </Link>
            </Button>
            <SessionMenu
              currentUser={currentUser}
              isLoading={isCurrentUserLoading}
              isLoggingOut={isLoggingOut}
              onLogout={onLogout}
            />
          </header>

          <div
            className={cn(
              "grid min-w-0 flex-1 grid-cols-1 gap-4 px-2 py-4 lg:px-6",
              rightRail && "xl:grid-cols-[minmax(0,1fr)_320px]"
            )}
          >
            <main className="min-w-0">{children}</main>
            {rightRail ? (
              <aside
                className="hidden min-w-0 xl:block"
                aria-label="Context panel"
              >
                {rightRail}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const formatNotificationBadgeCount = (count: number) =>
  count > 99 ? "99+" : String(count);
