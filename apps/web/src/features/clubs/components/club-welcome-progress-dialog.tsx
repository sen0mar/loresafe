import { useMemo, useState } from "react";
import { Check, Save, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/shared/components/ui/dialog";
import {
  LiquidSelectionIndicator,
  useLiquidSelection
} from "@/shared/components/ui/liquid-selection";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

import {
  type ClubMilestone,
  type ProgressMode,
  useClubMilestonesQuery,
  useClubProgressQuery,
  useUpdateClubProgressMutation
} from "../api/clubs.js";

type ClubWelcomeProgressDialogProps = {
  clubTitle: string;
  isMember: boolean;
  linkName: string;
};

type ProgressModeOption = {
  value: ProgressMode;
  label: string;
  description: string;
};

const notStartedValue = "not-started";

const progressModeOptions: ProgressModeOption[] = [
  {
    value: "STRICT",
    label: "Strict",
    description: "Only show discussions up to your saved checkpoint."
  },
  {
    value: "BRAVE",
    label: "Brave",
    description: "Keep Strict protection, with a manual reveal choice for locked posts."
  },
  {
    value: "FINISHED",
    label: "Finished",
    description: "Unlock the full timeline because you have finished the story."
  }
];

export const ClubWelcomeProgressDialog = ({
  clubTitle,
  isMember,
  linkName
}: ClubWelcomeProgressDialogProps) => {
  const progressQuery = useClubProgressQuery(linkName, isMember);
  const updateProgressMutation = useUpdateClubProgressMutation(linkName);
  const [hasCompletedWelcome, setHasCompletedWelcome] = useState(false);
  const progress = progressQuery.data?.progress;
  const shouldLoadMilestones =
    isMember && progress?.needsWelcomeSetup === true && !hasCompletedWelcome;
  const milestonesQuery = useClubMilestonesQuery(
    linkName,
    1,
    shouldLoadMilestones
  );
  const milestones = useMemo(
    () => milestonesQuery.data?.milestones ?? [],
    [milestonesQuery.data?.milestones]
  );
  const finalMilestone = milestones.at(-1) ?? null;
  const [selectedMilestoneId, setSelectedMilestoneId] =
    useState(notStartedValue);
  const [selectedMode, setSelectedMode] = useState<ProgressMode>("STRICT");
  const readingModeSelection = useLiquidSelection<HTMLDivElement>(selectedMode);
  const isLoading =
    isMember &&
    (progressQuery.isPending ||
      (progress?.needsWelcomeSetup === true && milestonesQuery.isPending));
  const shouldOpen =
    isMember &&
    !hasCompletedWelcome &&
    (isLoading || progress?.needsWelcomeSetup === true);
  const selectedMilestone =
    selectedMilestoneId === notStartedValue
      ? null
      : milestones.find((milestone) => milestone.id === selectedMilestoneId) ??
        null;
  const milestoneToSave =
    selectedMode === "FINISHED" && finalMilestone
      ? finalMilestone
      : selectedMilestone;

  const saveWelcomeProgress = () => {
    updateProgressMutation.mutate(
      {
        currentMilestoneId: milestoneToSave?.id ?? null,
        mode: selectedMode
      },
      {
        onSuccess: () => {
          setHasCompletedWelcome(true);
          toast.success("Welcome setup saved");
        },
        onError: (error) => {
          toast.error(
            error instanceof ApiError
              ? error.message
              : "Could not save welcome setup. Try again."
          );
        }
      }
    );
  };

  if (!isMember) {
    return null;
  }

  return (
    <Dialog open={shouldOpen} onOpenChange={() => undefined}>
      <DialogContent
        className="max-w-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-lg border border-brand bg-active text-brand">
            <Sparkles className="size-5" />
          </span>
          <DialogTitle>Welcome to {clubTitle}</DialogTitle>
          <DialogDescription>
            Set your spoiler-safe checkpoint before you start browsing. You can
            change this later in the Progress tab.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !progress ? (
          <WelcomeProgressLoading />
        ) : (
          <div className="space-y-4">
            <label className="grid gap-2 text-sm">
              <span className="text-muted">Current milestone</span>
              <select
                className="h-10 rounded-md border border-subtle bg-inset px-3 text-sm text-primary transition-colors hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
                value={selectedMilestoneId}
                disabled={updateProgressMutation.isPending}
                onChange={(event) => setSelectedMilestoneId(event.target.value)}
              >
                <option value={notStartedValue}>Not started</option>
                {milestones.map((milestone) => (
                  <option key={milestone.id} value={milestone.id}>
                    {formatMilestoneOption(milestone)}
                  </option>
                ))}
              </select>
            </label>

            <div
              ref={readingModeSelection.groupRef}
              className="relative isolate grid gap-2"
            >
              <p className="flex items-center gap-2 text-sm text-muted">
                <TrendingUp className="size-4 text-brand" />
                Reading mode
              </p>
              <LiquidSelectionIndicator
                indicatorStyle={readingModeSelection.indicatorStyle}
                isVisible={readingModeSelection.isIndicatorVisible}
                motion="smooth"
                settleAnimationKey={readingModeSelection.settleAnimationKey}
                shouldPlaySettleAnimation={
                  readingModeSelection.shouldPlaySettleAnimation
                }
              />
              {progressModeOptions.map((mode) => (
                <WelcomeReadingModeButton
                  key={mode.value}
                  disabled={updateProgressMutation.isPending}
                  mode={mode}
                  selectedMode={selectedMode}
                  onSelect={() => setSelectedMode(mode.value)}
                />
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            className="w-full sm:w-auto"
            disabled={isLoading || updateProgressMutation.isPending}
            onClick={saveWelcomeProgress}
          >
            <Save />
            {updateProgressMutation.isPending ? "Saving" : "Save setup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const WelcomeReadingModeButton = ({
  disabled,
  mode,
  onSelect,
  selectedMode
}: {
  disabled: boolean;
  mode: ProgressModeOption;
  onSelect: () => void;
  selectedMode: ProgressMode;
}) => {
  const isSelected = selectedMode === mode.value;

  return (
    <button
      data-active={isSelected ? "true" : "false"}
      data-liquid-selection-item
      data-liquid-selection-value={mode.value}
      type="button"
      className={cn(
        "relative z-10 rounded-lg border border-default px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60",
        isSelected
          ? "border-transparent text-brand hover:text-brand"
          : "bg-inset hover:border-strong hover:bg-active"
      )}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "text-sm font-medium",
            isSelected ? "text-brand" : "text-primary"
          )}
        >
          {mode.label}
        </span>
        {isSelected ? <Check className="size-4 text-brand" /> : null}
      </span>
      <span className="mt-1 block text-xs leading-5 text-faint">
        {mode.description}
      </span>
    </button>
  );
};

const WelcomeProgressLoading = () => (
  <div className="space-y-4">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-20 w-full" />
  </div>
);

const formatMilestoneOption = (milestone: ClubMilestone) =>
  `${milestone.position}. ${getMilestoneDisplayTitle(milestone)}`;

const getMilestoneDisplayTitle = (milestone: {
  safeTitle: string;
  fullTitle?: string | null;
}) => milestone.fullTitle ?? milestone.safeTitle;
