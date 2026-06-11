import type * as React from "react";
import { toast, Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({
  toastOptions,
  ...props
}: ToasterProps & { className?: string }) => (
  <Sonner
    theme="dark"
    richColors={false}
    toastOptions={{
      ...toastOptions,
      classNames: {
        toast:
          "border border-default bg-elevated text-primary shadow-card font-sans",
        title: "text-primary",
        description: "text-muted",
        actionButton: "bg-brand text-on-brand",
        cancelButton: "bg-active text-secondary",
        closeButton: "border border-default bg-surface text-muted",
        ...toastOptions?.classNames
      }
    }}
    {...props}
  />
);

export { Toaster };
export { toast };
export type { ToasterProps };
