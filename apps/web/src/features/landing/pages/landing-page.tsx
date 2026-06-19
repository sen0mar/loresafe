import { Link } from "react-router-dom";
import { LogIn, ShieldCheck, UserPlus } from "lucide-react";

import { Button } from "@/shared/components/ui/button";

import { LandingHeroVisual } from "../components/landing-hero-visual.js";

export const LandingPage = () => (
  <main className="overflow-hidden bg-background text-primary">
    <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden">
      <LandingHeroVisual />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/90 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/80" />

      <div className="pointer-events-none relative z-10 flex min-h-[calc(100svh-4rem)] items-center px-5 py-12 sm:px-8 lg:px-12">
        <div className="pointer-events-auto w-full max-w-xl space-y-7 pt-10 sm:pt-0">
          <div className="inline-flex items-center gap-2 rounded-lg border border-brand bg-active px-3 py-2 text-sm font-medium text-brand">
            <ShieldCheck className="size-4" />
            Spoiler-safe clubs
          </div>
          <div className="space-y-5">
            <h1 className="max-w-lg text-5xl font-semibold tracking-normal text-primary sm:text-6xl lg:text-7xl">
              ThreadSync
            </h1>
            <p className="max-w-lg text-base leading-7 text-secondary sm:text-lg sm:leading-8">
              Discuss books, shows, games, and courses without stumbling into
              spoilers. ThreadSync keeps every club conversation matched to
              where you are in the story.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/signup">
                <UserPlus />
                Create account
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/login">
                <LogIn />
                Log in
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
    <section className="relative z-10 border-t border-default bg-background px-5 py-5 sm:px-8 lg:px-12">
      <div className="grid max-w-5xl gap-3 text-sm text-muted sm:grid-cols-3">
        <p>
          <span className="font-medium text-primary">Create clubs</span> around
          any story or course.
        </p>
        <p>
          <span className="font-medium text-primary">Set progress</span> for
          every member.
        </p>
        <p>
          <span className="font-medium text-primary">Unlock conversations</span>{" "}
          only when they are safe.
        </p>
      </div>
    </section>
  </main>
);
