import { type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type ClubCardGridProps = {
  children: ReactNode;
  className?: string;
};

export const ClubCardGrid = ({ children, className }: ClubCardGridProps) => (
  <div
    className={cn(
      "grid gap-4 md:grid-cols-2 2xl:grid-cols-3 min-[2000px]:grid-cols-4 min-[2500px]:grid-cols-5 min-[3000px]:grid-cols-6 min-[3500px]:grid-cols-7",
      className
    )}
  >
    {children}
  </div>
);
