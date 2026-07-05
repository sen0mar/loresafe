import * as TabsPrimitive from "@radix-ui/react-tabs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type * as React from "react";

import {
  LiquidSelectionIndicator,
  useLiquidSelection
} from "@/shared/components/ui/liquid-selection";
import { cn } from "@/shared/lib/utils";

type TabsMotionContextValue = {
  activeValue?: string;
};

const TabsMotionContext = createContext<TabsMotionContextValue | null>(null);

const Tabs = ({
  className,
  defaultValue,
  onValueChange,
  value,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeValue = value ?? internalValue;

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  const handleValueChange = useCallback(
    (nextValue: string) => {
      setInternalValue(nextValue);
      onValueChange?.(nextValue);
    },
    [onValueChange]
  );

  const motionContext = useMemo(
    () => ({
      activeValue
    }),
    [activeValue]
  );

  return (
    <TabsMotionContext.Provider value={motionContext}>
      <TabsPrimitive.Root
        data-slot="tabs"
        className={cn("flex flex-col gap-3", className)}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        value={value}
        {...props}
      />
    </TabsMotionContext.Provider>
  );
};

const TabsList = ({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) => {
  const motionContext = useContext(TabsMotionContext);
  const liquidSelection = useLiquidSelection<HTMLDivElement>(
    motionContext?.activeValue
  );

  return (
    <TabsPrimitive.List
      ref={liquidSelection.groupRef}
      data-slot="tabs-list"
      className={cn(
        "liquid-selection-surface relative isolate inline-flex min-h-10 max-w-full flex-wrap items-center justify-start gap-1 overflow-hidden rounded-lg border border-default bg-inset p-1 text-muted",
        className
      )}
      {...props}
    >
      <LiquidSelectionIndicator
        indicatorStyle={liquidSelection.indicatorStyle}
        isVisible={liquidSelection.isIndicatorVisible}
        settleAnimationKey={liquidSelection.settleAnimationKey}
        shouldPlaySettleAnimation={liquidSelection.shouldPlaySettleAnimation}
      />
      {props.children}
    </TabsPrimitive.List>
  );
};

const TabsTrigger = ({
  className,
  value,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger
    data-liquid-selection-item
    data-liquid-selection-value={value}
    data-slot="tabs-trigger"
    className={cn(
      "relative z-10 inline-flex h-8 min-w-0 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium text-muted transition-[background-color,color,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-60 data-[state=active]:text-brand data-[state=inactive]:hover:bg-active data-[state=inactive]:hover:text-primary",
      className
    )}
    value={value}
    {...props}
  />
);

const TabsContent = ({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content
    data-slot="tabs-content"
    className={cn("outline-none", className)}
    {...props}
  />
);

export { Tabs, TabsContent, TabsList, TabsTrigger };
