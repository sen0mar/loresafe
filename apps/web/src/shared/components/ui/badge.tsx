import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium tracking-normal transition-colors",
  {
    variants: {
      variant: {
        default: "border-brand bg-brand-soft text-brand",
        secondary: "border-default bg-active text-secondary",
        success: "border-default bg-active text-success",
        warning: "border-default bg-active text-warning",
        destructive: "border-default bg-active text-error",
        outline: "border-default bg-transparent text-muted"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span
    data-slot="badge"
    className={cn(badgeVariants({ variant, className }))}
    {...props}
  />
);

export { Badge, badgeVariants };
