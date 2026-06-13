import type { ComponentType } from "react";
import { NavLink } from "react-router-dom";
import {
  Bell,
  Bookmark,
  Compass,
  Home,
  Menu,
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
  path?: string;
  badge?: string;
};

const primaryNavItems: NavItem[] = [
  { label: "Home", icon: Home, path: "/" },
  { label: "My Progress", icon: TrendingUp },
  { label: "Notifications", icon: Bell, badge: "3" },
  { label: "Explore", icon: Compass, path: "/app/explore" },
  { label: "Saved", icon: Bookmark },
  { label: "Settings", icon: Settings, path: "/app/settings/profile" }
];

export const DesktopSidebar = () => (
  <aside className="hidden w-[252px] shrink-0 border-r border-default pr-3 lg:flex lg:flex-col">
    <ShellBrand />
    <nav className="mt-8 grid gap-1" aria-label="Primary navigation">
      {primaryNavItems.map((item) => (
        <NavButton key={item.label} item={item} />
      ))}
    </nav>
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

        if (item.path) {
          return (
            <DropdownMenuItem key={item.label} asChild>
              <NavLink to={item.path} end={item.path === "/"}>
                <Icon className="size-4" />
                {item.label}
                {item.badge ? <Badge className="ml-auto">{item.badge}</Badge> : null}
              </NavLink>
            </DropdownMenuItem>
          );
        }

        return (
          <DropdownMenuItem key={item.label} disabled>
            <Icon className="size-4" />
            {item.label}
            {item.badge ? <Badge className="ml-auto">{item.badge}</Badge> : null}
          </DropdownMenuItem>
        );
      })}
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

  if (item.path) {
    return (
      <NavLink
        to={item.path}
        end={item.path === "/"}
        className={({ isActive }) =>
          cn(
            navButtonClassName,
            isActive && "border-brand bg-active text-brand shadow-glow"
          )
        }
      >
        <Icon className="size-5" />
        <span className="flex-1 text-left">{item.label}</span>
        {item.badge ? <Badge>{item.badge}</Badge> : null}
      </NavLink>
    );
  }

  return (
    <button
      type="button"
      className={cn(navButtonClassName, "opacity-60")}
      disabled
    >
      <Icon className="size-5" />
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge ? <Badge>{item.badge}</Badge> : null}
    </button>
  );
};

const navButtonClassName =
  "flex h-11 items-center gap-3 rounded-lg border border-transparent px-3 text-sm text-muted transition-colors duration-150 hover:bg-active hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
