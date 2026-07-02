import { cn } from "@/shared/lib/utils";

type MilestoneProgressDotsProps = {
  completedMilestones: number;
  totalMilestones: number;
  className?: string;
};

export const MilestoneProgressDots = ({
  className,
  completedMilestones,
  totalMilestones
}: MilestoneProgressDotsProps) => {
  const checkpointCount = Math.max(0, totalMilestones);
  const reachedCount = Math.min(
    Math.max(0, completedMilestones),
    checkpointCount
  );
  const progressWidth =
    checkpointCount <= 1
      ? reachedCount > 0
        ? 100
        : 0
      : Math.max(0, ((reachedCount - 1) / (checkpointCount - 1)) * 100);

  if (checkpointCount === 0) {
    return null;
  }

  return (
    <div
      aria-label={`${reachedCount} of ${checkpointCount} milestone checkpoints reached`}
      className={cn("relative h-7 px-2.5", className)}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-2.5 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-border"
      />
      <span
        aria-hidden="true"
        className="absolute left-2.5 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-brand transition-all"
        style={{ width: `calc((100% - 1.25rem) * ${progressWidth / 100})` }}
      />
      <div
        aria-hidden="true"
        className="relative z-10 flex h-full items-center justify-between"
      >
        {Array.from({ length: checkpointCount }, (_, index) => {
          const checkpointNumber = index + 1;
          const isReached = checkpointNumber < reachedCount;
          const isCurrent = checkpointNumber === reachedCount;

          return (
            <span
              className={cn(
                "flex size-4.5 shrink-0 items-center justify-center rounded-full border-2 bg-surface transition-colors",
                isReached && "border-brand bg-brand",
                isCurrent && "border-brand bg-surface",
                !isReached && !isCurrent && "border-strong bg-surface"
              )}
              data-checkpoint-state={
                isCurrent ? "current" : isReached ? "reached" : "future"
              }
              key={index}
            >
              {isCurrent ? (
                <span className="size-2 rounded-full bg-foreground" />
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
};
