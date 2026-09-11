import { UserRound } from "lucide-react";

import { Button } from "@/shared/components/ui/button";

import { getDemoLoginCredentials } from "../config/demo-login.js";
import type { LoginFormValues } from "../schemas/login.schema.js";

type DemoLoginButtonProps = {
  disabled: boolean;
  isPending: boolean;
  onLogin: (credentials: LoginFormValues) => void;
};

export const DemoLoginButton = ({
  disabled,
  isPending,
  onLogin
}: DemoLoginButtonProps) => {
  const credentials = getDemoLoginCredentials();

  if (!credentials) return null;

  return (
    <>
      <div
        className="flex items-center gap-3 py-1 text-xs text-faint"
        aria-hidden
      >
        <span className="h-px flex-1 bg-border-subtle" />
        or
        <span className="h-px flex-1 bg-border-subtle" />
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => onLogin(credentials)}
      >
        <UserRound />
        {isPending ? "Opening demo..." : "Continue as guest"}
      </Button>
    </>
  );
};
