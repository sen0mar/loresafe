import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LogIn, ShieldCheck, UserPlus } from "lucide-react";

import { BrandWordmark } from "@/shared/components/brand-wordmark";
import { Button } from "@/shared/components/ui/button";

import { LandingHeroVisual } from "../components/landing-hero-visual.js";

export const LandingPage = () => {
  const [isAtDetails, setIsAtDetails] = useState(false);

  useEffect(() => {
    const detailsElement = document.getElementById("landing-more");

    if (!detailsElement) {
      return;
    }

    const syncArrowDirection = () => {
      const detailsTop = detailsElement.getBoundingClientRect().top;
      const viewportMiddle = window.innerHeight * 0.55;

      setIsAtDetails(detailsTop <= viewportMiddle);
    };

    const IntersectionObserverConstructor = window.IntersectionObserver;

    if (typeof IntersectionObserverConstructor === "function") {
      const detailsObserver = new IntersectionObserverConstructor(
        ([entry]) => {
          setIsAtDetails(entry.isIntersecting);
        },
        {
          root: null,
          threshold: 0.18
        }
      );

      detailsObserver.observe(detailsElement);

      return () => detailsObserver.disconnect();
    }

    globalThis.addEventListener("scroll", syncArrowDirection, {
      passive: true
    });
    globalThis.addEventListener("resize", syncArrowDirection);

    return () => {
      globalThis.removeEventListener("scroll", syncArrowDirection);
      globalThis.removeEventListener("resize", syncArrowDirection);
    };
  }, []);

  const toggleLandingScroll = () => {
    const targetId = isAtDetails ? "landing-hero" : "landing-more";

    document
      .getElementById(targetId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    setIsAtDetails(!isAtDetails);
  };

  return (
    <main className="overflow-hidden bg-background text-primary">
      <section
        id="landing-hero"
        className="relative min-h-[calc(100svh-4rem)] overflow-hidden"
      >
        <LandingHeroVisual />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/90 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/80" />

        <div className="pointer-events-none relative z-10 flex min-h-[calc(100svh-4rem)] items-center px-5 py-12 sm:px-8 lg:px-12">
          <div className="pointer-events-auto w-full max-w-xl space-y-7 pt-10 sm:pt-0">
            <div className="inline-flex items-center gap-2 rounded-lg border border-brand bg-active px-3 py-2 text-sm font-medium text-brand">
              <ShieldCheck className="size-4" />
              Spoiler-safe clubs
            </div>
            <div className="space-y-5">
              <h1 className="max-w-lg text-5xl font-semibold tracking-normal text-primary sm:text-6xl lg:text-7xl">
                <BrandWordmark />
              </h1>
              <p className="max-w-lg text-base leading-7 text-secondary sm:text-lg sm:leading-8">
                Discuss books, shows, games, and courses without stumbling into
                spoilers. LoreSafe keeps every club conversation matched to
                where you are in the story.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/signup">
                  <UserPlus />
                  Create account
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/login">
                  <LogIn />
                  Log in
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      <section className="soft-section-divider relative z-10 flex justify-center bg-background px-5 py-4 sm:px-8 lg:px-12">
        <button
          type="button"
          aria-controls="landing-more"
          aria-label={
            isAtDetails
              ? "Scroll to landing page hero"
              : "Scroll to landing page details"
          }
          aria-pressed={isAtDetails}
          onClick={toggleLandingScroll}
          className="group inline-flex size-12 items-center justify-center text-brand transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ChevronDown
            className={`size-10 animate-bounce transition-transform duration-150 group-hover:translate-y-1 motion-reduce:animate-none ${
              isAtDetails ? "rotate-180" : ""
            }`}
            strokeWidth={1.8}
          />
        </button>
      </section>
      <div id="landing-more" className="scroll-mt-6">
        <section className="soft-section-divider relative z-10 bg-background px-5 py-10 sm:px-8 lg:px-12">
          <div className="max-w-5xl space-y-5">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl font-semibold tracking-normal text-primary">
                Spoiler-safe by design
              </h2>
              <p className="text-sm leading-6 text-muted">
                LoreSafe keeps club conversations matched to each member's
                progress across stories, series, games, courses, and custom
                timelines.
              </p>
            </div>
            <dl className="grid gap-3 md:grid-cols-2">
              {landingFaqItems.map((item) => (
                <div
                  key={item.question}
                  className="rounded-xl border border-default bg-surface p-4"
                >
                  <dt className="text-sm font-medium text-primary">
                    {item.question}
                  </dt>
                  <dd className="mt-2 text-sm leading-6 text-muted">
                    {item.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
        <LandingFooter />
      </div>
    </main>
  );
};

const copyrightYear = new Date().getFullYear();

const landingFooterLinks = [
  {
    label: "Explore clubs",
    to: "/clubs"
  },
  {
    label: "Create account",
    to: "/signup"
  },
  {
    label: "Log in",
    to: "/login"
  }
];

const LandingFooter = () => (
  <footer className="soft-section-divider relative z-10 bg-background px-5 py-5 sm:px-8 lg:px-12">
    <div className="grid w-full gap-4 text-xs text-muted sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-8">
      <section aria-labelledby="landing-footer-brand" className="space-y-1.5">
        <h2
          id="landing-footer-brand"
          className="text-sm font-semibold tracking-normal text-primary"
        >
          <BrandWordmark />
        </h2>
        <p className="max-w-md leading-5">
          Spoiler-safe clubs for every point in the story.
        </p>
      </section>
      <nav
        aria-label="Footer navigation"
        className="flex flex-wrap justify-center gap-x-4 gap-y-2"
      >
        {landingFooterLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="text-faint sm:text-right">
        © {copyrightYear} <BrandWordmark />. All rights reserved.
      </p>
    </div>
  </footer>
);

const landingFaqItems = [
  {
    question: "How does LoreSafe prevent spoilers?",
    answer:
      "Posts and comments are tied to milestones, so members only unlock discussions that match their saved progress."
  },
  {
    question: "What kinds of stories can I create clubs for?",
    answer:
      "Clubs can organize books, shows, anime, games, courses, podcasts, films, or any custom story timeline."
  },
  {
    question: "What are milestones?",
    answer:
      "Milestones are ordered checkpoints like chapters, episodes, missions, timestamps, lessons, or custom beats."
  },
  {
    question: "What changes when progress updates?",
    answer:
      "LoreSafe refreshes what is safe for you and opens newly available conversations without exposing future content early."
  }
];
