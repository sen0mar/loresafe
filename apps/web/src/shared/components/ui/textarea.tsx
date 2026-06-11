import type * as React from "react";

import { cn } from "@/shared/lib/utils";

const Textarea = ({
  className,
  ...props
}: React.ComponentProps<"textarea">) => (
  <textarea
    data-slot="textarea"
    className={cn(
      "flex min-h-24 w-full rounded-md border border-subtle bg-inset px-3 py-2 text-sm text-primary shadow-soft outline-none transition-colors duration-150 ease-out placeholder:text-faint focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60",
      className
    )}
    {...props}
  />
);

export { Textarea };
