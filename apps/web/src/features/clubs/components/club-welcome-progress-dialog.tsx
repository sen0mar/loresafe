import { useMemo, useState } from "react";
import { Save, Sparkles, TrendingUp } from "lucide-react";
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
import { Skeleton } from "@/shared/components/ui/skeleton";

import {
  type ProgressMode,
  useClubMilestonesQuery,
  useClubProgressQuery,
  useUpdateClubProgressMutation
} from "../api/clubs.js";
import { formatMilestoneOption } from "../lib/milestone-display.js";
import {
  ReadingModeSelection,
  type ReadingModeOption
} from "./reading-mode-selection.js";

type ClubWelcomeProgressDialogProps = {
  clubTitle: string;
  isMember: boolean;
  linkName: string;
};

const notStartedValue = "not-started";

const progressModeOptions: ReadingModeOption[] = [
  {
    value: "STRICT",
    label: "Strict",
    description: "Only show discussions up to your saved checkpoint."
  },
  {
    value: "BRAVE",
    label: "Brave",
    description:
      "Keep Strict protection, with a manual reveal choice for locked posts."
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
  const isLoading =
    isMember &&
    (progressQuery.isPending ||
      (progress?.needsWelcomeSetup === true && milestonesQuery.isPending));
  const shouldOpen =
    isMember && !hasCompletedWelcome && progress?.needsWelcomeSetup === true;
  const selectedMilestone =
    selectedMilestoneId === notStartedValue
      ? null
      : (milestones.find((milestone) => milestone.id === selectedMilestoneId) ??
        null);
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

            <ReadingModeSelection
              disabled={updateProgressMutation.isPending}
              label={
                <p className="flex items-center gap-2 text-sm text-muted">
                  <TrendingUp className="size-4 text-brand" />
                  Reading mode
                </p>
              }
              onSelect={setSelectedMode}
              options={progressModeOptions}
              selectedMode={selectedMode}
            />
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

const WelcomeProgressLoading = () => (
  <div className="space-y-4">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-20 w-full" />
  </div>
);
