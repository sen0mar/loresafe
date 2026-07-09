import logoMarkUrl from "@/shared/assets/loresafe-logo-mark.png";
import { cn } from "@/shared/lib/utils";

type BrandMarkProps = {
  className?: string;
  imageClassName?: string;
  isDecorative?: boolean;
};

export const BrandMark = ({
  className,
  imageClassName,
  isDecorative = false
}: BrandMarkProps) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center justify-center overflow-hidden",
      className
    )}
  >
    <img
      src={logoMarkUrl}
      alt={isDecorative ? "" : "LoreSafe"}
      aria-hidden={isDecorative ? true : undefined}
      className={cn("block h-full w-full object-contain", imageClassName)}
      width="810"
      height="687"
    />
  </span>
);
