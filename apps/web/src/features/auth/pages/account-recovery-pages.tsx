import { AuthPageShell } from "../components/auth-page-shell.js";
import {
  ForgotPasswordForm,
  ResetPasswordForm,
  VerifyEmailCard
} from "../components/password-recovery-forms.js";

const RecoveryShell = ({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) => (
  <AuthPageShell
    title="Secure account access"
    body="LoreSafe uses expiring, single-use links and neutral responses to protect account identity."
    formLabel={label}
  >
    {children}
  </AuthPageShell>
);

export const ForgotPasswordPage = () => (
  <RecoveryShell label="Password recovery form">
    <ForgotPasswordForm />
  </RecoveryShell>
);

export const ResetPasswordPage = () => (
  <RecoveryShell label="Password reset form">
    <ResetPasswordForm />
  </RecoveryShell>
);

export const VerifyEmailPage = () => (
  <RecoveryShell label="Email verification status">
    <VerifyEmailCard />
  </RecoveryShell>
);
import type { ReactNode } from "react";
