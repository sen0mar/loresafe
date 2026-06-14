import { useState } from "react";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { ClubTimelineTab } from "@/features/clubs/components/club-timeline-tab";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";

import { useHealthQuery } from "../api/health.js";
import { ClubHeader, type ClubHomeTab } from "../components/club-header.js";
import { FeedPreview } from "../components/feed-preview.js";
import { HealthStatusPanel } from "../components/health-status-panel.js";
import { HomeRightRail } from "../components/home-right-rail.js";

export const HomePage = () => {
  const healthQuery = useHealthQuery();
  const [activeTab, setActiveTab] = useState<ClubHomeTab>("feed");

  return (
    <AuthenticatedAppShell rightRail={<HomeRightRail />}>
      <div className="space-y-4">
        <ClubHeader activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === "feed" ? (
          <>
            <HealthStatusPanel
              data={healthQuery.data}
              error={healthQuery.error}
              isPending={healthQuery.isPending}
              isRefreshing={healthQuery.isFetching}
              onRefresh={() => void healthQuery.refetch()}
            />
            <FeedPreview />
          </>
        ) : activeTab === "timeline" ? (
          <ClubTimelineTab slug="the-first-law-book-club" />
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
