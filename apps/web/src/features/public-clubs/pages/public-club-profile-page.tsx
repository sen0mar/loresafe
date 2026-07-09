import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Globe2, LogIn, Sparkles, UserPlus, Users } from "lucide-react";

import { formatClubCategory } from "@/features/clubs/lib/club-categories";
import { getClubFeedPath } from "@/features/clubs/lib/club-paths";
import {
  type PublicClubDetail,
  usePublicSeoClubQuery
} from "@/features/public-clubs/api/public-clubs";
import { PublicClubShell } from "@/features/public-clubs/components/public-club-shell";
import { ApiError } from "@/shared/api/api-client";
import { useDocumentMetadata } from "@/shared/hooks/use-document-metadata";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import { toPublicUrl } from "@/shared/lib/public-site-origin";

const memberFormatter = new Intl.NumberFormat();

export const PublicClubProfilePage = () => {
  const { linkName } = useParams();
  const clubQuery = usePublicSeoClubQuery(linkName);
  const isNotFound =
    clubQuery.error instanceof ApiError && clubQuery.error.statusCode === 404;

  if (clubQuery.data?.club) {
    return <PublicClubProfile club={clubQuery.data.club} />;
  }

  if (clubQuery.isPending) {
    return (
      <PublicClubShell>
        <ProfileStatus title="Loading club" />
      </PublicClubShell>
    );
  }

  return (
    <PublicClubShell>
      <MissingPublicClubMetadata linkName={linkName ?? "club"} />
      <ProfileStatus
        title={isNotFound ? "Club not found" : "Could not load this club"}
      />
    </PublicClubShell>
  );
};

const PublicClubProfile = ({ club }: { club: PublicClubDetail }) => {
  useProfileMetadata(club);

  const appClubPath = getClubFeedPath(club.linkName);
  const redirectTo = encodeURIComponent(appClubPath);

  return (
    <PublicClubShell>
      <article className="space-y-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/clubs">
            <ArrowLeft />
            Public clubs
          </Link>
        </Button>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge>
                  <Globe2 className="size-3" />
                  Public club
                </Badge>
                <Badge variant="secondary">
                  <Sparkles className="size-3" />
                  {formatClubCategory(club.category)}
                </Badge>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-normal text-primary sm:text-4xl">
                  {club.title}
                </h1>
                <p className="text-sm text-faint">/{club.linkName}</p>
              </div>
              <p className="max-w-3xl text-base leading-7 text-muted">
                {club.description ??
                  "A public LoreSafe club for progress-aware discussions."}
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Club rules</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted">
                  {club.rules ?? "This public club has not posted rules yet."}
                </p>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Join the conversation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-default bg-inset p-3 text-sm text-muted">
                  <Users className="size-4 text-faint" />
                  <span>
                    {memberFormatter.format(club.memberCount)}{" "}
                    {club.memberCount === 1 ? "member" : "members"}
                  </span>
                </div>
                <div className="grid gap-2">
                  <Button asChild>
                    <Link to={`/signup?redirectTo=${redirectTo}`}>
                      <UserPlus />
                      Create account
                    </Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link to={`/login?redirectTo=${redirectTo}`}>
                      <LogIn />
                      Log in to join
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>
        </section>
      </article>
    </PublicClubShell>
  );
};

const useProfileMetadata = (club: PublicClubDetail) => {
  const canonicalUrl = toPublicUrl(`/clubs/${club.linkName}`);
  const description =
    club.description ??
    `${club.title} is a public LoreSafe club for spoiler-safe, progress-aware discussion.`;
  const imageUrl = club.coverUrl ?? toPublicUrl("/og/loresafe-home.png");
  const structuredData = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${canonicalUrl}#webpage`,
          name: `${club.title} | LoreSafe public club`,
          url: canonicalUrl,
          description
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "LoreSafe",
              item: toPublicUrl("/")
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Public clubs",
              item: toPublicUrl("/clubs")
            },
            {
              "@type": "ListItem",
              position: 3,
              name: club.title,
              item: canonicalUrl
            }
          ]
        },
        {
          "@type": "Thing",
          name: club.title,
          url: canonicalUrl,
          description,
          image: imageUrl,
          additionalType: formatClubCategory(club.category)
        }
      ]
    }),
    [canonicalUrl, club.category, club.title, description, imageUrl]
  );

  useDocumentMetadata({
    title: `${club.title} | LoreSafe public club`,
    description,
    canonicalPath: canonicalUrl,
    imageUrl,
    structuredData
  });
};

const MissingPublicClubMetadata = ({ linkName }: { linkName: string }) => {
  useDocumentMetadata({
    title: "Club not found | LoreSafe",
    description: "This public LoreSafe club could not be found.",
    canonicalPath: toPublicUrl(`/clubs/${linkName}`),
    imageUrl: toPublicUrl("/og/loresafe-home.png"),
    robots: "noindex, nofollow"
  });

  return null;
};

const ProfileStatus = ({ title }: { title: string }) => (
  <section className="rounded-xl border border-default bg-surface p-6">
    <h1 className="text-xl font-semibold tracking-normal text-primary">
      {title}
    </h1>
    <p className="mt-2 text-sm leading-6 text-muted">
      Public clubs only show spoiler-safe metadata. Private and invite-only
      clubs are hidden from this page.
    </p>
  </section>
);
