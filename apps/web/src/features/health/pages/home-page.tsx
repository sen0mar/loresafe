import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";

import { useHealthQuery } from "../api/health.js";
import { ClubHeader } from "../components/club-header.js";
import { FeedPreview } from "../components/feed-preview.js";
import { HealthStatusPanel } from "../components/health-status-panel.js";
import { HomeRightRail } from "../components/home-right-rail.js";

export const HomePage = () => {
  const healthQuery = useHealthQuery();

  return (
    <AuthenticatedAppShell rightRail={<HomeRightRail />}>
      <div className="space-y-4">
        <ClubHeader />
        <HealthStatusPanel
          data={healthQuery.data}
          error={healthQuery.error}
          isPending={healthQuery.isPending}
          isRefreshing={healthQuery.isFetching}
          onRefresh={() => void healthQuery.refetch()}
        />
        <FeedPreview />
      </div>
    </AuthenticatedAppShell>
  );
};
