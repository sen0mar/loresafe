import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties
} from "react";

import { cn } from "@/shared/lib/utils";

type IndicatorRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type SelectionCacheEntry = {
  activeValue?: string;
  rect: IndicatorRect;
};

type LiquidSelectionOptions = {
  cacheKey?: string;
};

export type LiquidSelectionMotion = "drop" | "smooth";

const itemSelector = "[data-liquid-selection-item]";
const settleAnimationCleanupMs = 600;
const selectionRectCache = new Map<string, SelectionCacheEntry>();

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const areRectsEqual = (current: IndicatorRect, next: IndicatorRect) =>
  current.height === next.height &&
  current.width === next.width &&
  current.x === next.x &&
  current.y === next.y;

const getSelectionItems = (group: HTMLElement) =>
  Array.from(group.querySelectorAll<HTMLElement>(itemSelector));

const getActiveItem = (group: HTMLElement, activeValue?: string) => {
  const items = getSelectionItems(group);

  return (
    items.find((item) => item.dataset.liquidSelectionValue === activeValue) ??
    items.find((item) => item.dataset.state === "active") ??
    items.find((item) => item.dataset.active === "true") ??
    items.find((item) => item.getAttribute("aria-current") === "page") ??
    null
  );
};

const getIndicatorRect = (
  group: HTMLElement,
  activeItem: HTMLElement
): IndicatorRect => {
  const groupBounds = group.getBoundingClientRect();
  const itemBounds = activeItem.getBoundingClientRect();

  return {
    height: itemBounds.height,
    width: itemBounds.width,
    x: itemBounds.left - groupBounds.left,
    y: itemBounds.top - groupBounds.top
  };
};

const getIndicatorStyle = (indicatorRect: IndicatorRect | null) =>
  indicatorRect
    ? ({
        height: `${indicatorRect.height}px`,
        transform: `translate3d(${indicatorRect.x}px, ${indicatorRect.y}px, 0)`,
        width: `${indicatorRect.width}px`
      } satisfies CSSProperties)
    : undefined;

const getInitialCachedSelection = (
  activeValue?: string,
  cacheKey?: string
) => {
  if (!activeValue || !cacheKey) {
    return null;
  }

  return selectionRectCache.get(cacheKey) ?? null;
};

const requestMeasuredFrame = (callback: () => void) => {
  if (typeof window.requestAnimationFrame === "function") {
    const frameId = window.requestAnimationFrame(callback);

    return () => window.cancelAnimationFrame(frameId);
  }

  const timeoutId = window.setTimeout(callback, 16);

  return () => window.clearTimeout(timeoutId);
};

export const useLiquidSelection = <
  TElement extends HTMLElement = HTMLDivElement
>(
  activeValue?: string,
  options: LiquidSelectionOptions = {}
) => {
  const { cacheKey } = options;
  const initialCachedSelectionRef = useRef(
    getInitialCachedSelection(activeValue, cacheKey)
  );
  const groupRef = useRef<TElement | null>(null);
  const previousActiveValueRef = useRef(
    initialCachedSelectionRef.current?.activeValue ?? activeValue
  );
  const shouldDeferInitialMeasurementRef = useRef(
    Boolean(
      initialCachedSelectionRef.current &&
        initialCachedSelectionRef.current.activeValue !== activeValue
    )
  );
  const [settleAnimationKey, setSettleAnimationKey] = useState(0);
  const [shouldPlaySettleAnimation, setShouldPlaySettleAnimation] =
    useState(false);
  const [indicatorRect, setIndicatorRect] = useState<IndicatorRect | null>(
    initialCachedSelectionRef.current?.rect ?? null
  );

  const updateIndicatorRect = useCallback(() => {
    const group = groupRef.current;
    const activeItem = group ? getActiveItem(group, activeValue) : null;

    if (!group || !activeItem) {
      setIndicatorRect(null);
      return;
    }

    const nextRect = getIndicatorRect(group, activeItem);

    if (cacheKey) {
      selectionRectCache.set(cacheKey, {
        activeValue,
        rect: nextRect
      });
    }

    setIndicatorRect((currentRect) =>
      currentRect && areRectsEqual(currentRect, nextRect)
        ? currentRect
        : nextRect
    );
  }, [activeValue, cacheKey]);

  useEffect(() => {
    if (previousActiveValueRef.current === activeValue) {
      return;
    }

    previousActiveValueRef.current = activeValue;

    if (!activeValue) {
      return;
    }

    setShouldPlaySettleAnimation(true);
    setSettleAnimationKey((currentKey) => currentKey + 1);

    const settleTimeout = window.setTimeout(() => {
      setShouldPlaySettleAnimation(false);
    }, settleAnimationCleanupMs);

    return () => window.clearTimeout(settleTimeout);
  }, [activeValue]);

  useIsomorphicLayoutEffect(() => {
    if (
      shouldDeferInitialMeasurementRef.current &&
      typeof window !== "undefined"
    ) {
      shouldDeferInitialMeasurementRef.current = false;

      return requestMeasuredFrame(updateIndicatorRect);
    }

    updateIndicatorRect();
  }, [updateIndicatorRect]);

  useEffect(() => {
    const group = groupRef.current;

    if (!group || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateIndicatorRect);
    observer.observe(group);
    getSelectionItems(group).forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [updateIndicatorRect]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.addEventListener("resize", updateIndicatorRect);

    return () => window.removeEventListener("resize", updateIndicatorRect);
  }, [updateIndicatorRect]);

  return {
    groupRef,
    indicatorStyle: getIndicatorStyle(indicatorRect),
    isIndicatorVisible: Boolean(indicatorRect),
    settleAnimationKey,
    shouldPlaySettleAnimation
  };
};

type LiquidSelectionIndicatorProps = {
  className?: string;
  indicatorStyle?: CSSProperties;
  isVisible: boolean;
  motion?: LiquidSelectionMotion;
  settleAnimationKey: number;
  shouldPlaySettleAnimation: boolean;
};

export const LiquidSelectionIndicator = ({
  className,
  indicatorStyle,
  isVisible,
  motion = "drop",
  settleAnimationKey,
  shouldPlaySettleAnimation
}: LiquidSelectionIndicatorProps) => (
  <div
    aria-hidden="true"
    className={cn(
      "liquid-selection-indicator pointer-events-none absolute left-0 top-0 z-0 rounded-md transition-[height,opacity,transform,width] duration-300 motion-reduce:transition-none",
      className
    )}
    data-motion={motion}
    data-visible={isVisible ? "true" : "false"}
    style={indicatorStyle}
  >
    <span
      key={settleAnimationKey}
      className="liquid-selection-drop"
      data-settling={shouldPlaySettleAnimation ? "true" : "false"}
    >
      {shouldPlaySettleAnimation ? (
        <span className="liquid-selection-settle" />
      ) : null}
    </span>
  </div>
);
