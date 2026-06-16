type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
};

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

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

export const apiGet = async <TResponse,>(
  path: string
): Promise<TResponse> => {
  return apiRequest<TResponse>(path, {
    method: "GET"
  });
};

export const apiPost = async <TResponse, TBody = unknown>(
  path: string,
  body?: TBody
): Promise<TResponse> => {
  return apiRequest<TResponse>(path, {
    method: "POST",
    body
  });
};

export const apiPatch = async <TResponse, TBody = unknown>(
  path: string,
  body?: TBody
): Promise<TResponse> => {
  return apiRequest<TResponse>(path, {
    method: "PATCH",
    body
  });
};

const apiRequest = async <TResponse,>(
  path: string,
  options: {
    method: "GET" | "PATCH" | "POST";
    body?: unknown;
  }
): Promise<TResponse> => {
  let response: Response;
  const hasBody = options.body !== undefined;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method,
      // Required so the browser accepts and sends the HttpOnly session cookie.
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {})
      },
      body: hasBody ? JSON.stringify(options.body) : undefined
    });
  } catch (error) {
    throw new ApiError(
      "Could not reach the ThreadSync API. Check that the API server is running.",
      { cause: error }
    );
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

const isApiErrorResponse = (
  payload: unknown
): payload is ApiErrorResponse => {
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
