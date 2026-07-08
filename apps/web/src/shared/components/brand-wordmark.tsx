import { cn } from "@/shared/lib/utils";

type BrandWordmarkProps = {
  className?: string;
};

export const BrandWordmark = ({ className }: BrandWordmarkProps) => (
  <span className={cn("tracking-normal", className)}>
    Lore<span className="text-[var(--accent-primary-active)]">S</span>
    <span className="text-[var(--accent-primary-active)]">afe</span>
  </span>
);
