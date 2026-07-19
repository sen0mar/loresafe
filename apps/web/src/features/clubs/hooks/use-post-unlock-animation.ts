import { useEffect, useMemo, useRef, useState } from "react";

import type { ClubPostCard, ClubProgress, ProgressMode } from "../api/clubs.js";

const unlockAnimationDurationMs = 1500;

type ForwardUnlockRange = {
  fromPosition: number;
  key: string;
  toPosition: number;
};

export const usePostUnlockAnimation = ({
  posts,
  progress
}: {
  posts: ClubPostCard[];
  progress?: ClubProgress | null;
}) => {
  const latestForwardUnlockRange = useMemo(
    () => getLatestForwardUnlockRange(progress),
    [progress]
  );
  const previousUnlockKeyRef = useRef<string | null | undefined>(undefined);
  const pendingUnlockRangeRef = useRef<ForwardUnlockRange | null>(null);
  const previousVisibilityRef = useRef<Map<string, ClubPostCard["visibility"]>>(
    new Map()
  );
  const timeoutIdsRef = useRef<number[]>([]);
  const [animatingPostIds, setAnimatingPostIds] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(
    () => () => {
      timeoutIdsRef.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId)
      );
    },
    []
  );

  useEffect(() => {
    if (!progress) {
      return;
    }

    const latestUnlockKey = latestForwardUnlockRange?.key ?? null;

    if (previousUnlockKeyRef.current === undefined) {
      previousUnlockKeyRef.current = latestUnlockKey;
      return;
    }

    if (
      latestForwardUnlockRange &&
      previousUnlockKeyRef.current !== latestUnlockKey
    ) {
      pendingUnlockRangeRef.current = latestForwardUnlockRange;
    }

    previousUnlockKeyRef.current = latestUnlockKey;
  }, [latestForwardUnlockRange, progress]);

  useEffect(() => {
    const nextAnimatingPostIds = getNewlyUnlockedPostIds({
      posts,
      previousVisibility: previousVisibilityRef.current,
      unlockRange: pendingUnlockRangeRef.current
    });

    previousVisibilityRef.current = new Map(
      posts.map((post) => [post.id, post.visibility])
    );

    if (nextAnimatingPostIds.size === 0) {
      return;
    }

    pendingUnlockRangeRef.current = null;
    setAnimatingPostIds((currentPostIds) => {
      const nextPostIds = new Set(currentPostIds);

      nextAnimatingPostIds.forEach((postId) => nextPostIds.add(postId));

      return nextPostIds;
    });

    const timeoutId = window.setTimeout(() => {
      setAnimatingPostIds((currentPostIds) => {
        const nextPostIds = new Set(currentPostIds);

        nextAnimatingPostIds.forEach((postId) => nextPostIds.delete(postId));

        return nextPostIds;
      });
    }, unlockAnimationDurationMs);

    timeoutIdsRef.current.push(timeoutId);
  }, [posts]);

  return animatingPostIds;
};

const getNewlyUnlockedPostIds = ({
  posts,
  previousVisibility,
  unlockRange
}: {
  posts: ClubPostCard[];
  previousVisibility: Map<string, ClubPostCard["visibility"]>;
  unlockRange: ForwardUnlockRange | null;
}) => {
  const postIds = new Set<string>();

  posts.forEach((post) => {
    if (post.visibility !== "VISIBLE") {
      return;
    }

    const wasLocked = previousVisibility.get(post.id) === "LOCKED";
    const isInUnlockRange =
      unlockRange !== null &&
      post.requiredMilestone.position > unlockRange.fromPosition &&
      post.requiredMilestone.position <= unlockRange.toPosition;

    if (wasLocked || isInUnlockRange) {
      postIds.add(post.id);
    }
  });

  return postIds;
};

const getLatestForwardUnlockRange = (
  progress?: ClubProgress | null
): ForwardUnlockRange | null => {
  const latestHistory = progress?.history?.[0];

  if (!progress || !latestHistory) {
    return null;
  }

  const fromPosition = getSafeProgressPosition({
    milestonePosition: latestHistory.fromMilestone?.position ?? null,
    mode: latestHistory.fromMode,
    totalMilestones: progress.totalMilestones
  });
  const toPosition = getSafeProgressPosition({
    milestonePosition: latestHistory.toMilestone?.position ?? null,
    mode: latestHistory.toMode,
    totalMilestones: progress.totalMilestones
  });

  if (toPosition <= fromPosition) {
    return null;
  }

  return {
    fromPosition,
    key: latestHistory.id,
    toPosition
  };
};

const getSafeProgressPosition = ({
  milestonePosition,
  mode,
  totalMilestones
}: {
  milestonePosition: number | null;
  mode: ProgressMode;
  totalMilestones: number;
}) => {
  if (mode === "FINISHED") {
    return totalMilestones;
  }

  return milestonePosition ?? 0;
};
