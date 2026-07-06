import { Link } from "react-router-dom";
import { ArrowLeft, PlusCircle } from "lucide-react";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { Button } from "@/shared/components/ui/button";

import { CreateClubForm } from "../components/create-club-form.js";

export const CreateClubPage = () => {
  return (
    <AuthenticatedAppShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="soft-section-divider-bottom flex flex-wrap items-start justify-between gap-4 pb-4">
          <div className="min-w-0 space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-brand">
              <PlusCircle className="size-4" />
              New club
            </p>
            <h1 className="text-2xl font-semibold tracking-normal text-primary sm:text-3xl">
              Create a spoiler-safe club
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              Start with the club basics. Milestones and invites can come later.
            </p>
          </div>
          <Button variant="secondary" asChild>
            <Link to="/app/explore">
              <ArrowLeft />
              Explore
            </Link>
          </Button>
        </section>

        <CreateClubForm />
      </div>
    </AuthenticatedAppShell>
  );
};
