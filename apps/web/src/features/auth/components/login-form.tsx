import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";

import { useLogin } from "../api/auth.js";
import { AuthFormError, AuthFormField } from "./auth-form-elements.js";
import { loginFormSchema, type LoginFormValues } from "../schemas/login.schema.js";

type LoginFieldErrors = Partial<Record<keyof LoginFormValues, string>>;

const initialValues: LoginFormValues = {
  email: "",
  password: ""
};

export const LoginForm = () => {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const [values, setValues] = useState<LoginFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});

  const updateField =
    (field: keyof LoginFormValues) =>
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

  const submitLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parseResult = loginFormSchema.safeParse(values);

    if (!parseResult.success) {
      const flattenedErrors = parseResult.error.flatten().fieldErrors;

      setFieldErrors({
        email: flattenedErrors.email?.[0],
        password: flattenedErrors.password?.[0]
      });
      return;
    }

    setFieldErrors({});
    loginMutation.mutate(parseResult.data, {
      onSuccess: () => {
        toast.success("Logged in");
        navigate("/app/profile", { replace: true });
      }
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Log in</CardTitle>
        <CardDescription>
          Continue into your spoiler-safe clubs and progress.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submitLogin} noValidate>
          {loginMutation.error ? (
            <AuthFormError
              error={loginMutation.error}
              fallbackMessage="Something went wrong while logging in."
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
              disabled={loginMutation.isPending}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
            />
          </AuthFormField>

          <AuthFormField
            id="password"
            label="Password"
            icon={<LockKeyhole className="size-4" />}
            error={fieldErrors.password}
          >
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={updateField("password")}
              disabled={loginMutation.isPending}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={
                fieldErrors.password ? "password-error" : undefined
              }
            />
          </AuthFormField>

          <Button type="submit" className="mt-2" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Logging in..." : "Log in"}
            <ArrowRight />
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-faint">
          New to ThreadSync?{" "}
          <Link className="text-brand hover:underline" to="/signup">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
};
