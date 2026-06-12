import type { ReactNode } from "react";
import { Bell, Search } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

import {
  DesktopSidebar,
  MobileNav
} from "./app-shell-navigation.js";
import {
  SessionMenu,
  type AppShellUser
} from "./app-shell-session-menu.js";

type AppShellProps = {
  children: ReactNode;
  currentUser?: AppShellUser | null;
  isCurrentUserLoading?: boolean;
  isLoggingOut?: boolean;
  onLogout?: () => void;
  rightRail?: ReactNode;
};

export const AppShell = ({
  children,
  currentUser,
  isCurrentUserLoading = false,
  isLoggingOut = false,
  onLogout,
  rightRail
}: AppShellProps) => (
  <div className="min-h-screen bg-gradient-app text-primary">
    <div className="mx-auto flex min-h-screen w-full max-w-[112rem] p-2 lg:p-3">
      <DesktopSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-default bg-base-90 px-2 py-3 backdrop-blur-md lg:px-6">
          <MobileNav />
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input
              type="search"
              aria-label="Search"
              placeholder="Search clubs, titles, or members..."
              className="h-9 pl-9"
            />
          </div>
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell />
          </Button>
          <SessionMenu
            currentUser={currentUser}
            isLoading={isCurrentUserLoading}
            isLoggingOut={isLoggingOut}
            onLogout={onLogout}
          />
        </header>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 px-2 py-4 lg:px-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0">{children}</main>
          {rightRail ? (
            <aside className="hidden min-w-0 xl:block" aria-label="Context panel">
              {rightRail}
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  </div>
);
