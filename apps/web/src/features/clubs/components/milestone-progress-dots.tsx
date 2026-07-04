import { cn } from "@/shared/lib/utils";

type MilestoneProgressDotsProps = {
  completedMilestones: number;
  totalMilestones: number;
  className?: string;
};

const checkpointsPerRow = 12;

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
  const checkpointRows = getCheckpointRows(checkpointCount);

  if (checkpointCount === 0) {
    return null;
  }

  return (
    <div
      aria-label={`${reachedCount} of ${checkpointCount} milestone checkpoints reached`}
      className={cn("flex max-w-full flex-col gap-1.5", className)}
    >
      {checkpointRows.map((row, rowIndex) => (
        <CheckpointRow
          key={rowIndex}
          reachedCount={reachedCount}
          row={row}
        />
      ))}
    </div>
  );
};

const CheckpointRow = ({
  reachedCount,
  row
}: {
  reachedCount: number;
  row: number[];
}) => {
  const progressWidth = getRowProgressWidth(row, reachedCount);

  return (
    <div
      aria-hidden="true"
      className="relative h-7 px-2.5"
      data-checkpoint-row
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
        {row.map((checkpointNumber) => {
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
              key={checkpointNumber}
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

const getRowProgressWidth = (row: number[], reachedCount: number) => {
  const rowStart = row[0] ?? 0;
  const rowEnd = row.at(-1) ?? 0;

  if (row.length <= 1) {
    return reachedCount >= rowStart ? 100 : 0;
  }

  if (reachedCount <= rowStart) {
    return 0;
  }

  if (reachedCount >= rowEnd) {
    return 100;
  }

  return ((reachedCount - rowStart) / (row.length - 1)) * 100;
};

const getCheckpointRows = (checkpointCount: number) =>
  Array.from(
    { length: Math.ceil(checkpointCount / checkpointsPerRow) },
    (_, rowIndex) =>
      Array.from(
        {
          length: Math.min(
            checkpointsPerRow,
            checkpointCount - rowIndex * checkpointsPerRow
          )
        },
        (_, checkpointIndex) => rowIndex * checkpointsPerRow + checkpointIndex + 1
      )
  );
