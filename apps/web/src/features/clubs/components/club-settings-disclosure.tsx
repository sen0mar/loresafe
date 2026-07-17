import type { ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

type ClubSettingsDisclosureProps = {
  children: ReactNode;
  contentId: string;
  description: string;
  icon: LucideIcon;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
};

export const ClubSettingsDisclosure = ({
  children,
  contentId,
  description,
  icon: Icon,
  isOpen,
  onOpenChange,
  title
}: ClubSettingsDisclosureProps) => (
  <div className="overflow-hidden rounded-lg border border-default bg-inset">
    <button
      type="button"
      className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors duration-150 hover:bg-active focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-base"
      aria-controls={contentId}
      aria-expanded={isOpen}
      onClick={() => onOpenChange(!isOpen)}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium text-primary">
          <Icon className="size-4 text-brand" />
          {title}
        </span>
        <span className="mt-1 block text-sm leading-6 text-muted">
          {description}
        </span>
      </span>
      <ChevronDown
        className={cn(
          "size-5 shrink-0 text-faint transition-transform duration-150",
          isOpen && "rotate-180 text-brand"
        )}
        aria-hidden="true"
      />
    </button>

    <div
      id={contentId}
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
        isOpen ? "soft-section-divider grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
      aria-hidden={!isOpen}
      data-state={isOpen ? "open" : "closed"}
      inert={!isOpen}
    >
      <div
        className={cn(
          "min-h-0 overflow-hidden transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
          isOpen
            ? "translate-y-0 opacity-100 delay-75"
            : "-translate-y-1 opacity-0"
        )}
      >
        <div className="px-4 pb-4 pt-4">{children}</div>
      </div>
    </div>
  </div>
);
