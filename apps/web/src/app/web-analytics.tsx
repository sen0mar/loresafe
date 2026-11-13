import { Analytics, type BeforeSendEvent } from "@vercel/analytics/react";

const INVITE_PATH = /^\/invite\/[^/]+/;

// Page-view URLs must never carry secrets: reset/verify links put tokens in the
// query string and invite links put them in the path. Keep only the pathname
// and replace the invite token with a placeholder.
export const scrubAnalyticsEvent = (
  event: BeforeSendEvent
): BeforeSendEvent | null => {
  let url: URL;

  try {
    url = new URL(event.url);
  } catch {
    return null;
  }

  const pathname = url.pathname.replace(INVITE_PATH, "/invite/[token]");

  return { ...event, url: `${url.origin}${pathname}` };
};

// Production builds only: in dev the package loads a third-party debug script.
export const WebAnalytics = () =>
  import.meta.env.PROD ? <Analytics beforeSend={scrubAnalyticsEvent} /> : null;
