import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

export const AuthPageShell = ({
  eyebrow,
  title,
  body,
  formLabel,
  children
}: {
  eyebrow?: string;
  title: string;
  body: string;
  formLabel: string;
  children: ReactNode;
}) => (
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
          {eyebrow ? <p className="text-sm font-medium text-brand">{eyebrow}</p> : null}
          <h1 className="text-3xl font-semibold tracking-normal text-primary sm:text-5xl">
            {title}
          </h1>
          <p className="text-base leading-7 text-muted">{body}</p>
        </div>
      </section>

      <section className="flex min-w-0 justify-center md:justify-end" aria-label={formLabel}>
        {children}
      </section>
    </main>
  </div>
);
