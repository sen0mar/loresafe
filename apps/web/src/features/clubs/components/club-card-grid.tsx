import { type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type ClubCardGridProps = {
  children: ReactNode;
  className?: string;
};

export const ClubCardGrid = ({ children, className }: ClubCardGridProps) => (
  <div
    className={cn(
      "grid gap-4 md:grid-cols-2 2xl:grid-cols-3 min-[125rem]:grid-cols-4 min-[156.25rem]:grid-cols-5 min-[187.5rem]:grid-cols-6 min-[218.75rem]:grid-cols-7",
      className
    )}
  >
    {children}
  </div>
);
