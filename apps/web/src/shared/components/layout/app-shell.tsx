import { type ReactNode } from "react";
import { PanelLeftOpen } from "lucide-react";

import { NotificationPreviewMenu } from "@/features/notifications/components/notification-preview-menu";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

import {
  DesktopSidebar,
  MobileNav,
  type AppShellJoinedClub
} from "./app-shell-navigation.js";
import { SessionMenu, type AppShellUser } from "./app-shell-session-menu.js";
import { useDesktopSidebar } from "./use-desktop-sidebar.js";

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
  const {
    closeDesktopSidebar,
    isDesktopSidebarOpen,
    openDesktopSidebar,
    showSidebarButtonRef
  } = useDesktopSidebar();

  return (
    <div className="min-h-screen bg-gradient-app text-primary">
      <div
        className={cn(
          "flex min-h-screen w-full p-2 transition-[gap] duration-200 ease-out motion-reduce:transition-none lg:p-3",
          isDesktopSidebarOpen ? "gap-3" : "gap-0"
        )}
      >
        <div
          className={cn(
            "relative hidden shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none lg:sticky lg:top-3 lg:block lg:h-[calc(100dvh-1.5rem)]",
            isDesktopSidebarOpen ? "w-[15.75rem]" : "w-0"
          )}
        >
          <DesktopSidebar
            isOpen={isDesktopSidebarOpen}
            joinedClubs={joinedClubs}
            joinedClubsTotal={joinedClubsTotal}
            isJoinedClubsError={isJoinedClubsError}
            isJoinedClubsLoading={isJoinedClubsLoading}
            onClose={closeDesktopSidebar}
            onRetryJoinedClubs={onRetryJoinedClubs}
            notificationUnreadCount={notificationUnreadCount}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <header className="app-shell-topbar flex items-center gap-3 rounded-2xl border px-2 py-3 backdrop-blur-md lg:px-6">
            <MobileNav
              joinedClubs={joinedClubs}
              joinedClubsTotal={joinedClubsTotal}
              isJoinedClubsError={isJoinedClubsError}
              isJoinedClubsLoading={isJoinedClubsLoading}
              onRetryJoinedClubs={onRetryJoinedClubs}
              notificationUnreadCount={notificationUnreadCount}
            />
            {!isDesktopSidebarOpen ? (
              <Button
                ref={showSidebarButtonRef}
                type="button"
                variant="ghost"
                size="icon"
                className="hidden text-brand hover:bg-active hover:text-brand lg:inline-flex"
                onClick={openDesktopSidebar}
                aria-label="Show sidebar"
              >
                <PanelLeftOpen />
              </Button>
            ) : null}
            <div className="min-w-0 flex-1" />
            <NotificationPreviewMenu unreadCount={notificationUnreadCount} />
            <SessionMenu
              currentUser={currentUser}
              isLoading={isCurrentUserLoading}
              isLoggingOut={isLoggingOut}
              onLogout={onLogout}
            />
          </header>

          <div
            className={cn(
              "grid min-w-0 flex-1 grid-cols-1 gap-4 px-2 pb-4 pt-1 lg:px-6",
              rightRail && "xl:grid-cols-[minmax(0,1fr)_20rem]"
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
