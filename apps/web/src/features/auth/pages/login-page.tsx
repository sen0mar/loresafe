import { AuthPageShell } from "../components/auth-page-shell.js";
import { LoginForm } from "../components/login-form.js";

export const LoginPage = () => (
  <AuthPageShell
    eyebrow="Welcome back"
    title="Pick up where the conversation is safe."
    body="Log in to keep your progress, clubs, and spoiler-safe discussions synced."
    formLabel="Login form"
  >
    <LoginForm />
  </AuthPageShell>
);
