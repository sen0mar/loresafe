import { Building2 } from "lucide-react";

import { cn } from "@/shared/lib/utils";

type ClubAvatarProps = {
  title: string;
  coverUrl: string | null;
  className?: string;
  iconClassName?: string;
};

export const ClubAvatar = ({
  title,
  coverUrl,
  className,
  iconClassName
}: ClubAvatarProps) => (
  <span
    className={cn(
      "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-default bg-inset text-brand",
      className
    )}
  >
    {coverUrl ? (
      <img
        alt={`${title} cover`}
        className="size-full object-cover"
        loading="lazy"
        src={coverUrl}
      />
    ) : (
      <Building2 className={cn("size-5", iconClassName)} />
    )}
  </span>
);
