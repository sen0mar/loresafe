import { useEffect, useRef } from "react";

import heroAvif960 from "../assets/loresafe-landing-hero-960.avif";
import heroAvif1280 from "../assets/loresafe-landing-hero-1280.avif";
import heroAvif1672 from "../assets/loresafe-landing-hero-1672.avif";
import heroImage from "../assets/loresafe-landing-hero.png";
import heroWebp960 from "../assets/loresafe-landing-hero-960.webp";
import heroWebp1280 from "../assets/loresafe-landing-hero-1280.webp";
import heroWebp1672 from "../assets/loresafe-landing-hero-1672.webp";

const maxTiltDegrees = 4;
const heroAvifSrcSet = `${heroAvif960} 960w, ${heroAvif1280} 1280w, ${heroAvif1672} 1672w`;
const heroWebpSrcSet = `${heroWebp960} 960w, ${heroWebp1280} 1280w, ${heroWebp1672} 1672w`;
const heroImageSizes = "100vw";

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
      <picture className="block h-full w-full">
        <source
          type="image/avif"
          srcSet={heroAvifSrcSet}
          sizes={heroImageSizes}
        />
        <source
          type="image/webp"
          srcSet={heroWebpSrcSet}
          sizes={heroImageSizes}
        />
        <img
          ref={imageRef}
          src={heroImage}
          alt="LoreSafe spoiler-safe discussion dashboard preview"
          width="1672"
          height="941"
          fetchPriority="high"
          className="pointer-events-none h-full w-full origin-center object-cover object-center opacity-95 transition-transform duration-150 ease-out will-change-transform motion-reduce:transition-none"
        />
      </picture>
    </div>
  );
};
