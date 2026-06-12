import { AuthPageShell } from "../components/auth-page-shell.js";
import { SignupForm } from "../components/signup-form.js";

export const SignupPage = () => (
  <AuthPageShell
    eyebrow="Spoiler-safe by default"
    title="Join the discussion at your own pace."
    body="Create a profile, join clubs, and keep each conversation synced to where you are in the story."
    formLabel="Signup form"
  >
    <SignupForm />
  </AuthPageShell>
);
