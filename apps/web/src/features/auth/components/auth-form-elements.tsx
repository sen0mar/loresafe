import type * as React from "react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

export const AuthFormField = ({
  id,
  label,
  icon,
  error,
  children
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="grid gap-2">
    <label
      className="flex items-center gap-2 text-sm font-medium text-secondary"
      htmlFor={id}
    >
      <span className="text-faint">{icon}</span>
      {label}
    </label>
    {children}
    {error ? (
      <p className="text-sm text-error" id={`${id}-error`}>
        {error}
      </p>
    ) : null}
  </div>
);

export const AuthFormError = ({
  error,
  fallbackMessage
}: {
  error: Error;
  fallbackMessage: string;
}) => {
  const message = error instanceof ApiError ? error.message : fallbackMessage;

  return (
    <div className="rounded-lg border border-default bg-inset p-3" role="alert">
      <p className="text-sm text-error">{message}</p>
    </div>
  );
};

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">;

export const PasswordInput = ({ className, ...props }: PasswordInputProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const toggleLabel = isVisible ? "Hide password" : "Show password";

  return (
    <div className="relative">
      <Input
        {...props}
        type={isVisible ? "text" : "password"}
        className={cn("pr-11", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={toggleLabel}
        aria-pressed={isVisible}
        className="absolute right-1 top-1 size-8 rounded-md text-faint hover:bg-active hover:text-brand disabled:cursor-not-allowed"
        disabled={props.disabled}
        onClick={() => setIsVisible((currentVisibility) => !currentVisibility)}
      >
        <span className="relative size-4" aria-hidden="true">
          <Eye
            className={cn(
              "absolute inset-0 transition-all duration-200 ease-out",
              isVisible ? "scale-100 opacity-100" : "scale-75 opacity-0"
            )}
          />
          <EyeOff
            className={cn(
              "absolute inset-0 transition-all duration-200 ease-out",
              isVisible ? "scale-75 opacity-0" : "scale-100 opacity-100"
            )}
          />
        </span>
      </Button>
    </div>
  );
};
