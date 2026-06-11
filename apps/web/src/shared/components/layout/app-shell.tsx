import type { ComponentType, ReactNode } from "react";
import {
  Bell,
  Bookmark,
  BookOpen,
  ChevronDown,
  Compass,
  Home,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

type NavItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  isActive?: boolean;
  badge?: string;
};

type AppShellProps = {
  children: ReactNode;
  rightRail?: ReactNode;
};

const primaryNavItems: NavItem[] = [
  { label: "Home", icon: Home, isActive: true },
  { label: "My Progress", icon: TrendingUp },
  { label: "Notifications", icon: Bell, badge: "3" },
  { label: "Explore", icon: Compass },
  { label: "Saved", icon: Bookmark },
  { label: "Settings", icon: Settings }
];

const clubs = [
  "The First Law Book Club",
  "Cosmere Collective",
  "Straw Hat Fleet",
  "Shonen Watchers",
  "Reel Talk"
];

export const AppShell = ({ children, rightRail }: AppShellProps) => (
  <div className="min-h-screen bg-gradient-app text-primary">
    <div className="mx-auto flex min-h-screen w-full max-w-[112rem] p-2 lg:p-3">
      <aside className="hidden w-[252px] shrink-0 border-r border-default pr-3 lg:flex lg:flex-col">
        <ShellBrand />
        <nav className="mt-8 grid gap-1" aria-label="Primary navigation">
          {primaryNavItems.map((item) => (
            <NavButton key={item.label} item={item} />
          ))}
        </nav>

        <div className="mt-8">
          <p className="px-3 text-xs font-medium tracking-normal text-faint">
            Your clubs
          </p>
          <div className="mt-3 grid gap-1">
            {clubs.map((club, index) => (
              <button
                key={club}
                type="button"
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-left text-sm text-muted transition-colors duration-150 hover:bg-active hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  index === 0 && "bg-active text-primary"
                )}
              >
                <span className="flex size-6 items-center justify-center rounded-md border border-default bg-inset text-brand">
                  <BookOpen className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate">{club}</span>
              </button>
            ))}
          </div>
        </div>

        <Button variant="ghost" className="mt-auto justify-start">
          <Plus />
          Create club
        </Button>
      </aside>

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="hidden gap-3 sm:flex">
                <Avatar className="size-8">
                  <AvatarFallback>TS</AvatarFallback>
                </Avatar>
                <span className="grid text-left">
                  <span className="text-sm text-primary">Aria</span>
                  <span className="text-xs text-faint">Level 24</span>
                </span>
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Profile</DropdownMenuLabel>
              <DropdownMenuItem>Account settings</DropdownMenuItem>
              <DropdownMenuItem>Reading modes</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

const ShellBrand = () => (
  <div className="flex items-center gap-3 px-3 pt-3">
    <span className="flex size-10 items-center justify-center rounded-xl border border-brand bg-active text-brand shadow-glow">
      <ShieldCheck className="size-6" />
    </span>
    <span className="text-xl font-semibold tracking-normal">
      Thread<span className="text-brand">Sync</span>
    </span>
  </div>
);

const NavButton = ({ item }: { item: NavItem }) => {
  const Icon = item.icon;

  return (
    <button
      type="button"
      className={cn(
        "flex h-11 items-center gap-3 rounded-lg border border-transparent px-3 text-sm text-muted transition-colors duration-150 hover:bg-active hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        item.isActive && "border-brand bg-active text-brand shadow-glow"
      )}
    >
      <Icon className="size-5" />
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge ? <Badge>{item.badge}</Badge> : null}
    </button>
  );
};

const MobileNav = () => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
      >
        <Menu />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-72">
      <DropdownMenuLabel>
        <span className="flex items-center gap-2 text-primary">
          <ShieldCheck className="size-4 text-brand" />
          ThreadSync
        </span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      {primaryNavItems.map((item) => {
        const Icon = item.icon;

        return (
          <DropdownMenuItem key={item.label}>
            <Icon className="size-4" />
            {item.label}
            {item.badge ? <Badge className="ml-auto">{item.badge}</Badge> : null}
          </DropdownMenuItem>
        );
      })}
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Your clubs</DropdownMenuLabel>
      {clubs.slice(0, 3).map((club) => (
        <DropdownMenuItem key={club}>
          <BookOpen className="size-4" />
          <span className="truncate">{club}</span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);
