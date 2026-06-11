import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";

import { useSignupMutation } from "../api/signup.js";
import {
  signupFormSchema,
  type SignupFormValues
} from "../schemas/signup.schema.js";

type SignupFieldErrors = Partial<Record<keyof SignupFormValues, string>>;

const initialValues: SignupFormValues = {
  email: "",
  displayName: "",
  password: ""
};

export const SignupForm = () => {
  const navigate = useNavigate();
  const signupMutation = useSignupMutation();
  const [values, setValues] = useState<SignupFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});

  const updateField =
    (field: keyof SignupFormValues) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setValues((currentValues) => ({
        ...currentValues,
        [field]: event.target.value
      }));
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        [field]: undefined
      }));
    };

  const submitSignup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parseResult = signupFormSchema.safeParse(values);

    // Client validation is UX only; the backend repeats these checks before trusting input.
    if (!parseResult.success) {
      const flattenedErrors = parseResult.error.flatten().fieldErrors;

      setFieldErrors({
        email: flattenedErrors.email?.[0],
        displayName: flattenedErrors.displayName?.[0],
        password: flattenedErrors.password?.[0]
      });
      return;
    }

    setFieldErrors({});
    signupMutation.mutate(parseResult.data, {
      onSuccess: () => {
        // By this point the browser has processed Set-Cookie from the signup response.
        toast.success("Account created");
        navigate("/", { replace: true });
      }
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>
          Start with a spoiler-safe profile for your clubs and progress.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Native validation is disabled so Zod owns the visible field messages. */}
        <form className="grid gap-4" onSubmit={submitSignup} noValidate>
          {signupMutation.error ? (
            <SignupError error={signupMutation.error} />
          ) : null}

          <SignupField
            id="email"
            label="Email"
            icon={<Mail className="size-4" />}
            error={fieldErrors.email}
          >
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={updateField("email")}
              disabled={signupMutation.isPending}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
            />
          </SignupField>

          <SignupField
            id="displayName"
            label="Display name"
            icon={<UserRound className="size-4" />}
            error={fieldErrors.displayName}
          >
            <Input
              id="displayName"
              type="text"
              autoComplete="name"
              value={values.displayName}
              onChange={updateField("displayName")}
              disabled={signupMutation.isPending}
              aria-invalid={!!fieldErrors.displayName}
              aria-describedby={
                fieldErrors.displayName ? "displayName-error" : undefined
              }
            />
          </SignupField>

          <SignupField
            id="password"
            label="Password"
            icon={<LockKeyhole className="size-4" />}
            error={fieldErrors.password}
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={updateField("password")}
              disabled={signupMutation.isPending}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={
                fieldErrors.password ? "password-error" : undefined
              }
            />
          </SignupField>

          <Button type="submit" className="mt-2" disabled={signupMutation.isPending}>
            {signupMutation.isPending ? "Creating account..." : "Create account"}
            <ArrowRight />
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-faint">
          Already have an account?{" "}
          <Link className="text-brand hover:underline" to="/">
            Return home
          </Link>
        </p>
      </CardContent>
    </Card>
  );
};

const SignupField = ({
  id,
  label,
  icon,
  error,
  children
}: {
  id: keyof SignupFormValues;
  label: string;
  icon: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="grid gap-2">
    <label className="flex items-center gap-2 text-sm font-medium text-secondary" htmlFor={id}>
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

const SignupError = ({ error }: { error: Error }) => {
  const message =
    error instanceof ApiError
      ? error.message
      : "Something went wrong while creating your account.";

  return (
    <div className="rounded-lg border border-default bg-inset p-3" role="alert">
      <p className="text-sm text-error">{message}</p>
    </div>
  );
};
