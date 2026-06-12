import type { ComponentType } from "react";
import {
  Bell,
  Bookmark,
  BookOpen,
  Compass,
  Home,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  TrendingUp
} from "lucide-react";

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
import { cn } from "@/shared/lib/utils";

type NavItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  isActive?: boolean;
  badge?: string;
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

export const DesktopSidebar = () => (
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
);

export const MobileNav = () => (
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
