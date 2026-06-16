import type { ComponentType } from "react";
import { NavLink } from "react-router-dom";
import {
  Bell,
  Bookmark,
  Compass,
  Globe2,
  Home,
  KeyRound,
  LockKeyhole,
  Menu,
  RefreshCw,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  type LucideIcon
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
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

export type AppShellJoinedClub = {
  id: string;
  title: string;
  slug: string;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  role: "OWNER" | "MODERATOR" | "MEMBER";
  memberCount: number;
  joinedAt: string;
};

type AppShellNavigationProps = {
  isJoinedClubsError?: boolean;
  isJoinedClubsLoading?: boolean;
  joinedClubs?: AppShellJoinedClub[];
  joinedClubsTotal?: number;
  notificationUnreadCount?: number;
  onRetryJoinedClubs?: () => void;
};

type NavItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  path?: string;
  badge?: number;
};

const primaryNavItems: NavItem[] = [
  { label: "Home", icon: Home, path: "/" },
  { label: "My Progress", icon: TrendingUp },
  { label: "Notifications", icon: Bell, path: "/app/notifications" },
  { label: "Explore", icon: Compass, path: "/app/explore" },
  { label: "Saved", icon: Bookmark },
  { label: "Settings", icon: Settings, path: "/app/settings/profile" }
];

const visibilityIcons: Record<AppShellJoinedClub["visibility"], LucideIcon> = {
  PUBLIC: Globe2,
  PRIVATE: LockKeyhole,
  INVITE_ONLY: KeyRound
};

const roleLabels: Record<AppShellJoinedClub["role"], string> = {
  OWNER: "Owner",
  MODERATOR: "Mod",
  MEMBER: "Member"
};

const memberFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1
});

export const DesktopSidebar = ({
  joinedClubs = [],
  joinedClubsTotal,
  isJoinedClubsError = false,
  isJoinedClubsLoading = false,
  notificationUnreadCount = 0,
  onRetryJoinedClubs
}: AppShellNavigationProps) => (
  <aside className="hidden w-[252px] shrink-0 border-r border-default pr-3 lg:flex lg:flex-col">
    <ShellBrand />
    <nav className="mt-8 grid gap-1" aria-label="Primary navigation">
      {primaryNavItems.map((item) => (
        <NavButton
          key={item.label}
          item={withNotificationBadge(item, notificationUnreadCount)}
        />
      ))}
    </nav>
    <JoinedClubsSection
      joinedClubs={joinedClubs}
      joinedClubsTotal={joinedClubsTotal}
      isJoinedClubsError={isJoinedClubsError}
      isJoinedClubsLoading={isJoinedClubsLoading}
      onRetryJoinedClubs={onRetryJoinedClubs}
    />
  </aside>
);

export const MobileNav = ({
  joinedClubs = [],
  joinedClubsTotal,
  isJoinedClubsError = false,
  isJoinedClubsLoading = false,
  notificationUnreadCount = 0,
  onRetryJoinedClubs
}: AppShellNavigationProps) => (
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
      {primaryNavItems.map((navItem) => {
        const item = withNotificationBadge(navItem, notificationUnreadCount);
        const Icon = item.icon;

        if (item.path) {
          return (
            <DropdownMenuItem key={item.label} asChild>
              <NavLink to={item.path} end={item.path === "/"}>
                <Icon className="size-4" />
                {item.label}
                {item.badge ? (
                  <Badge className="ml-auto">
                    {formatBadgeCount(item.badge)}
                  </Badge>
                ) : null}
              </NavLink>
            </DropdownMenuItem>
          );
        }

        return (
          <DropdownMenuItem key={item.label} disabled>
            <Icon className="size-4" />
            {item.label}
            {item.badge ? (
              <Badge className="ml-auto">
                {formatBadgeCount(item.badge)}
              </Badge>
            ) : null}
          </DropdownMenuItem>
        );
      })}
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs text-faint">
        Joined clubs
      </DropdownMenuLabel>
      <MobileJoinedClubs
        joinedClubs={joinedClubs}
        joinedClubsTotal={joinedClubsTotal}
        isJoinedClubsError={isJoinedClubsError}
        isJoinedClubsLoading={isJoinedClubsLoading}
        onRetryJoinedClubs={onRetryJoinedClubs}
      />
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
        {item.badge ? <Badge>{formatBadgeCount(item.badge)}</Badge> : null}
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
      {item.badge ? <Badge>{formatBadgeCount(item.badge)}</Badge> : null}
    </button>
  );
};

const JoinedClubsSection = ({
  joinedClubs = [],
  joinedClubsTotal,
  isJoinedClubsError = false,
  isJoinedClubsLoading = false,
  onRetryJoinedClubs
}: AppShellNavigationProps) => (
  <section className="mt-6 min-h-0 border-t border-default pt-4">
    <div className="mb-2 flex items-center justify-between px-3">
      <h2 className="text-xs font-medium text-faint">Joined clubs</h2>
      {joinedClubsTotal ? (
        <Badge variant="secondary">{joinedClubsTotal}</Badge>
      ) : null}
    </div>
    {isJoinedClubsLoading ? (
      <JoinedClubsLoading />
    ) : isJoinedClubsError ? (
      <JoinedClubsError onRetry={onRetryJoinedClubs} />
    ) : joinedClubs.length === 0 ? (
      <p className="px-3 py-2 text-sm leading-5 text-faint">
        Join a public club to pin it here.
      </p>
    ) : (
      <nav className="grid gap-1" aria-label="Joined clubs">
        {joinedClubs.map((club) => (
          <JoinedClubLink key={club.id} club={club} />
        ))}
      </nav>
    )}
  </section>
);

const JoinedClubLink = ({ club }: { club: AppShellJoinedClub }) => {
  const VisibilityIcon = visibilityIcons[club.visibility];

  return (
    <NavLink
      to={`/app/clubs/${club.slug}`}
      className={({ isActive }) =>
        cn(
          "min-h-14 rounded-lg border border-transparent px-3 py-2 text-sm text-muted transition-colors duration-150 hover:bg-active hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          isActive && "border-brand bg-active text-brand shadow-glow"
        )
      }
    >
      <span className="flex min-w-0 items-center gap-2">
        <VisibilityIcon className="size-4 shrink-0" />
        <span className="truncate font-medium">{club.title}</span>
      </span>
      <span className="mt-1 flex items-center gap-2 text-xs text-faint">
        <span>{roleLabels[club.role]}</span>
        <span aria-hidden="true">/</span>
        <span>{memberFormatter.format(club.memberCount)} members</span>
      </span>
    </NavLink>
  );
};

const MobileJoinedClubs = ({
  joinedClubs = [],
  isJoinedClubsError = false,
  isJoinedClubsLoading = false,
  onRetryJoinedClubs
}: AppShellNavigationProps) => {
  if (isJoinedClubsLoading) {
    return (
      <DropdownMenuItem disabled>
        <RefreshCw className="size-4 animate-spin" />
        Loading clubs
      </DropdownMenuItem>
    );
  }

  if (isJoinedClubsError) {
    return (
      <DropdownMenuItem
        onSelect={(event) => {
          event.preventDefault();
          onRetryJoinedClubs?.();
        }}
      >
        <RefreshCw className="size-4" />
        Retry joined clubs
      </DropdownMenuItem>
    );
  }

  if (joinedClubs.length === 0) {
    return (
      <DropdownMenuItem disabled>
        <Users className="size-4" />
        No joined clubs yet
      </DropdownMenuItem>
    );
  }

  return joinedClubs.map((club) => {
    const VisibilityIcon = visibilityIcons[club.visibility];

    return (
      <DropdownMenuItem key={club.id} asChild>
        <NavLink to={`/app/clubs/${club.slug}`}>
          <VisibilityIcon className="size-4" />
          <span className="min-w-0 flex-1 truncate">{club.title}</span>
          <Badge variant="secondary">{roleLabels[club.role]}</Badge>
        </NavLink>
      </DropdownMenuItem>
    );
  });
};

const JoinedClubsLoading = () => (
  <div className="space-y-2 px-3 py-2">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
  </div>
);

const JoinedClubsError = ({ onRetry }: { onRetry?: () => void }) => (
  <div className="space-y-2 px-3 py-2">
    <p className="text-sm leading-5 text-faint">Could not load clubs.</p>
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={onRetry}
      disabled={!onRetry}
    >
      <RefreshCw />
      Retry
    </Button>
  </div>
);

const navButtonClassName =
  "flex h-11 items-center gap-3 rounded-lg border border-transparent px-3 text-sm text-muted transition-colors duration-150 hover:bg-active hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

const withNotificationBadge = (
  item: NavItem,
  notificationUnreadCount: number
): NavItem =>
  item.label === "Notifications" && notificationUnreadCount > 0
    ? {
        ...item,
        badge: notificationUnreadCount
      }
    : item;

const formatBadgeCount = (count: number) =>
  count > 99 ? "99+" : String(count);
