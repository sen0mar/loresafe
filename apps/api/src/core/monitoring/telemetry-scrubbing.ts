const sensitiveKeyPattern =
  /password|secret|token|cookie|authorization|credential|signature|signedurl|privateurl|http\.request\.body|x-amz-|x-goog-/i;

export const redactTelemetryString = (value: string): string => {
  let decoded = value;
  // SDK fields can contain encoded referrers or URLs inside another URL.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = decoded.replace(/(?:%[a-f0-9]{2})+/gi, (encoded) => {
      try {
        return decodeURIComponent(encoded);
      } catch {
        return encoded;
      }
    });
    if (next === decoded) break;
    decoded = next;
  }
  const redacted = decoded
    .replace(
      /https?:\/\/[^\s"'<>]*[?&](?:x-amz-|x-goog-|signature=)[^\s"'<>]*/gi,
      "[redacted-url]"
    )
    .replace(/(\/(?:api\/invites|invite)\/)[^/?#\s"'<>]+/gi, "$1:redacted")
    .replace(
      /((?:[?&#]|^)(?:[^=&?#\s]*?(?:token|password|secret|credential|signature)|x-amz-[^=&#\s]+|x-goog-[^=&#\s]+)=)[^&#\s"'<>]*/gi,
      "$1[redacted]"
    )
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[redacted-jwt]"
    );
  return redacted === decoded ? value : redacted;
};

// Copy the entire SDK payload: URL fields also occur in contexts, frames,
// exception messages, span attributes and nested breadcrumb arguments.
export const scrubTelemetry = <T>(payload: T): T => {
  const ancestors = new WeakSet<object>();
  const visit = (value: unknown, depth: number, parentKey = ""): unknown => {
    if (typeof value === "string") return redactTelemetryString(value);
    if (typeof value === "function" || typeof value === "symbol")
      return undefined;
    if (!value || typeof value !== "object") return value;
    if (depth > 20 || ancestors.has(value)) return "[omitted]";
    if (value instanceof URL) return redactTelemetryString(value.href);
    ancestors.add(value);
    const fields =
      value instanceof Error
        ? {
            ...value,
            name: value.name,
            message: value.message,
            stack: value.stack
          }
        : value;
    const result = Array.isArray(fields)
      ? fields.map((entry, index) =>
          index === 1 &&
          typeof fields[0] === "string" &&
          sensitiveKeyPattern.test(fields[0])
            ? "[redacted]"
            : visit(entry, depth + 1)
        )
      : Object.fromEntries(
          Object.entries(fields).map(([key, entry]) => [
            redactTelemetryString(key),
            sensitiveKeyPattern.test(key) ||
            (key === "data" && /^(request|normalizedRequest)$/i.test(parentKey))
              ? "[redacted]"
              : visit(entry, depth + 1, key)
          ])
        );
    ancestors.delete(value);
    return result;
  };
  return visit(payload, 0) as T;
};

export const telemetryPrivacyOptions = {
  beforeBreadcrumb: scrubTelemetry,
  beforeSend: scrubTelemetry,
  beforeSendTransaction: scrubTelemetry,
  beforeSendSpan: scrubTelemetry
};
