import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/shared/components/ui/button";

import { AuthPageShell } from "../components/auth-page-shell.js";
import { LoginForm } from "../components/login-form.js";

export const LoginPage = () => (
  <AuthPageShell
    title="Welcome back"
    body="Log in to pick up your spoiler-free conversations, or sign up to explore new communities and conversations."
    formLabel="Login form"
    topLeftAction={
      <Button asChild variant="secondary">
        <Link to="/">
          <ArrowLeft />
          Back to home
        </Link>
      </Button>
    }
  >
    <LoginForm />
  </AuthPageShell>
);
