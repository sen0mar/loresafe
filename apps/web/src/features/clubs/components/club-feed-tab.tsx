import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { CreatePostDialog, FeedToolbar } from "./club-feed-controls.js";
import {
  FeedEmpty,
  FeedError,
  FeedLoading,
  PostCard
} from "./club-feed-cards.js";

import {
  type Club,
  type ClubFeedTab as ClubFeedTabValue,
  useClubPostsInfiniteQuery,
  useClubProgressQuery
} from "../api/clubs.js";
import { usePostUnlockAnimation } from "../hooks/use-post-unlock-animation.js";

type ClubFeedTabProps = {
  club: Club;
};

type PostDetailLinkState = {
  returnLabel: string;
  returnTo: string;
};

const countFormatter = new Intl.NumberFormat();

export const ClubFeedTab = ({ club }: ClubFeedTabProps) => {
  const [activeTab, setActiveTab] = useState<ClubFeedTabValue>("all");
  const postsQuery = useClubPostsInfiniteQuery(club.linkName, activeTab);
  const progressQuery = useClubProgressQuery(
    club.linkName,
    club.membership.isMember
  );
  const posts = useMemo(
    () => postsQuery.data?.pages.flatMap((page) => page.posts) ?? [],
    [postsQuery.data]
  );
  const unlockingPostIds = usePostUnlockAnimation({
    posts,
    progress: progressQuery.data?.progress
  });
  const createPostAction = club.membership.isMember ? (
    <CreatePostDialog club={club} />
  ) : null;
  const postReturnState: PostDetailLinkState = {
    returnLabel: "Feed",
    returnTo: `/app/clubs/${club.linkName}?tab=feed`
  };

  if (postsQuery.isPending) {
    return (
      <div className="space-y-3">
        <FeedToolbar
          action={createPostAction}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <FeedLoading />
      </div>
    );
  }

  if (postsQuery.isError) {
    return (
      <FeedError
        error={postsQuery.error}
        onRetry={() => void postsQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-3">
      <FeedToolbar
        action={createPostAction}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {posts.length === 0 ? (
        <FeedEmpty activeTab={activeTab} />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              isUnlocking={unlockingPostIds.has(post.id)}
              post={post}
              linked
              returnState={postReturnState}
            />
          ))}
        </div>
      )}

      {postsQuery.hasNextPage ? (
        <div className="flex flex-col gap-3 rounded-xl border border-default bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {countFormatter.format(posts.length)} loaded
          </p>
          <Button
            className="w-full sm:w-fit"
            type="button"
            variant="secondary"
            size="sm"
            disabled={postsQuery.isFetchingNextPage}
            onClick={() => void postsQuery.fetchNextPage()}
          >
            <ChevronDown />
            {postsQuery.isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
