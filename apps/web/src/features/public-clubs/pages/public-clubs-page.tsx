import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Globe2 } from "lucide-react";

import { ClubDiscoveryCard } from "@/features/clubs/components/club-discovery-card";
import { PublicClubShell } from "@/features/public-clubs/components/public-club-shell";
import {
  type PublicClub,
  usePublicSeoClubsQuery
} from "@/features/public-clubs/api/public-clubs";
import { useDocumentMetadata } from "@/shared/hooks/use-document-metadata";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { toPublicUrl } from "@/shared/lib/public-site-origin";

const publicClubLimit = 20;

export const PublicClubsPage = () => {
  const clubsQuery = usePublicSeoClubsQuery({
    limit: publicClubLimit,
    sort: "popular"
  });
  const clubs = clubsQuery.data?.clubs ?? [];

  useDirectoryMetadata(clubs);

  return (
    <PublicClubShell>
      <div className="space-y-7">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl space-y-3">
            <Badge>
              <Globe2 className="size-3" />
              Public directory
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-normal text-primary sm:text-4xl">
                Spoiler-safe public clubs
              </h1>
              <p className="text-base leading-7 text-muted">
                Browse public LoreSafe clubs for books, shows, games, courses,
                and custom timelines before creating an account.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link to="/signup">Create a club</Link>
          </Button>
        </section>

        {clubsQuery.isPending ? (
          <PublicClubsStatus title="Loading public clubs" />
        ) : clubsQuery.isError ? (
          <PublicClubsStatus title="Could not load public clubs" />
        ) : clubs.length === 0 ? (
          <PublicClubsStatus title="No public clubs yet" />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {clubs.map((club) => (
              <ClubDiscoveryCard
                key={club.id}
                club={club}
                to={`/clubs/${club.linkName}`}
              />
            ))}
          </section>
        )}
      </div>
    </PublicClubShell>
  );
};

const useDirectoryMetadata = (clubs: PublicClub[]) => {
  const structuredData = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "LoreSafe public clubs",
      url: toPublicUrl("/clubs"),
      mainEntity: {
        "@type": "ItemList",
        itemListElement: clubs.map((club, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: toPublicUrl(`/clubs/${club.linkName}`),
          name: club.title
        }))
      }
    }),
    [clubs]
  );

  useDocumentMetadata({
    title: "Public spoiler-safe clubs | LoreSafe",
    description:
      "Browse public LoreSafe clubs for spoiler-safe book, show, game, course, and custom timeline discussions.",
    canonicalPath: toPublicUrl("/clubs"),
    imageUrl: toPublicUrl("/og/loresafe-home.png"),
    structuredData
  });
};

const PublicClubsStatus = ({ title }: { title: string }) => (
  <section className="rounded-xl border border-default bg-surface p-6">
    <h2 className="text-lg font-semibold text-primary">{title}</h2>
  </section>
);
