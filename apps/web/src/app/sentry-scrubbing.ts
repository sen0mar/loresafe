import type { Breadcrumb, Event } from "@sentry/react";

const inviteTokenPathPattern = /(\/(?:api\/invites|invite)\/)[^/?#\s]+/g;

export const redactInviteTokens = (value: string) =>
  value.replace(inviteTokenPathPattern, "$1:redacted");

const redactTelemetryData = <TelemetryData extends Breadcrumb["data"]>(
  data: TelemetryData
): TelemetryData => {
  if (!data) {
    return data;
  }

  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === "string" ? redactInviteTokens(value) : value
    ])
  ) as TelemetryData;
};

export const scrubSentryBreadcrumb = (breadcrumb: Breadcrumb): Breadcrumb => ({
  ...breadcrumb,
  message:
    typeof breadcrumb.message === "string"
      ? redactInviteTokens(breadcrumb.message)
      : breadcrumb.message,
  data: redactTelemetryData(breadcrumb.data)
});

export const scrubSentryEvent = <SentryEvent extends Event>(
  event: SentryEvent
): SentryEvent =>
  ({
    ...event,
    request: event.request
      ? {
          ...event.request,
          url:
            typeof event.request.url === "string"
              ? redactInviteTokens(event.request.url)
              : event.request.url
        }
      : event.request,
    transaction:
      typeof event.transaction === "string"
        ? redactInviteTokens(event.transaction)
        : event.transaction,
    breadcrumbs: event.breadcrumbs?.map(scrubSentryBreadcrumb),
    spans: event.spans?.map((span) => ({
      ...span,
      description:
        typeof span.description === "string"
          ? redactInviteTokens(span.description)
          : span.description,
      data: redactTelemetryData(span.data)
    }))
  }) as SentryEvent;
