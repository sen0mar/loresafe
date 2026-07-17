type LogLevel = "debug" | "error" | "info" | "warn";

type LogContext = Record<string, unknown>;

const sensitiveKeyPattern =
  /password|secret|token|cookie|authorization|jwt|credential|signed|private|hash|key/i;

export const logger = {
  debug: (message: string, context?: LogContext) =>
    writeLog("debug", message, context),
  error: (message: string, context?: LogContext) =>
    writeLog("error", message, context),
  info: (message: string, context?: LogContext) =>
    writeLog("info", message, context),
  warn: (message: string, context?: LogContext) =>
    writeLog("warn", message, context)
};

export const sanitizeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: sanitizeString(error.message)
    };
  }

  return {
    name: "UnknownError",
    message: sanitizeString(String(error))
  };
};

export const sanitizePath = (path: string) =>
  path
    .split("/")
    .map((segment) => {
      if (!segment || segment.startsWith(":")) {
        return segment;
      }

      if (
        segment.length >= 24 ||
        /^[a-f0-9]{16,}$/i.test(segment) ||
        /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(segment)
      ) {
        return ":redacted";
      }

      return segment;
    })
    .join("/");

const writeLog = (
  level: LogLevel,
  message: string,
  context: LogContext = {}
) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitizeContext(context)
  };

  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
};

const sanitizeContext = (context: LogContext): LogContext =>
  Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      sanitizeValue(key, value)
    ])
  );

const sanitizeValue = (key: string, value: unknown): unknown => {
  if (sensitiveKeyPattern.test(key)) {
    return "[redacted]";
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }

  if (value && typeof value === "object") {
    return sanitizeContext(value as LogContext);
  }

  return value;
};

const sanitizeString = (value: string) =>
  value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(
      /https?:\/\/[^\s]+(?:X-Amz-Signature|X-Amz-Credential|token|signature)[^\s]*/gi,
      "[redacted-url]"
    )
    .replace(
      /[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[redacted-jwt]"
    );
