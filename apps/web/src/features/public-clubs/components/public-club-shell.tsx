import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { LogIn, ShieldCheck, UserPlus } from "lucide-react";

import { BrandWordmark } from "@/shared/components/brand-wordmark";
import { Button } from "@/shared/components/ui/button";

type PublicClubShellProps = {
  children: ReactNode;
};

export const PublicClubShell = ({ children }: PublicClubShellProps) => (
  <main className="min-h-screen bg-background text-primary">
    <header className="soft-section-divider-bottom sticky top-0 z-20 bg-background/95 px-5 py-4 backdrop-blur sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg text-lg font-semibold tracking-normal text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <ShieldCheck className="size-5 text-brand" />
          <BrandWordmark />
        </Link>
        <nav className="flex items-center gap-2" aria-label="Public navigation">
          <Button asChild variant="ghost" size="sm">
            <Link to="/clubs">Clubs</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to="/login">
              <LogIn />
              Log in
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/signup">
              <UserPlus />
              Sign up
            </Link>
          </Button>
        </nav>
      </div>
    </header>
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:px-12">
      {children}
    </div>
  </main>
);
