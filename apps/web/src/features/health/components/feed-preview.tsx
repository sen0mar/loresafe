import { Bookmark, Lock, MessageSquare } from "lucide-react";

import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";

export const FeedPreview = () => (
  <div className="grid gap-4">
    <Card>
      <CardHeader>
        <CardTitle>Discussion feed</CardTitle>
        <CardDescription>
          Placeholder cards use safe metadata and semantic tokens only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <PostCard
          author="Miri"
          mode="Strict mode"
          title="Thoughts on Glokta's first visit to the Low Places"
          body="His perspective in these chapters is fascinating. You start to see how survival shapes people in unexpected ways."
        />
        <LockedCard />
        <PostCard
          author="Kesa"
          mode="Strict mode"
          title="Why The First Law is the best kind of fantasy"
          body="No chosen ones. No prophecy. Just people making the worst possible decisions. Perfection."
        />
      </CardContent>
    </Card>

    <div className="grid gap-4 lg:grid-cols-3">
      <SummaryCard title="Recently unlocked" value="3" label="new discussions" />
      <SummaryCard title="Progress summary" value="23%" label="chapter 6 of 26" />
      <SummaryCard title="Popular discussions" value="123" label="weekly reactions" />
    </div>
  </div>
);

const PostCard = ({
  author,
  mode,
  title,
  body
}: {
  author: string;
  mode: string;
  title: string;
  body: string;
}) => (
  <article className="rounded-xl border border-default bg-surface p-4">
    <div className="flex items-start gap-3">
      <Avatar>
        <AvatarFallback>{author.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
          <span className="font-medium text-secondary">{author}</span>
          <span>2h ago</span>
          <span>Up to Ch. 6</span>
          <Badge>{mode}</Badge>
        </div>
        <h2 className="mt-3 text-lg font-semibold tracking-normal text-primary">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
        <div className="mt-4 flex items-center gap-4 text-sm text-faint">
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="size-4" />
            12
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Bookmark className="size-4" />
            Save
          </span>
        </div>
      </div>
    </div>
  </article>
);

const LockedCard = () => (
  <article className="rounded-xl border border-default bg-subtle p-4">
    <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
      <span className="flex size-10 items-center justify-center rounded-full border border-default bg-inset text-muted">
        <Lock className="size-5" />
      </span>
      <div>
        <h2 className="text-base font-semibold text-primary">This discussion is locked</h2>
        <p className="mt-1 text-sm text-muted">
          Upgrade your progress or switch mode to unlock this conversation.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Badge variant="outline">
          <Lock className="size-3" />
          Up to Ch. 10
        </Badge>
        <Badge variant="warning">Brave+</Badge>
      </div>
    </div>
  </article>
);

const SummaryCard = ({
  title,
  value,
  label
}: {
  title: string;
  value: string;
  label: string;
}) => (
  <Card>
    <CardHeader>
      <CardDescription>{title}</CardDescription>
      <CardTitle className="text-2xl">{value}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted">{label}</p>
    </CardContent>
  </Card>
);
