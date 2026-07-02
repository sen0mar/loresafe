import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Clapperboard,
  Compass,
  Gamepad2,
  Grid2X2,
  Headphones,
  Library,
  LockKeyhole,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon
} from "lucide-react";

import { useMe } from "@/features/auth/api/auth";
import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import {
  type JoinedClub,
  type ProgressMode,
  useClubDashboardStatsQuery,
  useClubPostsInfiniteQuery,
  useClubProgressSummaryQuery,
  useJoinedClubsQuery,
  usePopularDiscussionsQuery,
  useRecentlyUnlockedSummaryQuery
} from "@/features/clubs/api/clubs";
import { PostCard } from "@/features/clubs/components/club-feed-tab";
import { MilestoneProgressDots } from "@/features/clubs/components/milestone-progress-dots";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

const previewPostLimit = 3;

const progressModeLabels: Record<ProgressMode, string> = {
  STRICT: "Strict",
  SOFT: "Soft",
  BRAVE: "Brave",
  FINISHED: "Finished"
};

const visibilityLabels: Record<JoinedClub["visibility"], string> = {
  PUBLIC: "Public",
  PRIVATE: "Private",
  INVITE_ONLY: "Invite-only"
};

const mediaTemplates = [
  {
    title: "Book",
    description: "Chapters, parts, or custom reading checkpoints.",
    icon: BookOpen
  },
  {
    title: "Show",
    description: "Episodes, seasons, or timestamped viewing progress.",
    icon: Clapperboard
  },
  {
    title: "Anime/Manga",
    description: "Separate anime arcs, manga chapters, or mixed timelines.",
    icon: Library
  },
  {
    title: "Game",
    description: "Missions, acts, bosses, regions, or campaign beats.",
    icon: Gamepad2
  },
  {
    title: "Podcast/Course",
    description: "Lessons, episodes, modules, or lectures.",
    icon: Headphones
  },
  {
    title: "Custom Timeline",
    description: "Any ordered story or learning path your group follows.",
    icon: Grid2X2
  }
];

export const HomePage = () => {
  const meQuery = useMe();
  const joinedClubsQuery = useJoinedClubsQuery(Boolean(meQuery.data));
  const featuredClub = joinedClubsQuery.data?.clubs[0] ?? null;

  return (
    <AuthenticatedAppShell
      rightRail={
        <HomeRightRail
          club={featuredClub}
          isLoading={joinedClubsQuery.isPending}
        />
      }
    >
      <div className="space-y-4">
        <HomeHeader displayName={meQuery.data?.displayName ?? "Reader"} />
        {joinedClubsQuery.isPending ? (
          <HomeLoading />
        ) : joinedClubsQuery.isError ? (
          <HomeError onRetry={() => void joinedClubsQuery.refetch()} />
        ) : featuredClub ? (
          <JoinedHomeDashboard club={featuredClub} />
        ) : (
          <EmptyHomeDashboard />
        )}
      </div>
    </AuthenticatedAppShell>
  );
};

const HomeHeader = ({ displayName }: { displayName: string }) => (
  <section className="flex flex-wrap items-start justify-between gap-4 border-b border-default pb-4">
    <div className="min-w-0 space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium text-brand">
        <ShieldCheck className="size-4" />
        Spoiler-safe home
      </p>
      <h1 className="text-2xl font-semibold tracking-normal text-primary sm:text-3xl">
        Welcome back, {displayName}
      </h1>
      <p className="max-w-2xl text-sm leading-6 text-muted">
        Continue from your current progress, catch up on safe discussions, and
        unlock more when your story checkpoint moves forward.
      </p>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button asChild>
        <Link to="/app/clubs/new">
          <PlusCircle />
          Create club
        </Link>
      </Button>
      <Button asChild variant="secondary">
        <Link to="/app/explore">
          <Compass />
          Explore clubs
        </Link>
      </Button>
    </div>
  </section>
);

const JoinedHomeDashboard = ({ club }: { club: JoinedClub }) => (
  <div className="space-y-4">
    <FeaturedClubPanel club={club} />
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
      <SafeDiscussionsPreview club={club} />
      <div className="space-y-4">
        <RecentlyUnlockedPreview club={club} />
        <PopularDiscussionsPreview club={club} />
      </div>
    </div>
  </div>
);

const FeaturedClubPanel = ({ club }: { club: JoinedClub }) => (
  <Card>
    <CardContent className="grid gap-4 p-4 md:grid-cols-[5.5rem_minmax(0,1fr)_auto] md:items-center">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-default bg-active text-brand">
        {club.coverUrl ? (
          <img
            src={club.coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <ShieldCheck className="size-10" />
        )}
      </div>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-xl font-semibold tracking-normal text-primary">
            {club.title}
          </h2>
          <Badge variant="secondary">{visibilityLabels[club.visibility]}</Badge>
          <Badge variant="outline">{formatRole(club.role)}</Badge>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted">
          <span className="inline-flex items-center gap-2">
            <Users className="size-4 text-faint" />
            {formatCount(club.memberCount)} members
          </span>
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-faint" />
            Featured from your joined clubs
          </span>
        </div>
      </div>
      <Button asChild variant="secondary" className="w-full md:w-fit">
        <Link to={`/app/clubs/${club.linkName}`}>Open club</Link>
      </Button>
    </CardContent>
  </Card>
);

const SafeDiscussionsPreview = ({ club }: { club: JoinedClub }) => {
  const postsQuery = useClubPostsInfiniteQuery(club.linkName, "safe");
  const posts = postsQuery.data?.pages.flatMap((page) => page.posts) ?? [];

  if (postsQuery.isPending) {
    return <PostPreviewSkeleton title="Safe discussions" />;
  }

  if (postsQuery.isError) {
    return (
      <PanelMessage
        icon={RefreshCw}
        title="Could not load safe discussions"
        description="Refresh this panel or open the club to try again."
        action={
          <Button variant="secondary" size="sm" onClick={() => void postsQuery.refetch()}>
            <RefreshCw />
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <section className="space-y-3">
      <SectionHeading
        icon={LockKeyhole}
        title="Safe discussions"
        description={`Visible from your current progress in ${club.title}.`}
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to={`/app/clubs/${club.linkName}`}>View feed</Link>
          </Button>
        }
      />
      {posts.length === 0 ? (
        <PanelMessage
          icon={LockKeyhole}
          title="No safe discussions yet"
          description="Create the first milestone-aware post when this club is ready."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to={`/app/clubs/${club.linkName}`}>Open club</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {posts.slice(0, previewPostLimit).map((post) => (
            <PostCard key={post.id} post={post} linked />
          ))}
        </div>
      )}
    </section>
  );
};

const RecentlyUnlockedPreview = ({ club }: { club: JoinedClub }) => {
  const unlockedQuery = useRecentlyUnlockedSummaryQuery(club.linkName);
  const posts = unlockedQuery.data?.posts ?? [];

  if (unlockedQuery.isPending) {
    return <CompactPanelSkeleton />;
  }

  if (unlockedQuery.isError || posts.length === 0) {
    return (
      <PanelMessage
        icon={Sparkles}
        title="Recently unlocked"
        description="Progress updates will surface newly safe discussions here."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to={`/app/clubs/${club.linkName}/recently-unlocked`}>
              View unlocks
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <section className="space-y-3">
      <SectionHeading
        icon={Sparkles}
        title="Recently unlocked"
        description="Newly safe from your latest progress change."
      />
      <div className="space-y-3">
        {posts.slice(0, 2).map((post) => (
          <PostCard key={post.id} post={post} linked />
        ))}
      </div>
    </section>
  );
};

const PopularDiscussionsPreview = ({ club }: { club: JoinedClub }) => {
  const popularQuery = usePopularDiscussionsQuery(club.linkName);
  const discussions = popularQuery.data?.discussions ?? [];

  if (popularQuery.isPending) {
    return <CompactPanelSkeleton />;
  }

  if (popularQuery.isError || discussions.length === 0) {
    return (
      <PanelMessage
        icon={TrendingUp}
        title="Popular discussions"
        description="Active safe conversations will appear once the club has posts."
      />
    );
  }

  return (
    <section className="space-y-3">
      <SectionHeading
        icon={TrendingUp}
        title="Popular discussions"
        description="High-engagement conversations from this club."
      />
      <div className="space-y-3">
        {discussions.slice(0, 2).map(({ post }) => (
          <PostCard key={post.id} post={post} linked />
        ))}
      </div>
    </section>
  );
};

const HomeRightRail = ({
  club,
  isLoading
}: {
  club: JoinedClub | null;
  isLoading: boolean;
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <CompactPanelSkeleton />
        <CompactPanelSkeleton />
      </div>
    );
  }

  if (!club) {
    return <EmptyRightRail />;
  }

  return <ClubRightRail club={club} />;
};

const ClubRightRail = ({ club }: { club: JoinedClub }) => {
  const progressQuery = useClubProgressSummaryQuery(club.linkName);
  const statsQuery = useClubDashboardStatsQuery(club.linkName);
  const progress = progressQuery.data?.progress;
  const stats = statsQuery.data?.stats;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          <CardDescription>{club.title}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {progressQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ) : progressQuery.isError || !progress ? (
            <p className="text-sm leading-6 text-muted">
              Progress could not be loaded right now.
            </p>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-muted">
                  {progress.currentMilestone
                    ? `Milestone ${progress.currentMilestone.position}: ${progress.currentMilestone.label}`
                    : "Not started"}
                </span>
                <span className="font-mono text-primary">
                  {progress.percentage}%
                </span>
              </div>
              <MilestoneProgressDots
                className="mt-2"
                completedMilestones={progress.completedMilestones}
                totalMilestones={progress.totalMilestones}
              />
              <p className="mt-2 text-xs text-faint">
                {progress.completedMilestones} of {progress.totalMilestones}{" "}
                milestones complete
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current mode</CardTitle>
          <CardDescription>
            {progress ? "Your spoiler visibility setting" : "Loading mode"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {progressQuery.isPending ? (
            <Skeleton className="h-6 w-20" />
          ) : progress ? (
            <Badge>{progressModeLabels[progress.mode]}</Badge>
          ) : (
            <Badge variant="outline">Unavailable</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Club snapshot</CardTitle>
          <CardDescription>Visible records for this club</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {statsQuery.isPending ? (
            <>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </>
          ) : statsQuery.isError || !stats ? (
            <p className="col-span-2 text-sm text-muted">
              Stats could not be loaded.
            </p>
          ) : (
            <>
              <Metric label="Safe" value={formatCount(stats.safePostCount)} />
              <Metric label="Locked" value={formatCount(stats.lockedPostCount)} />
              <Metric label="Posts" value={formatCount(stats.visiblePostCount)} />
              <Metric label="Comments" value={formatCount(stats.visibleCommentCount)} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-2 p-4">
          <Button asChild>
            <Link to={`/app/clubs/${club.linkName}`}>
              <ShieldCheck />
              Open featured club
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to={`/app/clubs/${club.linkName}/recently-unlocked`}>
              <Sparkles />
              Recently unlocked
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

const EmptyHomeDashboard = () => (
  <div className="space-y-4">
    <Card>
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-normal text-primary">
            Start with a spoiler-safe space
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted">
            Create a club for your group or join an existing public club. Once
            you set progress, this page becomes your safe discussion dashboard.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/app/clubs/new">
              <PlusCircle />
              Create club
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/app/explore">
              <Compass />
              Explore clubs
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>

    <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {mediaTemplates.map((template) => {
        const Icon = template.icon;

        return (
          <Card key={template.title}>
            <CardContent className="space-y-3 p-4">
              <span className="flex size-10 items-center justify-center rounded-lg border border-brand bg-active text-brand">
                <Icon className="size-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-primary">
                  {template.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {template.description}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>

    <div className="grid gap-4 lg:grid-cols-3">
      <PanelMessage
        icon={LockKeyhole}
        title="Safe discussions"
        description="Posts safe for your current checkpoint will appear here."
      />
      <PanelMessage
        icon={Sparkles}
        title="Recently unlocked"
        description="Forward progress will reveal newly available discussions."
      />
      <PanelMessage
        icon={TrendingUp}
        title="Progress"
        description="Your club-specific progress summaries will live here."
      />
    </div>
  </div>
);

const EmptyRightRail = () => (
  <div className="space-y-4">
    <PanelMessage
      icon={ShieldCheck}
      title="No clubs yet"
      description="Join or create a club to activate progress-aware panels."
    />
    <Card>
      <CardHeader>
        <CardTitle>How it works</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-6 text-muted">
        <p>Join a club.</p>
        <p>Set your current milestone.</p>
        <p>Discuss only what is safe for that progress.</p>
      </CardContent>
    </Card>
  </div>
);

const HomeLoading = () => (
  <div className="space-y-4">
    <Card>
      <CardContent className="grid gap-4 p-4 md:grid-cols-[5.5rem_minmax(0,1fr)_8rem] md:items-center">
        <Skeleton className="aspect-square rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-9 w-full" />
      </CardContent>
    </Card>
    <PostPreviewSkeleton title="Safe discussions" />
  </div>
);

const HomeError = ({ onRetry }: { onRetry: () => void }) => (
  <PanelMessage
    icon={RefreshCw}
    title="Could not load your home dashboard"
    description="Refresh your joined clubs and try again."
    action={
      <Button variant="secondary" onClick={onRetry}>
        <RefreshCw />
        Retry
      </Button>
    }
  />
);

const SectionHeading = ({
  action,
  description,
  icon: Icon,
  title
}: {
  action?: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 className="flex items-center gap-2 text-base font-semibold text-primary">
        <Icon className="size-5 text-brand" />
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
    {action}
  </div>
);

const PanelMessage = ({
  action,
  description,
  icon: Icon,
  title
}: {
  action?: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}) => (
  <Card>
    <CardContent className="flex min-h-44 flex-col items-center justify-center gap-3 p-4 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl border border-default bg-inset text-brand">
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="text-base font-semibold text-primary">{title}</h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted">
          {description}
        </p>
      </div>
      {action}
    </CardContent>
  </Card>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-default bg-inset p-3">
    <p className="text-xs text-faint">{label}</p>
    <p className="mt-1 font-mono text-lg font-semibold text-primary">
      {value}
    </p>
  </div>
);

const PostPreviewSkeleton = ({ title }: { title: string }) => (
  <section className="space-y-3">
    <SectionHeading
      icon={LockKeyhole}
      title={title}
      description="Loading your progress-aware preview."
    />
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index}>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  </section>
);

const CompactPanelSkeleton = () => (
  <Card>
    <CardContent className="space-y-3 p-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </CardContent>
  </Card>
);

const formatRole = (role: JoinedClub["role"]) =>
  role === "OWNER" ? "Owner" : role === "MODERATOR" ? "Moderator" : "Member";

const formatCount = (value: number) =>
  new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
