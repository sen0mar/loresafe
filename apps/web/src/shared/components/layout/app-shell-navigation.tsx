import type { ComponentType } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Bell,
  Bookmark,
  Compass,
  Globe2,
  Home,
  KeyRound,
  LockKeyhole,
  Menu,
  PanelLeftClose,
  RefreshCw,
  Settings,
  TrendingUp,
  Users,
  type LucideIcon
} from "lucide-react";

import { AUTHENTICATED_HOME_PATH } from "@/app/routes";
import { getClubFeedPath } from "@/features/clubs/lib/club-paths";
import { BrandMark } from "@/shared/components/brand-mark";
import { BrandWordmark } from "@/shared/components/brand-wordmark";
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
import {
  LiquidSelectionIndicator,
  useLiquidSelection
} from "@/shared/components/ui/liquid-selection";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

export type AppShellJoinedClub = {
  id: string;
  title: string;
  linkName: string;
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

type DesktopSidebarProps = AppShellNavigationProps & {
  isOpen: boolean;
  onClose: () => void;
};

type NavItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  path?: string;
  badge?: number;
};

const primaryNavItems: NavItem[] = [
  { label: "Home", icon: Home, path: AUTHENTICATED_HOME_PATH },
  { label: "My Clubs", icon: Users, path: "/app/clubs" },
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

const sidebarJoinedClubsLimit = 3;

const memberFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1
});

export const DesktopSidebar = ({
  isOpen,
  joinedClubs = [],
  joinedClubsTotal,
  isJoinedClubsError = false,
  isJoinedClubsLoading = false,
  notificationUnreadCount = 0,
  onClose,
  onRetryJoinedClubs
}: DesktopSidebarProps) => {
  const location = useLocation();
  const activePrimaryNavValue = getPrimaryNavActiveValue(location.pathname);
  const activeJoinedClubValue = getJoinedClubActiveValue(
    location.pathname,
    joinedClubs
  );

  return (
    <aside
      aria-label="Primary sidebar"
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={cn(
        "app-shell-sidebar absolute inset-0 isolate hidden w-[252px] overflow-y-auto rounded-2xl border border-default px-3 pb-4 transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none lg:flex lg:flex-col",
        isOpen
          ? "translate-x-0 opacity-100"
          : "pointer-events-none -translate-x-[calc(100%+0.75rem)] opacity-0"
      )}
    >
      <ShellBrand onClose={onClose} />
      <PrimaryNavigation
        activeValue={activePrimaryNavValue}
        notificationUnreadCount={notificationUnreadCount}
      />
      <JoinedClubsSection
        activeValue={activeJoinedClubValue}
        joinedClubs={joinedClubs}
        joinedClubsTotal={joinedClubsTotal}
        isJoinedClubsError={isJoinedClubsError}
        isJoinedClubsLoading={isJoinedClubsLoading}
        onRetryJoinedClubs={onRetryJoinedClubs}
      />
    </aside>
  );
};

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
      {primaryNavItems.map((navItem) => {
        const item = withNotificationBadge(navItem, notificationUnreadCount);
        const Icon = item.icon;

        if (item.path) {
          return (
            <DropdownMenuItem key={item.label} asChild>
              <NavLink
                to={item.path}
                end={item.path === AUTHENTICATED_HOME_PATH}
              >
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

const ShellBrand = ({ onClose }: { onClose: () => void }) => (
  <div className="flex items-center gap-1">
    <Link
      to={AUTHENTICATED_HOME_PATH}
      aria-label="LoreSafe home"
      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 pt-3 pb-2 text-primary transition-colors duration-150 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <BrandMark isDecorative className="size-10 shrink-0" />
      <BrandWordmark className="truncate text-xl font-semibold" />
    </Link>
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="mt-1 shrink-0 text-faint hover:bg-active hover:text-brand"
      onClick={onClose}
      aria-label="Hide sidebar"
    >
      <PanelLeftClose />
    </Button>
  </div>
);

const PrimaryNavigation = ({
  activeValue,
  notificationUnreadCount
}: {
  activeValue?: string;
  notificationUnreadCount: number;
}) => {
  const liquidSelection = useLiquidSelection<HTMLElement>(activeValue, {
    cacheKey: "app-shell-primary-navigation"
  });

  return (
    <nav
      ref={liquidSelection.groupRef}
      className="relative isolate mt-8 grid gap-1"
      aria-label="Primary navigation"
    >
      <LiquidSelectionIndicator
        indicatorStyle={liquidSelection.indicatorStyle}
        isVisible={liquidSelection.isIndicatorVisible}
        motion="smooth"
        settleAnimationKey={liquidSelection.settleAnimationKey}
        shouldPlaySettleAnimation={liquidSelection.shouldPlaySettleAnimation}
      />
      {primaryNavItems.map((item) => (
        <NavButton
          key={item.label}
          item={withNotificationBadge(item, notificationUnreadCount)}
        />
      ))}
    </nav>
  );
};

const NavButton = ({ item }: { item: NavItem }) => {
  const Icon = item.icon;

  if (item.path) {
    return (
      <NavLink
        data-liquid-selection-item
        data-liquid-selection-value={getNavItemValue(item)}
        to={item.path}
        end={item.path === AUTHENTICATED_HOME_PATH}
        className={({ isActive }) =>
          cn(
            navButtonClassName,
            isActive
              ? "text-brand hover:text-brand"
              : "hover:bg-active hover:text-primary"
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
  activeValue,
  joinedClubs = [],
  joinedClubsTotal,
  isJoinedClubsError = false,
  isJoinedClubsLoading = false,
  onRetryJoinedClubs
}: AppShellNavigationProps & { activeValue?: string }) => {
  const visibleJoinedClubs = joinedClubs.slice(0, sidebarJoinedClubsLimit);
  const totalJoinedClubs = joinedClubsTotal ?? joinedClubs.length;
  const hasMoreJoinedClubs = totalJoinedClubs > visibleJoinedClubs.length;

  return (
    <section className="sidebar-section-divider mt-6 min-h-0 pt-4">
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
      ) : visibleJoinedClubs.length === 0 ? (
        <p className="px-3 py-2 text-sm leading-5 text-faint">
          Join a public club to pin it here.
        </p>
      ) : (
        <>
          <JoinedClubsNav
            activeValue={activeValue}
            joinedClubs={visibleJoinedClubs}
          />
          {hasMoreJoinedClubs ? <JoinedClubsViewAllLink /> : null}
        </>
      )}
    </section>
  );
};

const JoinedClubsNav = ({
  activeValue,
  joinedClubs
}: {
  activeValue?: string;
  joinedClubs: AppShellJoinedClub[];
}) => {
  const liquidSelection = useLiquidSelection<HTMLElement>(activeValue, {
    cacheKey: "app-shell-joined-clubs-navigation"
  });

  return (
    <nav
      ref={liquidSelection.groupRef}
      className="relative isolate grid gap-1"
      aria-label="Joined clubs"
    >
      <LiquidSelectionIndicator
        indicatorStyle={liquidSelection.indicatorStyle}
        isVisible={liquidSelection.isIndicatorVisible}
        motion="smooth"
        settleAnimationKey={liquidSelection.settleAnimationKey}
        shouldPlaySettleAnimation={liquidSelection.shouldPlaySettleAnimation}
      />
      {joinedClubs.map((club) => (
        <JoinedClubLink key={club.id} club={club} />
      ))}
    </nav>
  );
};

const JoinedClubLink = ({ club }: { club: AppShellJoinedClub }) => {
  const VisibilityIcon = visibilityIcons[club.visibility];

  return (
    <NavLink
      data-liquid-selection-item
      data-liquid-selection-value={club.linkName}
      to={getClubFeedPath(club.linkName)}
      className={({ isActive }) =>
        cn(
          "relative z-10 block min-h-14 rounded-lg border border-transparent px-3 py-2 text-sm text-muted transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          isActive
            ? "text-brand hover:text-brand"
            : "hover:bg-active hover:text-primary"
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

const JoinedClubsViewAllLink = () => (
  <NavLink
    to="/app/clubs"
    className="mt-2 flex h-9 items-center justify-center rounded-lg border border-default bg-inset px-3 text-sm font-medium text-secondary transition-colors duration-150 hover:border-strong hover:bg-active hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
  >
    View all
  </NavLink>
);

const MobileJoinedClubs = ({
  joinedClubs = [],
  joinedClubsTotal,
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

  const totalJoinedClubs = joinedClubsTotal ?? joinedClubs.length;
  const hasMoreJoinedClubs = totalJoinedClubs > joinedClubs.length;

  return (
    <>
      {joinedClubs.map((club) => {
        const VisibilityIcon = visibilityIcons[club.visibility];

        return (
          <DropdownMenuItem key={club.id} asChild>
            <NavLink to={getClubFeedPath(club.linkName)}>
              <VisibilityIcon className="size-4" />
              <span className="min-w-0 flex-1 truncate">{club.title}</span>
              <Badge variant="secondary">{roleLabels[club.role]}</Badge>
            </NavLink>
          </DropdownMenuItem>
        );
      })}
      {hasMoreJoinedClubs ? (
        <DropdownMenuItem asChild>
          <NavLink to="/app/clubs">View all joined clubs</NavLink>
        </DropdownMenuItem>
      ) : null}
    </>
  );
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
  "relative z-10 flex h-11 items-center gap-3 rounded-lg border border-transparent px-3 text-sm text-muted transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

const getNavItemValue = (item: NavItem) => item.path ?? item.label;

const isPathActive = (pathname: string, path: string) =>
  path === AUTHENTICATED_HOME_PATH
    ? pathname === path
    : pathname === path || pathname.startsWith(`${path}/`);

const getPrimaryNavActiveValue = (pathname: string) =>
  primaryNavItems.find((item) => item.path && isPathActive(pathname, item.path))
    ?.path;

const getJoinedClubActiveValue = (
  pathname: string,
  joinedClubs: AppShellJoinedClub[]
) =>
  joinedClubs.find((club) =>
    isPathActive(pathname, `/app/clubs/${club.linkName}`)
  )?.linkName;

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
