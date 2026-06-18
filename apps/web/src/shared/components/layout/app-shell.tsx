import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Bell, Search } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
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
  const location = useLocation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    if (location.pathname !== "/app/search") {
      return;
    }

    setSearchValue(new URLSearchParams(location.search).get("q") ?? "");
  }, [location.pathname, location.search]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const query = searchValue.trim();
    const params = new URLSearchParams({
      scope: "all"
    });

    if (query) {
      params.set("q", query);
    }

    navigate(`/app/search?${params.toString()}`);
  };

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
            <form
              className="relative min-w-0 flex-1"
              role="search"
              onSubmit={handleSearchSubmit}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input
                type="search"
                aria-label="Search"
                placeholder="Search clubs or discussions..."
                className="h-9 pl-9"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
            </form>
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
