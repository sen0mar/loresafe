export type ApiErrorCode =
  | "BAD_REQUEST"
  | "CONFLICT"
  | "INTERNAL_SERVER_ERROR"
  | "NOT_FOUND"
  | "TOO_MANY_REQUESTS";

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;

  constructor(statusCode: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
