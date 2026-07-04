import {
  Ban,
  ChevronDown,
  RefreshCw,
  ShieldCheck,
  UserCog,
  Users
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/api-client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/shared/components/ui/dropdown-menu";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { getUserInitials } from "@/shared/lib/user-display";

import {
  type Club,
  type ClubBan,
  type ClubMember,
  type ClubMembershipRole,
  useBanClubMemberMutation,
  useClubBansQuery,
  useClubMembersQuery,
  useUnbanClubBanMutation,
  useUpdateClubMemberRoleMutation
} from "../api/clubs.js";

const roleLabels: Record<ClubMembershipRole, string> = {
  OWNER: "Owner",
  MODERATOR: "Moderator",
  MEMBER: "Member"
};

const roleOptions: ClubMembershipRole[] = ["OWNER", "MODERATOR", "MEMBER"];
const loadingRowIds = [
  "member-loading-1",
  "member-loading-2",
  "member-loading-3"
];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));

const formatBanExpiry = (value: string | null) =>
  value ? `Expires ${formatDate(value)}` : "Permanent ban";

const formatDeletedPostToast = (deletedPostCount: number) =>
  deletedPostCount === 0
    ? "Member banned."
    : `Member banned. ${deletedPostCount} ${
        deletedPostCount === 1 ? "post" : "posts"
      } deleted.`;

const canManageBans = (role: ClubMembershipRole | null) =>
  role === "OWNER" || role === "MODERATOR";

export const ClubMembersTab = ({ club }: { club: Club }) => {
  const [page, setPage] = useState(1);
  const membersQuery = useClubMembersQuery(
    club.linkName,
    page,
    club.membership.isMember
  );
  const pagination = membersQuery.data?.pagination;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-brand" />
            Members
          </CardTitle>
          <Badge variant="secondary">{club.memberCount} total</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {membersQuery.isPending ? (
            <MembersLoading />
          ) : membersQuery.isError ? (
            <MembersError
              error={membersQuery.error}
              onRetry={() => void membersQuery.refetch()}
            />
          ) : membersQuery.data.members.length === 0 ? (
            <MembersEmpty />
          ) : (
            <>
              <div className="space-y-3">
                {membersQuery.data.members.map((member) => (
                  <MemberRow key={member.id} club={club} member={member} />
                ))}
              </div>
              {pagination && pagination.pageCount > 1 ? (
                <div className="flex flex-col gap-3 rounded-lg border border-default bg-inset p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted">
                    Page {pagination.page} of {pagination.pageCount}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Button
                      className="w-full sm:w-fit"
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1 || membersQuery.isFetching}
                      onClick={() => setPage((currentPage) => currentPage - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      className="w-full sm:w-fit"
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={
                        page >= pagination.pageCount || membersQuery.isFetching
                      }
                      onClick={() => setPage((currentPage) => currentPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
      {canManageBans(club.membership.role) ? (
        <BannedUsersPanel club={club} />
      ) : null}
    </div>
  );
};

const MemberRow = ({ club, member }: { club: Club; member: ClubMember }) => {
  const canUpdateRole = club.membership.role === "OWNER";
  const canBan =
    club.membership.role === "OWNER" ||
    (club.membership.role === "MODERATOR" && member.role === "MEMBER");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-default bg-inset p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar>
          {member.user.avatarUrl ? (
            <AvatarImage
              src={member.user.avatarUrl}
              alt={`${member.user.displayName} avatar`}
            />
          ) : null}
          <AvatarFallback>
            {getUserInitials(member.user.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-primary">
              {member.user.displayName}
            </h3>
            <Badge variant="secondary">{roleLabels[member.role]}</Badge>
          </div>
          <p className="mt-1 text-xs text-faint">
            {member.user.username
              ? `/${member.user.username}`
              : "No username"}{" "}
            - Joined{" "}
            {formatDate(member.joinedAt)}
          </p>
        </div>
      </div>
      {canUpdateRole || canBan ? (
        <MemberControls
          canBan={canBan}
          canUpdateRole={canUpdateRole}
          club={club}
          member={member}
        />
      ) : null}
    </div>
  );
};

const MemberControls = ({
  canBan,
  canUpdateRole,
  club,
  member
}: {
  canBan: boolean;
  canUpdateRole: boolean;
  club: Club;
  member: ClubMember;
}) => {
  const [deleteAuthoredPosts, setDeleteAuthoredPosts] = useState(false);
  const updateRoleMutation = useUpdateClubMemberRoleMutation(club.linkName);
  const banMutation = useBanClubMemberMutation(club.linkName);
  const isPending = updateRoleMutation.isPending || banMutation.isPending;

  const showError = (error: unknown, fallback: string) => {
    toast.error(error instanceof ApiError ? error.message : fallback);
  };

  const updateRole = (role: ClubMembershipRole) => {
    updateRoleMutation.mutate(
      {
        membershipId: member.id,
        input: {
          role
        }
      },
      {
        onSuccess: () => toast.success("Role updated."),
        onError: (error) => showError(error, "Could not update role.")
      }
    );
  };

  const banMember = () => {
    banMutation.mutate(
      {
        membershipId: member.id,
        input: {
          deleteAuthoredPosts
        }
      },
      {
        onSuccess: (response) => {
          toast.success(formatDeletedPostToast(response.deletedPostCount));
          setDeleteAuthoredPosts(false);
        },
        onError: (error) => showError(error, "Could not ban member.")
      }
    );
  };

  return (
    <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
      {canUpdateRole ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="w-full sm:w-fit"
              type="button"
              variant="secondary"
              size="sm"
              disabled={isPending}
            >
              <UserCog />
              Role
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Set role</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {roleOptions.map((role) => (
              <DropdownMenuItem
                key={role}
                disabled={isPending || member.role === role}
                onSelect={() => updateRole(role)}
              >
                <ShieldCheck />
                {roleLabels[role]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {canBan ? (
        <>
          <label className="flex min-h-9 items-center gap-2 rounded-md border border-subtle bg-surface px-3 text-xs text-muted">
            <input
              className="size-4 rounded border border-default bg-inset accent-[var(--accent-primary)]"
              type="checkbox"
              checked={deleteAuthoredPosts}
              disabled={isPending}
              onChange={(event) => setDeleteAuthoredPosts(event.target.checked)}
            />
            Delete posts
          </label>
          <Button
            className="w-full sm:w-fit"
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={banMember}
          >
            <Ban />
            Ban
          </Button>
        </>
      ) : null}
    </div>
  );
};

const BannedUsersPanel = ({ club }: { club: Club }) => {
  const [page, setPage] = useState(1);
  const bansQuery = useClubBansQuery(
    club.linkName,
    page,
    canManageBans(club.membership.role)
  );
  const pagination = bansQuery.data?.pagination;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Ban className="size-5 text-warning" />
          Banned users
        </CardTitle>
        <Badge variant="secondary">{pagination?.total ?? 0} active</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {bansQuery.isPending ? (
          <MembersLoading />
        ) : bansQuery.isError ? (
          <BansError
            error={bansQuery.error}
            onRetry={() => void bansQuery.refetch()}
          />
        ) : bansQuery.data.bans.length === 0 ? (
          <BansEmpty />
        ) : (
          <>
            <div className="space-y-3">
              {bansQuery.data.bans.map((ban) => (
                <BannedUserRow key={ban.id} ban={ban} club={club} />
              ))}
            </div>
            {pagination && pagination.pageCount > 1 ? (
              <div className="flex flex-col gap-3 rounded-lg border border-default bg-inset p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted">
                  Page {pagination.page} of {pagination.pageCount}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button
                    className="w-full sm:w-fit"
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1 || bansQuery.isFetching}
                    onClick={() => setPage((currentPage) => currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    className="w-full sm:w-fit"
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={
                      page >= pagination.pageCount || bansQuery.isFetching
                    }
                    onClick={() => setPage((currentPage) => currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
};

const BannedUserRow = ({ ban, club }: { ban: ClubBan; club: Club }) => {
  const unbanMutation = useUnbanClubBanMutation(club.linkName);
  const canUnban =
    club.membership.role === "OWNER" ||
    (club.membership.role === "MODERATOR" && ban.roleAtBan === "MEMBER");

  const unbanUser = () => {
    unbanMutation.mutate(ban.id, {
      onSuccess: () => toast.success("User unbanned."),
      onError: (error) => {
        toast.error(
          error instanceof ApiError ? error.message : "Could not unban user."
        );
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-default bg-inset p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar>
          {ban.user.avatarUrl ? (
            <AvatarImage
              src={ban.user.avatarUrl}
              alt={`${ban.user.displayName} avatar`}
            />
          ) : null}
          <AvatarFallback>
            {getUserInitials(ban.user.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-primary">
              {ban.user.displayName}
            </h3>
            <Badge variant="destructive">Banned</Badge>
            {ban.roleAtBan ? (
              <Badge variant="secondary">{roleLabels[ban.roleAtBan]}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-faint">
            {ban.user.username ? `/${ban.user.username}` : "No username"} -{" "}
            {formatBanExpiry(ban.expiresAt)}
          </p>
          {ban.reason ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted">{ban.reason}</p>
          ) : null}
        </div>
      </div>
      {canUnban ? (
        <Button
          className="w-full sm:w-fit"
          type="button"
          variant="secondary"
          size="sm"
          disabled={unbanMutation.isPending}
          onClick={unbanUser}
        >
          <RefreshCw />
          Unban
        </Button>
      ) : null}
    </div>
  );
};

const MembersLoading = () => (
  <div className="space-y-3">
    {loadingRowIds.map((loadingRowId) => (
      <div
        key={loadingRowId}
        className="rounded-lg border border-default bg-inset p-4"
      >
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-3 h-4 w-64" />
      </div>
    ))}
  </div>
);

const MembersError = ({
  error,
  onRetry
}: {
  error: Error;
  onRetry: () => void;
}) => {
  const isNotFound = error instanceof ApiError && error.statusCode === 404;

  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-lg border border-default bg-inset p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-default bg-active text-warning">
        <Users className="size-6" />
      </span>
      <div>
        <h3 className="text-base font-semibold text-primary">
          {isNotFound ? "Members unavailable" : "Could not load members"}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {isNotFound
            ? "This roster is unavailable from your account."
            : "Refresh the member list and try again."}
        </p>
      </div>
      {isNotFound ? null : (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw />
          Retry
        </Button>
      )}
    </div>
  );
};

const BansError = ({
  error,
  onRetry
}: {
  error: Error;
  onRetry: () => void;
}) => {
  const isForbidden = error instanceof ApiError && error.statusCode === 403;

  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-4 rounded-lg border border-default bg-inset p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-default bg-active text-warning">
        <Ban className="size-6" />
      </span>
      <div>
        <h3 className="text-base font-semibold text-primary">
          {isForbidden ? "Bans unavailable" : "Could not load bans"}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {isForbidden
            ? "This ban list is unavailable from your account."
            : "Refresh the ban list and try again."}
        </p>
      </div>
      {isForbidden ? null : (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw />
          Retry
        </Button>
      )}
    </div>
  );
};

const MembersEmpty = () => (
  <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-default bg-inset p-6 text-center">
    <span className="flex size-12 items-center justify-center rounded-xl border border-default bg-active text-brand">
      <Users className="size-6" />
    </span>
    <h3 className="text-base font-semibold text-primary">No members yet</h3>
  </div>
);

const BansEmpty = () => (
  <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-default bg-inset p-6 text-center">
    <span className="flex size-12 items-center justify-center rounded-xl border border-default bg-active text-brand">
      <ShieldCheck className="size-6" />
    </span>
    <h3 className="text-base font-semibold text-primary">No active bans</h3>
  </div>
);
