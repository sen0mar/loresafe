import type * as React from "react";

import { cn } from "@/shared/lib/utils";

const Input = ({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) => (
  <input
    type={type}
    data-slot="input"
    className={cn(
      "flex h-10 w-full min-w-0 rounded-md border border-subtle bg-inset px-3 py-2 text-sm text-primary shadow-soft outline-none transition-colors duration-150 ease-out placeholder:text-faint focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60",
      className
    )}
    {...props}
  />
);

export { Input };
