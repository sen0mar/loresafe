import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/shared/components/ui/button";

import { AuthPageShell } from "../components/auth-page-shell.js";
import { SignupForm } from "../components/signup-form.js";

export const SignupPage = () => (
  <AuthPageShell
    eyebrow="Spoiler-safe by default"
    title="Join the discussion at your own pace."
    body="Create a profile, join clubs, and keep each conversation synced to where you are in the story."
    formLabel="Signup form"
    topLeftAction={
      <Button asChild variant="secondary">
        <Link to="/">
          <ArrowLeft />
          Back to home
        </Link>
      </Button>
    }
  >
    <SignupForm />
  </AuthPageShell>
);
