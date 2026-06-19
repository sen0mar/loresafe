import { AuthPageShell } from "../components/auth-page-shell.js";
import { LoginForm } from "../components/login-form.js";

export const LoginPage = () => (
  <AuthPageShell
    title="Welcome back"
    body="Log in to pick up your spoiler-free conversations, or sign up to explore new communities and conversations."
    formLabel="Login form"
  >
    <LoginForm />
  </AuthPageShell>
);
