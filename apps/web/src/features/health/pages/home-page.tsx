import { useState } from "react";
import { ListChecks } from "lucide-react";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";

import { ClubHeader, type ClubHomeTab } from "../components/club-header.js";
import { FeedPreview } from "../components/feed-preview.js";
import { HomeRightRail } from "../components/home-right-rail.js";

export const HomePage = () => {
  const [activeTab, setActiveTab] = useState<ClubHomeTab>("feed");

  return (
    <AuthenticatedAppShell rightRail={<HomeRightRail />}>
      <div className="space-y-4">
        <ClubHeader activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === "feed" ? (
          <FeedPreview />
        ) : activeTab === "timeline" ? (
          <HomeTimelinePreview />
        ) : (
          <HomePlaceholderPanel activeTab={activeTab} />
        )}
      </div>
    </AuthenticatedAppShell>
  );
};

const placeholderCopy: Record<
  Exclude<ClubHomeTab, "feed" | "timeline">,
  {
    title: string;
    body: string;
  }
> = {
  about: {
    title: "About this club",
    body: "Club details, rules, and invites live on the dedicated club page."
  },
  members: {
    title: "Members",
    body: "Member management will become richer after the moderation and progress flows are in place."
  }
};

const HomePlaceholderPanel = ({
  activeTab
}: {
  activeTab: Exclude<ClubHomeTab, "feed" | "timeline">;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{placeholderCopy[activeTab].title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm leading-6 text-muted">
        {placeholderCopy[activeTab].body}
      </p>
    </CardContent>
  </Card>
);

const homeTimelineMilestones = [
  {
    position: 1,
    title: "Opening chapters",
    description: "First impressions and early character setup.",
    state: "Safe"
  },
  {
    position: 2,
    title: "First turning point",
    description: "A spoiler-safe checkpoint for the first major shift.",
    state: "Locked"
  },
  {
    position: 3,
    title: "Midpoint discussion",
    description: "A later milestone preview without revealing the scene.",
    state: "Locked"
  }
];

const HomeTimelinePreview = () => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <ListChecks className="size-5 text-brand" />
        Timeline preview
      </CardTitle>
    </CardHeader>
    <CardContent>
      <ol className="space-y-3">
        {homeTimelineMilestones.map((milestone) => (
          <li
            className="grid gap-3 rounded-xl border border-default bg-elevated p-4 sm:grid-cols-[3rem_minmax(0,1fr)]"
            key={milestone.position}
          >
            <div className="flex size-11 items-center justify-center rounded-lg border border-strong bg-active font-mono text-sm font-medium text-brand">
              {milestone.position}
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-base font-semibold tracking-normal text-primary">
                  {milestone.title}
                </h2>
                <Badge
                  variant={milestone.state === "Safe" ? "default" : "outline"}
                >
                  {milestone.state}
                </Badge>
              </div>
              <p className="text-sm leading-6 text-muted">
                {milestone.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </CardContent>
  </Card>
);
