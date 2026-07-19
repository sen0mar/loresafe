import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, AtSign, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";

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
import { Input } from "@/shared/components/ui/input";

import { useSignup } from "../api/auth.js";
import {
  AuthFormError,
  AuthFormField,
  PasswordInput
} from "./auth-form-elements.js";
import {
  signupFormSchema,
  toSignupRequest,
  type SignupFormValues
} from "../schemas/signup.schema.js";

type SignupFieldErrors = Partial<Record<keyof SignupFormValues, string>>;

const initialValues: SignupFormValues = {
  email: "",
  username: "",
  password: "",
  confirmPassword: ""
};

export const SignupForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const signupMutation = useSignup();
  const [values, setValues] = useState<SignupFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const redirectTo =
    getSafeInternalRedirectPath(searchParams.get("redirectTo")) ??
    AUTHENTICATED_HOME_PATH;
  const loginPath =
    redirectTo === AUTHENTICATED_HOME_PATH
      ? "/login"
      : `/login?${new URLSearchParams({ redirectTo }).toString()}`;

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
        username: flattenedErrors.username?.[0],
        password: flattenedErrors.password?.[0],
        confirmPassword: flattenedErrors.confirmPassword?.[0]
      });
      return;
    }

    setFieldErrors({});
    signupMutation.mutate(toSignupRequest(parseResult.data), {
      onSuccess: () => {
        // By this point the browser has processed Set-Cookie from the signup response.
        toast.success("Account created");
        navigate(redirectTo, { replace: true });
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
            <AuthFormError
              error={signupMutation.error}
              fallbackMessage="Something went wrong while creating your account."
            />
          ) : null}

          <AuthFormField
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
          </AuthFormField>

          <AuthFormField
            id="username"
            label="Username"
            icon={<AtSign className="size-4" />}
            error={fieldErrors.username}
          >
            <Input
              id="username"
              type="text"
              autoComplete="username"
              value={values.username}
              onChange={updateField("username")}
              disabled={signupMutation.isPending}
              aria-invalid={!!fieldErrors.username}
              aria-describedby={
                fieldErrors.username ? "username-error" : undefined
              }
            />
          </AuthFormField>

          <AuthFormField
            id="password"
            label="Password"
            icon={<LockKeyhole className="size-4" />}
            error={fieldErrors.password}
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={values.password}
              onChange={updateField("password")}
              disabled={signupMutation.isPending}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={
                fieldErrors.password ? "password-error" : undefined
              }
            />
          </AuthFormField>

          <AuthFormField
            id="confirmPassword"
            label="Confirm password"
            icon={<LockKeyhole className="size-4" />}
            error={fieldErrors.confirmPassword}
          >
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={updateField("confirmPassword")}
              disabled={signupMutation.isPending}
              aria-invalid={!!fieldErrors.confirmPassword}
              aria-describedby={
                fieldErrors.confirmPassword
                  ? "confirmPassword-error"
                  : undefined
              }
            />
          </AuthFormField>

          <Button
            type="submit"
            className="mt-2"
            disabled={signupMutation.isPending}
          >
            {signupMutation.isPending
              ? "Creating account..."
              : "Create account"}
            <ArrowRight />
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-faint">
          Already have an account?{" "}
          <Link className="text-brand hover:underline" to={loginPath}>
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
};
