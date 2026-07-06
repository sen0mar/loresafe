import type { ReactNode } from "react";
import {
  CalendarDays,
  Fingerprint,
  Mail,
  ShieldCheck,
  UserRound
} from "lucide-react";

import { useMe } from "@/features/auth/api/auth";
import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";

export const ProfilePage = () => {
  const meQuery = useMe();
  const currentUser = meQuery.data;

  if (!currentUser) {
    return null;
  }

  return (
    <AuthenticatedAppShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="soft-section-divider-bottom flex flex-wrap items-start justify-between gap-3 pb-4">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium text-brand">Profile</p>
            <h1 className="truncate text-2xl font-semibold tracking-normal text-primary sm:text-3xl">
              {currentUser.displayName}
            </h1>
            <p className="truncate text-sm text-muted">{currentUser.email}</p>
          </div>
          <Badge>
            <ShieldCheck className="size-3" />
            Authenticated
          </Badge>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Current session details.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <ProfileField
              icon={<UserRound className="size-4" />}
              label="Display name"
              value={currentUser.displayName}
            />
            <ProfileField
              icon={<Mail className="size-4" />}
              label="Email"
              value={currentUser.email}
            />
            <ProfileField
              icon={<CalendarDays className="size-4" />}
              label="Joined"
              value={formatAccountDate(currentUser.createdAt)}
            />
            <ProfileField
              icon={<CalendarDays className="size-4" />}
              label="Updated"
              value={formatAccountDate(currentUser.updatedAt)}
            />
            <ProfileField
              className="sm:col-span-2"
              icon={<Fingerprint className="size-4" />}
              label="User ID"
              value={currentUser.id}
              isMonospace
            />
          </CardContent>
        </Card>
      </div>
    </AuthenticatedAppShell>
  );
};

const ProfileField = ({
  className = "",
  icon,
  label,
  value,
  isMonospace = false
}: {
  className?: string;
  icon: ReactNode;
  label: string;
  value: string;
  isMonospace?: boolean;
}) => (
  <div className={`rounded-lg border border-default bg-inset p-3 ${className}`}>
    <div className="flex items-center gap-2 text-xs font-medium text-faint">
      <span className="text-brand">{icon}</span>
      {label}
    </div>
    <p
      className={`mt-2 break-words text-sm text-primary ${
        isMonospace ? "font-mono text-xs" : ""
      }`}
    >
      {value}
    </p>
  </div>
);

const formatAccountDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
