import type { ReactNode } from "react";
import { Check } from "lucide-react";

import {
  LiquidSelectionIndicator,
  useLiquidSelection
} from "@/shared/components/ui/liquid-selection";
import { cn } from "@/shared/lib/utils";

import type { ProgressMode } from "../api/clubs.types.js";

export type ReadingModeOption = {
  value: ProgressMode;
  label: string;
  description: string;
};

type ReadingModeSelectionProps = {
  disabled?: boolean;
  isOptionDisabled?: (mode: ProgressMode) => boolean;
  label: ReactNode;
  onSelect: (mode: ProgressMode) => void;
  options: ReadingModeOption[];
  selectedMode: ProgressMode;
};

export const ReadingModeSelection = ({
  disabled = false,
  isOptionDisabled,
  label,
  onSelect,
  options,
  selectedMode
}: ReadingModeSelectionProps) => {
  const selection = useLiquidSelection<HTMLDivElement>(selectedMode);

  return (
    <div ref={selection.groupRef} className="relative isolate grid gap-2">
      {label}
      <LiquidSelectionIndicator
        indicatorStyle={selection.indicatorStyle}
        isVisible={selection.isIndicatorVisible}
        motion="smooth"
        settleAnimationKey={selection.settleAnimationKey}
        shouldPlaySettleAnimation={selection.shouldPlaySettleAnimation}
      />
      {options.map((mode) => {
        const isSelected = selectedMode === mode.value;

        return (
          <button
            key={mode.value}
            data-active={isSelected ? "true" : "false"}
            data-liquid-selection-item
            data-liquid-selection-value={mode.value}
            type="button"
            className={cn(
              "relative z-10 rounded-lg border border-default px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60",
              isSelected
                ? "border-transparent text-brand hover:text-brand"
                : "bg-inset hover:border-strong hover:bg-active"
            )}
            disabled={disabled || isOptionDisabled?.(mode.value)}
            onClick={() => onSelect(mode.value)}
          >
            <span className="flex items-center justify-between gap-3">
              <span
                className={cn(
                  "text-sm font-medium",
                  isSelected ? "text-brand" : "text-primary"
                )}
              >
                {mode.label}
              </span>
              {isSelected ? <Check className="size-4 text-brand" /> : null}
            </span>
            <span className="mt-1 block text-xs leading-5 text-faint">
              {mode.description}
            </span>
          </button>
        );
      })}
    </div>
  );
};
