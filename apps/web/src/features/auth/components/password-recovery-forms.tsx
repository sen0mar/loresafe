import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";

import {
  useRequestPasswordReset,
  useResetPassword,
  useVerifyEmail
} from "../api/auth.js";
import { AuthFormError, PasswordInput } from "./auth-form-elements.js";

export const ForgotPasswordForm = () => {
  const [email, setEmail] = useState("");
  const requestReset = useRequestPasswordReset();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    requestReset.mutate(email.trim().toLowerCase());
  };

  return (
    <AuthActionCard
      title="Reset your password"
      description="Enter your email. The response is the same for every account."
    >
      {requestReset.isSuccess ? (
        <p className="text-sm text-muted">
          If the account is eligible, an email has been sent.
        </p>
      ) : (
        <form className="grid gap-4" onSubmit={submit}>
          {requestReset.error ? (
            <AuthFormError
              error={requestReset.error}
              fallbackMessage="The reset request could not be completed."
            />
          ) : null}
          <Input
            aria-label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Button type="submit" disabled={requestReset.isPending}>
            {requestReset.isPending ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      )}
      <BackToLogin />
    </AuthActionCard>
  );
};

export const ResetPasswordForm = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const reset = useResetPassword();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    reset.mutate({ token, password });
  };

  return (
    <AuthActionCard
      title="Choose a new password"
      description="Resetting your password signs out every existing session."
    >
      {reset.isSuccess ? (
        <p className="text-sm text-muted">Your request is complete.</p>
      ) : (
        <form className="grid gap-4" onSubmit={submit}>
          {reset.error ? (
            <AuthFormError
              error={reset.error}
              fallbackMessage="The password could not be reset."
            />
          ) : null}
          <PasswordInput
            aria-label="New password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={12}
            required
          />
          <Button type="submit" disabled={reset.isPending || token.length < 40}>
            {reset.isPending ? "Resetting..." : "Reset password"}
          </Button>
        </form>
      )}
      <BackToLogin />
    </AuthActionCard>
  );
};

export const VerifyEmailCard = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const verification = useVerifyEmail();
  const { mutate } = verification;

  useEffect(() => {
    if (token.length >= 40) {
      mutate(token);
    }
  }, [mutate, token]);

  return (
    <AuthActionCard
      title="Verify your email"
      description="This link can be opened again safely after verification."
    >
      {verification.isPending ? (
        <p className="text-sm text-muted">Verifying...</p>
      ) : verification.isSuccess ? (
        <p className="text-sm text-muted">
          Your request is complete. You can now log in.
        </p>
      ) : (
        <AuthFormError
          error={
            verification.error ??
            new Error("This verification link is invalid or expired.")
          }
          fallbackMessage="This verification link is invalid or expired."
        />
      )}
      <BackToLogin />
    </AuthActionCard>
  );
};

const AuthActionCard = ({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <Card className="w-full max-w-md">
    <CardHeader>
      <CardTitle className="text-xl">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4">{children}</CardContent>
  </Card>
);

const BackToLogin = () => (
  <Link className="text-center text-sm text-brand hover:underline" to="/login">
    Back to login
  </Link>
);
