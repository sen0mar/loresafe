import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { BrandMark } from "@/shared/components/brand-mark";
import { BrandWordmark } from "@/shared/components/brand-wordmark";
import { RouteDocumentMetadata } from "@/shared/hooks/use-document-metadata";
import { toPublicUrl } from "@/shared/lib/public-site-origin";

export type LegalSection = {
  title: string;
  content: ReactNode;
};

export const LegalPageLayout = ({
  title,
  description,
  version,
  effectiveDate,
  sections
}: {
  title: string;
  description: string;
  version: string;
  effectiveDate: string;
  sections: LegalSection[];
}) => (
  <main className="min-h-screen bg-background px-5 py-8 text-primary sm:px-8 lg:px-12">
    <RouteDocumentMetadata
      title={`${title} | LoreSafe`}
      description={description}
      canonicalPath={toPublicUrl(
        title === "Privacy Policy" ? "/privacy" : "/terms"
      )}
      robots="index, follow"
    />
    <div className="mx-auto max-w-3xl">
      <header className="mb-8 flex items-center justify-between gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandMark isDecorative className="size-9" />
          <span className="text-lg font-semibold">
            <BrandWordmark />
          </span>
        </Link>
        <Link className="text-sm text-brand hover:underline" to="/">
          Back home
        </Link>
      </header>

      <article className="rounded-2xl border border-default bg-surface p-5 sm:p-8">
        <header className="soft-section-divider-bottom pb-6">
          <h1 className="text-3xl font-semibold tracking-normal">{title}</h1>
          <p className="mt-2 text-sm text-muted">
            Version {version} · Effective {effectiveDate}
          </p>
          <p className="mt-4 text-sm leading-6 text-secondary">{description}</p>
        </header>

        <div className="space-y-8 pt-7">
          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <div className="space-y-3 text-sm leading-6 text-muted [&_a]:text-brand [&_a]:underline [&_li]:ml-5 [&_li]:list-disc">
                {section.content}
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  </main>
);
