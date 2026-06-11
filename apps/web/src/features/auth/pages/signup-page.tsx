import { ShieldCheck } from "lucide-react";

import { SignupForm } from "../components/signup-form.js";

export const SignupPage = () => (
  <div className="min-h-screen bg-gradient-app text-primary">
    <main className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-4 py-8 md:grid-cols-[minmax(0,1fr)_minmax(320px,448px)] md:px-6">
      <section className="min-w-0 space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl border border-brand bg-active text-brand shadow-glow">
            <ShieldCheck className="size-7" />
          </span>
          <span className="text-2xl font-semibold tracking-normal">
            Thread<span className="text-brand">Sync</span>
          </span>
        </div>

        <div className="max-w-2xl space-y-4">
          <p className="text-sm font-medium text-brand">Spoiler-safe by default</p>
          <h1 className="text-3xl font-semibold tracking-normal text-primary sm:text-5xl">
            Join the discussion at your own pace.
          </h1>
          <p className="text-base leading-7 text-muted">
            Create a profile, join clubs, and keep each conversation synced to
            where you are in the story.
          </p>
        </div>
      </section>

      <section className="flex min-w-0 justify-center md:justify-end" aria-label="Signup form">
        <SignupForm />
      </section>
    </main>
  </div>
);
