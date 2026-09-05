import { BrowserClient, httpContextIntegration } from "@sentry/react";
import { describe, expect, it, vi } from "vitest";
import {
  telemetryPrivacyOptions,
  scrubTelemetry,
  redactTelemetryString
} from "./sentry-scrubbing";

const tokens = [
  "RESET_SENTINEL_112233",
  "VERIFY_SENTINEL_445566",
  "INVITE_SENTINEL_778899",
  "SIGNATURE_SENTINEL_112244",
  "CREDENTIAL_SENTINEL_335577"
];
const urls = [
  `/reset-password?token=${tokens[0]}&source=email`,
  `https://www.loresafe.org/verify-email?token=${tokens[1]}`,
  `/api/invites/${tokens[2]}/accept`,
  `https://bucket.example/private/spoiler.png?X-Amz-Signature=${tokens[3]}&X-Amz-Credential=${tokens[4]}`
];
const fixture = () => ({
  message: `Failed ${urls[0]}`,
  sdkProcessingMetadata: {
    normalizedRequest: {
      method: "POST",
      url: urls[0],
      headers: { referer: urls[1] },
      data: JSON.stringify({ token: tokens[0] })
    },
    dynamicSamplingContext: { transaction: urls[0] }
  },
  request: {
    url: urls[0],
    headers: { Referer: urls[1], Authorization: tokens[0] },
    query_string: `token=${tokens[1]}`,
    data: JSON.stringify({ token: tokens[0], password: tokens[1] })
  },
  transaction: urls[2],
  breadcrumbs: [
    {
      category: "navigation",
      data: { from: urls[0], to: urls[1], arguments: [{ nested: urls }] }
    }
  ],
  contexts: {
    trace: { data: { "http.url": urls[3], "http.request.referrer": urls[0] } }
  },
  spans: [
    {
      description: `GET ${urls[3]}`,
      data: { "url.full": urls[3], nested: urls }
    }
  ],
  exception: {
    values: [
      {
        value: urls[0],
        stacktrace: { frames: [{ filename: urls[1], abs_path: urls[3] }] }
      }
    ]
  },
  extra: {
    encoded: encodeURIComponent(encodeURIComponent(urls[0])),
    pairs: [
      ["token", tokens[0]],
      ["X-Amz-Signature", tokens[3]]
    ],
    query: { Token: tokens[0], "X-Amz-Signature": tokens[3] },
    [urls[0]!]: urls[2]
  },
  tags: { route: urls[1], safe: "diagnostic" }
});

const assertScrubbed = (payload: unknown) => {
  const serialized = JSON.stringify(payload);
  for (const token of tokens) expect(serialized).not.toContain(token);
  expect(serialized).not.toContain("private/spoiler.png");
};

describe("telemetry serialization privacy", () => {
  it("scrubs every nested event field without changing its input", () => {
    const input = fixture();
    const output = scrubTelemetry(input);
    assertScrubbed(output);
    expect(input.request.url).toContain(tokens[0]);
    expect(output.tags.safe).toBe("diagnostic");
    expect(output.request.url).toContain("source=email");
  });

  it.each([
    `?ToKeN=${tokens[0]}&token=${tokens[1]}`,
    `?%74oken=${tokens[0]}`,
    `?%74oken=${tokens[0]}&malformed=%zz`,
    `?access_token=${tokens[0]}`,
    `/invite/${tokens[2]}?source=email`,
    `?X-Amz-Signature=${tokens[3]}`,
    `token=${tokens[0]}`,
    `#token=${tokens[0]}`,
    `https://bucket.example/private/spoiler.png?X-Goog-Signature=${tokens[3]}`
  ])("removes URL credentials from %s", (input) =>
    assertScrubbed(redactTelemetryString(input))
  );

  it("preserves safe URLs and handles malformed encoding", () => {
    expect(redactTelemetryString("/app/clubs/book?tab=feed&page=2")).toBe(
      "/app/clubs/book?tab=feed&page=2"
    );
    assertScrubbed(redactTelemetryString(`?token=${tokens[0]}&bad=%zz`));
  });

  it("omits cycles and custom serializers, and scrubs Error and URL objects", () => {
    const input: Record<string, unknown> = {
      error: new Error(urls[0]),
      url: new URL(urls[1]!),
      custom: { toJSON: () => tokens[0] }
    };
    input.cycle = input;
    assertScrubbed(scrubTelemetry(input));
    expect(JSON.stringify(scrubTelemetry(input))).toContain("[omitted]");
  });
});

describe("installed SDK outbound envelopes", () => {
  it("scrubs error and transaction envelopes after SDK processing", async () => {
    window.history.replaceState(null, "", urls[0]);
    const referrer = vi
      .spyOn(document, "referrer", "get")
      .mockReturnValue(urls[1]!);
    const envelopes: unknown[] = [];
    const client = new BrowserClient({
      dsn: "https://synthetic@example.invalid/1",
      integrations: [httpContextIntegration()],
      tracesSampleRate: 1,
      stackParser: () => [],
      ...telemetryPrivacyOptions,
      transport: () => ({
        send: async (envelope) => {
          envelopes.push(envelope);
          return { statusCode: 200 };
        },
        flush: async () => true
      })
    });
    client.init();
    client.captureEvent({
      message: "Synthetic failure",
      extra: fixture(),
      sdkProcessingMetadata: fixture().sdkProcessingMetadata
    });
    client.captureEvent({
      type: "transaction",
      transaction: urls[0],
      start_timestamp: 1,
      timestamp: 2,
      contexts: {
        trace: {
          trace_id: "a".repeat(32),
          span_id: "b".repeat(16),
          data: fixture()
        }
      }
    });
    await client.flush(2000);
    expect(envelopes).toHaveLength(2);
    assertScrubbed(envelopes);
    expect(JSON.stringify(envelopes)).toContain("Synthetic failure");
    await client.close();
    referrer.mockRestore();
    window.history.replaceState(null, "", "/");
  });
});
