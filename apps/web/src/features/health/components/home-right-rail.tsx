import { Check, Flame } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import { Textarea } from "@/shared/components/ui/textarea";

const progressDots = [
  "read",
  "read",
  "read",
  "read",
  "current",
  "available",
  "available",
  "locked",
  "locked",
  "future",
  "future",
  "future"
] as const;

export const HomeRightRail = () => (
  <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle>Quick progress update</CardTitle>
        <CardDescription>The First Law · Book 1</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Chapter 6 of 26</span>
            <span className="font-mono text-primary">23%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-inset">
            <div className="h-full w-[23%] rounded-full bg-brand" />
          </div>
        </div>
        <Button className="w-full">Update progress</Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Reading mode</CardTitle>
        <CardDescription>
          Soft keeps context careful without freezing discussion.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {["Strict", "Soft", "Brave", "Finished"].map((mode) => (
          <button
            key={mode}
            type="button"
            className="flex items-center justify-between rounded-lg border border-default bg-inset px-3 py-2 text-left text-sm text-muted transition-colors hover:border-strong hover:bg-active hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand data-[active=true]:border-brand data-[active=true]:text-brand"
            data-active={mode === "Soft"}
          >
            <span>{mode}</span>
            {mode === "Soft" ? <Check className="size-4" /> : null}
          </button>
        ))}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Progress map</CardTitle>
        <CardDescription>
          Semantic chart tokens for read, available, locked, and future states.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {progressDots.map((state, index) => (
            <span
              key={`${state}-${index}`}
              className={getProgressDotClassName(state)}
              aria-label={`Milestone ${index + 1}: ${state}`}
            />
          ))}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="size-5 text-hot" />
          Popular prompt
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder="Draft a spoiler-safe discussion prompt..."
          aria-label="Draft discussion prompt"
        />
        <Button variant="secondary" className="w-full">
          Save draft
        </Button>
      </CardContent>
    </Card>
  </div>
);

const getProgressDotClassName = (state: (typeof progressDots)[number]) => {
  const baseClassName = "size-3 rounded-full";

  if (state === "read") {
    return `${baseClassName} bg-chart-read`;
  }

  if (state === "current") {
    return `${baseClassName} border-2 border-brand bg-active`;
  }

  if (state === "available") {
    return `${baseClassName} bg-chart-available`;
  }

  if (state === "locked") {
    return `${baseClassName} bg-chart-locked`;
  }

  return `${baseClassName} bg-chart-future`;
};
