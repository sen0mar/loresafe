type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
};

// Cookie auth needs a first-party request path; Vite and Vercel proxy /api to Express.
const apiBaseUrl = "";

export class ApiError extends Error {
  readonly statusCode?: number;
  readonly code?: string;
  readonly requestId?: string;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      code?: string;
      requestId?: string;
      cause?: unknown;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.requestId = options.requestId;
  }
}

export const apiGet = async <TResponse>(
  path: string,
  options?: ApiRequestOptions
): Promise<TResponse> => {
  return apiRequest<TResponse>(path, {
    method: "GET",
    ...options
  });
};

export const apiPost = async <TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: ApiRequestOptions
): Promise<TResponse> => {
  return apiRequest<TResponse>(path, {
    method: "POST",
    body,
    ...options
  });
};

export const apiPatch = async <TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: ApiRequestOptions
): Promise<TResponse> => {
  return apiRequest<TResponse>(path, {
    method: "PATCH",
    body,
    ...options
  });
};

export const apiPut = async <TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: ApiRequestOptions
): Promise<TResponse> => {
  return apiRequest<TResponse>(path, {
    method: "PUT",
    body,
    ...options
  });
};

export const apiDelete = async <TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: ApiRequestOptions
): Promise<TResponse> => {
  return apiRequest<TResponse>(path, {
    method: "DELETE",
    body,
    ...options
  });
};

const apiRequest = async <TResponse>(
  path: string,
  options: {
    method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    timeoutMs?: number;
  },
  allowSessionRefresh = true
): Promise<TResponse> => {
  let response: Response;
  const hasBody = options.body !== undefined;
  const requestDeadline = createRequestDeadline(
    options.signal,
    options.timeoutMs ?? getDefaultTimeoutMs(options.method)
  );

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method,
      // Required so the browser accepts and sends the HttpOnly session cookie.
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: requestDeadline.signal
    });
  } catch (error) {
    if (requestDeadline.didTimeOut()) {
      throw new ApiError("The request timed out. Please try again.", {
        code: "REQUEST_TIMEOUT",
        cause: error
      });
    }

    if (options.signal?.aborted) {
      throw error;
    }

    throw new ApiError(
      "Could not reach the LoreSafe API. Check that the API server is running.",
      { cause: error }
    );
  } finally {
    requestDeadline.clear();
  }

  if (
    response.status === 401 &&
    allowSessionRefresh &&
    shouldAttemptSessionRefresh(path)
  ) {
    const refreshed = await refreshAccessSession(options.signal);

    if (refreshed) {
      return apiRequest<TResponse>(path, options, false);
    }
  }

  const payload = await readJson(response);

  if (!response.ok) {
    if (isApiErrorResponse(payload)) {
      throw new ApiError(payload.error.message, {
        statusCode: response.status,
        code: payload.error.code,
        requestId: payload.error.requestId
      });
    }

    throw new ApiError(`Request failed with status ${response.status}`, {
      statusCode: response.status
    });
  }

  return payload as TResponse;
};

let refreshRequest: Promise<boolean> | null = null;

const shouldAttemptSessionRefresh = (path: string) =>
  ![
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/refresh",
    "/api/auth/signup"
  ].includes(path);

const refreshAccessSession = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    return Promise.resolve(false);
  }

  refreshRequest ??= fetch(`${apiBaseUrl}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000)
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshRequest = null;
    });

  return refreshRequest;
};

type ApiRequestOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const defaultReadTimeoutMs = 15_000;
const defaultWriteTimeoutMs = 20_000;

const getDefaultTimeoutMs = (
  method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT"
) => (method === "GET" ? defaultReadTimeoutMs : defaultWriteTimeoutMs);

const createRequestDeadline = (
  callerSignal: AbortSignal | undefined,
  timeoutMs: number
) => {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);

  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    clear: () => {
      clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    }
  };
};

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new ApiError("The API returned invalid JSON.", { cause: error });
  }
};

const isApiErrorResponse = (payload: unknown): payload is ApiErrorResponse => {
  if (!payload || typeof payload !== "object" || !("error" in payload)) {
    return false;
  }

  const error = (payload as { error: unknown }).error;

  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    typeof (error as { message: unknown }).message === "string"
  );
};
