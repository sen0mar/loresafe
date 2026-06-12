import { Link } from "react-router-dom";
import { ChevronDown, LogIn, LogOut, UserPlus, UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/shared/components/ui/dropdown-menu";
import { getUserInitials } from "@/shared/lib/user-display";

export type AppShellUser = {
  email: string;
  displayName: string;
};

type SessionMenuProps = {
  currentUser?: AppShellUser | null;
  isLoading: boolean;
  isLoggingOut: boolean;
  onLogout?: () => void;
};

export const SessionMenu = ({
  currentUser,
  isLoading,
  isLoggingOut,
  onLogout
}: SessionMenuProps) => {
  if (isLoading) {
    return (
      <Button variant="ghost" className="gap-3" disabled>
        <Avatar className="size-8">
          <AvatarFallback>TS</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm text-faint sm:inline">Checking session</span>
      </Button>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-label="Log in"
          asChild
        >
          <Link to="/login">
            <LogIn />
          </Link>
        </Button>
        <Button variant="ghost" className="hidden sm:inline-flex" asChild>
          <Link to="/login">
            <LogIn />
            Log in
          </Link>
        </Button>
        <Button className="hidden sm:inline-flex" asChild>
          <Link to="/signup">
            <UserPlus />
            Create account
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-3">
          <Avatar className="size-8">
            <AvatarFallback>{getUserInitials(currentUser.displayName)}</AvatarFallback>
          </Avatar>
          <span className="hidden text-left sm:grid">
            <span className="text-sm text-primary">{currentUser.displayName}</span>
            <span className="text-xs text-faint">{currentUser.email}</span>
          </span>
          <ChevronDown className="hidden size-4 sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="grid gap-1">
            <span className="truncate text-sm text-primary">
              {currentUser.displayName}
            </span>
            <span className="truncate text-xs font-normal text-faint">
              {currentUser.email}
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/app/settings/profile">
            <UserRound />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>Reading modes</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isLoggingOut}
          variant="destructive"
          onSelect={(event) => {
            event.preventDefault();
            onLogout?.();
          }}
        >
          <LogOut />
          {isLoggingOut ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
