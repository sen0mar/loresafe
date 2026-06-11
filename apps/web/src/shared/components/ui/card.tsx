import type * as React from "react";

import { cn } from "@/shared/lib/utils";

const Card = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="card"
    className={cn(
      "rounded-xl border border-default bg-elevated text-primary shadow-card",
      className
    )}
    {...props}
  />
);

const CardHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="card-header"
    className={cn("flex flex-col gap-1.5 p-4", className)}
    {...props}
  />
);

const CardTitle = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="card-title"
    className={cn("text-base font-semibold leading-none text-primary", className)}
    {...props}
  />
);

const CardDescription = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="card-description"
    className={cn("text-sm leading-5 text-muted", className)}
    {...props}
  />
);

const CardContent = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="card-content"
    className={cn("p-4 pt-0", className)}
    {...props}
  />
);

const CardFooter = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="card-footer"
    className={cn("flex items-center gap-3 p-4 pt-0", className)}
    {...props}
  />
);

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
};
