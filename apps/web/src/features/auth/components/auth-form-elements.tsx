import { ApiError } from "@/shared/api/api-client";

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
