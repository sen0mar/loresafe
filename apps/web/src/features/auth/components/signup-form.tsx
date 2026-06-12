import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";
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

import { useSignup } from "../api/auth.js";
import { AuthFormError, AuthFormField } from "./auth-form-elements.js";
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
  const signupMutation = useSignup();
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
        navigate("/app/settings/profile", { replace: true });
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

          <Button type="submit" className="mt-2" disabled={signupMutation.isPending}>
            {signupMutation.isPending ? "Creating account..." : "Create account"}
            <ArrowRight />
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-faint">
          Already have an account?{" "}
          <Link className="text-brand hover:underline" to="/login">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
};
