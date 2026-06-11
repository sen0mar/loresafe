import type * as React from "react";

import { cn } from "@/shared/lib/utils";

const Skeleton = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="skeleton"
    className={cn("animate-pulse rounded-md bg-active", className)}
    {...props}
  />
);

export { Skeleton };
