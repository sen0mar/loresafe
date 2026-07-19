import { useEffect, useRef, useState } from "react";

import type { PostReactionEmoji } from "../api/clubs.js";

const countFormatter = new Intl.NumberFormat();
const reactionPopMs = 180;

type ReactionButtonGroupProps = {
  ariaLabel: string;
  disabled?: boolean;
  onToggle: (emoji: PostReactionEmoji) => void;
  reactions: Array<{
    emoji: PostReactionEmoji;
    count: number;
    reactedByMe: boolean;
  }>;
};

export const ReactionButtonGroup = ({
  ariaLabel,
  disabled = false,
  onToggle,
  reactions
}: ReactionButtonGroupProps) => {
  const [poppingEmoji, setPoppingEmoji] = useState<PostReactionEmoji | null>(
    null
  );
  const popTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (popTimeoutRef.current) {
        window.clearTimeout(popTimeoutRef.current);
      }
    },
    []
  );

  const handleToggle = (emoji: PostReactionEmoji) => {
    if (popTimeoutRef.current) {
      window.clearTimeout(popTimeoutRef.current);
    }

    setPoppingEmoji(emoji);
    popTimeoutRef.current = window.setTimeout(() => {
      setPoppingEmoji(null);
      popTimeoutRef.current = null;
    }, reactionPopMs);
    onToggle(emoji);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="group"
      aria-label={ariaLabel}
    >
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          className="flex h-8 items-center gap-1 rounded-md border border-default bg-inset px-2 text-sm text-secondary transition hover:border-strong hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60 data-[active=true]:border-brand data-[active=true]:bg-active data-[active=true]:text-brand"
          data-active={reaction.reactedByMe}
          disabled={disabled}
          aria-pressed={reaction.reactedByMe}
          aria-label={`${reaction.reactedByMe ? "Remove" : "Add"} ${reaction.emoji} reaction`}
          onClick={() => handleToggle(reaction.emoji)}
        >
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-150 ease-out motion-reduce:transition-none data-[popping=true]:scale-125"
            data-popping={poppingEmoji === reaction.emoji}
          >
            {reaction.emoji}
          </span>
          <span className="text-xs">
            {countFormatter.format(reaction.count)}
          </span>
        </button>
      ))}
    </div>
  );
};
