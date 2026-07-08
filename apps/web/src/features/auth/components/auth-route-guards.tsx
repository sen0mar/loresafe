import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { RefreshCw, ShieldCheck } from "lucide-react";

import {
  AUTHENTICATED_HOME_PATH,
  getSafeInternalRedirectPath
} from "@/app/routes";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";

import { useMe } from "../api/auth.js";
import { hasAuthSessionHint } from "../api/auth-session-hint.js";

type AuthRouteGuardProps = {
  children: ReactNode;
};

export const ProtectedRoute = ({ children }: AuthRouteGuardProps) => {
  const meQuery = useMe();
  const location = useLocation();

  if (meQuery.isPending) {
    return <AuthRouteStatus title="Checking session" />;
  }

  if (meQuery.isError) {
    return (
      <AuthRouteStatus
        title="Session check failed"
        body="LoreSafe could not confirm your session."
        actionLabel="Try again"
        onAction={() => void meQuery.refetch()}
      />
    );
  }

  // getMe maps 401s to null, so missing, expired, and tampered cookies all land here.
  if (!meQuery.data) {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`;
    const searchParams = new URLSearchParams({
      redirectTo
    });

    return <Navigate to={`/login?${searchParams.toString()}`} replace />;
  }

  return children;
};

export const PublicOnlyRoute = ({ children }: AuthRouteGuardProps) => {
  // The local hint only decides whether to probe /me; the API still verifies the HttpOnly cookie.
  const meQuery = useMe({ enabled: hasAuthSessionHint() });
  const location = useLocation();

  if (meQuery.data) {
    const redirectTo =
      getSafeInternalRedirectPath(
        new URLSearchParams(location.search).get("redirectTo")
      ) ?? AUTHENTICATED_HOME_PATH;

    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

const AuthRouteStatus = ({
  title,
  body,
  actionLabel,
  onAction
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <main className="flex min-h-screen items-center justify-center bg-gradient-app p-4 text-primary">
    <Card className="w-full max-w-sm">
      <CardHeader>
        <span className="mb-2 flex size-10 items-center justify-center rounded-xl border border-brand bg-active text-brand shadow-glow">
          <ShieldCheck className="size-5" />
        </span>
        <CardTitle>{title}</CardTitle>
        {body ? <CardDescription>{body}</CardDescription> : null}
      </CardHeader>
      {actionLabel && onAction ? (
        <CardContent>
          <Button variant="secondary" onClick={onAction}>
            <RefreshCw />
            {actionLabel}
          </Button>
        </CardContent>
      ) : null}
    </Card>
  </main>
);
