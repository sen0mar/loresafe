import { ClubProgressPanel } from "@/features/clubs/components/club-progress-panel";

const demoClubSlug = "the-first-law-book-club";

export const HomeRightRail = () => (
  <ClubProgressPanel slug={demoClubSlug} clubTitle="The First Law Book Club" />
);
