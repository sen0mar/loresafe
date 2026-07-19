import * as AvatarPrimitive from "@radix-ui/react-avatar";
import type * as React from "react";

import { cn } from "@/shared/lib/utils";

const Avatar = ({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) => (
  <AvatarPrimitive.Root
    data-slot="avatar"
    className={cn(
      "relative flex size-10 shrink-0 overflow-hidden rounded-full border border-default bg-active",
      className
    )}
    {...props}
  />
);

const AvatarImage = ({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) => (
  <AvatarPrimitive.Image
    data-slot="avatar-image"
    className={cn(
      "aspect-square size-full rounded-full object-cover",
      className
    )}
    {...props}
  />
);

const AvatarFallback = ({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) => (
  <AvatarPrimitive.Fallback
    data-slot="avatar-fallback"
    className={cn(
      "flex size-full items-center justify-center rounded-full bg-active text-sm font-medium text-brand",
      className
    )}
    {...props}
  />
);

export { Avatar, AvatarFallback, AvatarImage };
