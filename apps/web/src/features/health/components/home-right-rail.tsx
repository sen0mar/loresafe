import { CircleDot, History, Sparkles } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";

export const HomeRightRail = () => (
  <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle>Progress</CardTitle>
        <CardDescription>Your spoiler-safe checkpoint</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-muted">Chapter 6: Safe ground</span>
            <span className="font-mono text-primary">23%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-inset">
            <div className="h-full w-[23%] rounded-full bg-brand" />
          </div>
          <p className="mt-2 text-xs text-faint">
            6 of 26 milestones complete
          </p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleDot className="size-5 text-brand" />
          Current mode
        </CardTitle>
        <CardDescription>
          Only show what is safely reached.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Badge>Strict</Badge>
      </CardContent>
    </Card>

    <Card>
      <CardContent className="space-y-3 p-4">
        <span className="flex size-10 items-center justify-center rounded-lg border border-brand bg-active text-brand">
          <Sparkles className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-primary">
            Recently unlocked
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            New discussions appear after forward progress updates.
          </p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-5 text-faint" />
          Recent changes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted">
          Join a club and set progress to start tracking updates.
        </p>
      </CardContent>
    </Card>
  </div>
);
