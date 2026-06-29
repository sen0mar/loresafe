import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Users
} from "lucide-react";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";

import { useAcceptInviteMutation } from "../api/invites.js";

export const InviteAcceptPage = () => {
  const { token = "" } = useParams();
  const acceptInviteMutation = useAcceptInviteMutation();
  const {
    data,
    error,
    isError,
    isSuccess,
    mutate,
    reset
  } = acceptInviteMutation;
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    if (!token || hasSubmittedRef.current) {
      return;
    }

    hasSubmittedRef.current = true;
    mutate(token);
  }, [mutate, token]);

  const retryAccept = () => {
    hasSubmittedRef.current = true;
    reset();
    mutate(token);
  };

  return (
    <AuthenticatedAppShell>
      <div className="mx-auto flex min-h-[60vh] max-w-xl items-center">
        {isSuccess ? (
          <InviteSuccessCard result={data} />
        ) : isError ? (
          <InviteErrorCard
            error={error}
            onRetry={retryAccept}
          />
        ) : (
          <InviteLoadingCard />
        )}
      </div>
    </AuthenticatedAppShell>
  );
};

const InviteLoadingCard = () => (
  <Card className="w-full">
    <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-brand bg-active text-brand shadow-glow">
        <RefreshCw className="size-6 animate-spin" />
      </span>
      <div>
        <h1 className="text-lg font-semibold text-primary">Joining club</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Checking this invite and syncing your membership.
        </p>
      </div>
    </CardContent>
  </Card>
);

const InviteSuccessCard = ({
  result
}: {
  result: {
    status: "accepted" | "already_member";
    club: {
      title: string;
      linkName: string;
    };
  };
}) => {
  const isAlreadyMember = result.status === "already_member";

  return (
    <Card className="w-full">
      <CardHeader>
        <span className="mb-2 flex size-12 items-center justify-center rounded-xl border border-brand bg-active text-brand shadow-glow">
          {isAlreadyMember ? (
            <Users className="size-6" />
          ) : (
            <CheckCircle2 className="size-6" />
          )}
        </span>
        <CardTitle>
          {isAlreadyMember ? "Already a member" : "Invite accepted"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted">
          {isAlreadyMember
            ? `You're already in ${result.club.title}.`
            : `You're now a member of ${result.club.title}.`}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to={`/app/clubs/${result.club.linkName}`}>
              <KeyRound />
              Open club
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/app/explore">
              <ArrowLeft />
              Explore
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const InviteErrorCard = ({
  error,
  onRetry
}: {
  error: Error;
  onRetry: () => void;
}) => {
  const state = getInviteErrorState(error);
  const Icon = state.icon;

  return (
    <Card className="w-full">
      <CardHeader>
        <span className="mb-2 flex size-12 items-center justify-center rounded-xl border border-default bg-inset text-warning">
          <Icon className="size-6" />
        </span>
        <CardTitle>{state.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted">{state.body}</p>
        <div className="flex flex-wrap gap-3">
          {state.canRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              <RefreshCw />
              Retry
            </Button>
          ) : null}
          <Button variant={state.canRetry ? "ghost" : "secondary"} asChild>
            <Link to="/app/explore">
              <ArrowLeft />
              Explore
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const getInviteErrorState = (error: Error) => {
  if (error instanceof ApiError) {
    if (error.code === "INVITE_EXPIRED") {
      return {
        title: "Invite expired",
        body: "This invite link is past its expiry time.",
        icon: Clock3,
        canRetry: false
      };
    }

    if (error.code === "INVITE_REVOKED") {
      return {
        title: "Invite revoked",
        body: "This invite link is no longer active.",
        icon: LockKeyhole,
        canRetry: false
      };
    }

    if (error.code === "INVITE_MAXED") {
      return {
        title: "Invite full",
        body: "This invite has already reached its maximum number of uses.",
        icon: Users,
        canRetry: false
      };
    }

    if (error.statusCode === 404 || error.statusCode === 400) {
      return {
        title: "Invite unavailable",
        body: "This invite link could not be found.",
        icon: LockKeyhole,
        canRetry: false
      };
    }
  }

  return {
    title: "Could not accept invite",
    body: "Refresh this page and try again.",
    icon: RefreshCw,
    canRetry: true
  };
};
