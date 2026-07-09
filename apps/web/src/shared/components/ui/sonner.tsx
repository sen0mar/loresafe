import { toast, Toaster as Sonner, type ToasterProps } from "sonner";

const TOAST_DURATION_MS = 1600;
const MOBILE_TOAST_OFFSET = "0.75rem";

const Toaster = ({
  className,
  mobileOffset,
  toastOptions,
  ...props
}: ToasterProps & { className?: string }) => (
  <Sonner
    theme="dark"
    richColors={false}
    className={["loresafe-toaster", className]
      .filter(Boolean)
      .join(" ")}
    mobileOffset={mobileOffset ?? MOBILE_TOAST_OFFSET}
    toastOptions={{
      duration: TOAST_DURATION_MS,
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
