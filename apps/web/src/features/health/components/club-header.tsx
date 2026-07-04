import {
  Globe2,
  MoreHorizontal,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/shared/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

export type ClubHomeTab = "feed" | "about" | "members" | "timeline";

type ClubHeaderProps = {
  activeTab: ClubHomeTab;
  onTabChange: (tab: ClubHomeTab) => void;
};

export const ClubHeader = ({ activeTab, onTabChange }: ClubHeaderProps) => (
  <section className="grid gap-4 border-b border-default pb-4 md:grid-cols-[176px_minmax(0,1fr)]">
    <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-default bg-active shadow-soft">
      <ShieldCheck className="size-12 text-brand" />
    </div>
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal text-primary sm:text-3xl">
              The First Law Book Club
            </h1>
            <Badge>Verified</Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Abercrombie fans discussing the books one chapter at a time.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm">
            <Users />
            Invite
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" aria-label="Club actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Club settings</DropdownMenuItem>
              <DropdownMenuItem>Share club</DropdownMenuItem>
              <DropdownMenuItem>Report issue</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-sm text-muted">
        <span className="inline-flex items-center gap-2">
          <Globe2 className="size-4 text-faint" />
          Public club
        </span>
        <span className="inline-flex items-center gap-2">
          <Users className="size-4 text-faint" />
          1.2K members
        </span>
        <span className="inline-flex items-center gap-2">
          <Sparkles className="size-4 text-faint" />
          Fantasy
        </span>
      </div>
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as ClubHomeTab)}>
        <TabsList className="max-w-full">
          <TabsTrigger value="feed">Feed</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="feed" />
        <TabsContent value="about" />
        <TabsContent value="members" />
        <TabsContent value="timeline" />
      </Tabs>
    </div>
  </section>
);
