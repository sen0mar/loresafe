import { useEffect, useRef } from "react";

import heroImage from "../assets/loresafe-landing-hero.png";

const maxTiltDegrees = 4;

const isReducedMotionPreferred = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const LandingHeroVisual = () => {
  const imageRef = useRef<HTMLImageElement>(null);
  const heroZoneRef = useRef<HTMLDivElement>(null);
  const isTiltedRef = useRef(false);

  const resetTilt = () => {
    const image = imageRef.current;

    if (!image) {
      return;
    }

    image.style.transform = "perspective(1400px) rotateX(0deg) rotateY(0deg)";
    isTiltedRef.current = false;
  };

  useEffect(() => {
    const updateTilt = (event: PointerEvent) => {
      const image = imageRef.current;
      const heroZone = heroZoneRef.current;

      if (!image || !heroZone || isReducedMotionPreferred()) {
        resetTilt();
        return;
      }

      const bounds = heroZone.getBoundingClientRect();
      const isInsideHero =
        bounds.width > 0 &&
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;

      if (!isInsideHero) {
        if (isTiltedRef.current) {
          resetTilt();
        }

        return;
      }

      const cursorX = (event.clientX - bounds.left) / bounds.width - 0.5;
      const cursorY = (event.clientY - bounds.top) / bounds.height - 0.5;
      const rotateX = cursorY * -maxTiltDegrees;
      const rotateY = cursorX * maxTiltDegrees;

      image.style.transform = [
        "perspective(1400px)",
        `rotateX(${rotateX.toFixed(2)}deg)`,
        `rotateY(${rotateY.toFixed(2)}deg)`,
        "translateY(-0.35rem)",
        "scale(1.015)"
      ].join(" ");
      isTiltedRef.current = true;
    };

    window.addEventListener("blur", resetTilt);
    window.addEventListener("pointermove", updateTilt);

    return () => {
      window.removeEventListener("blur", resetTilt);
      window.removeEventListener("pointermove", updateTilt);
    };
  }, []);

  return (
    <div
      ref={heroZoneRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <img
        ref={imageRef}
        src={heroImage}
        alt="LoreSafe spoiler-safe discussion dashboard preview"
        className="pointer-events-none h-full w-full origin-center object-cover object-center opacity-95 transition-transform duration-150 ease-out will-change-transform motion-reduce:transition-none"
      />
    </div>
  );
};
