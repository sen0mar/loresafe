export type ApiErrorCode =
  | "BAD_REQUEST"
  | "CONFLICT"
  | "FORBIDDEN"
  | "INTERNAL_SERVER_ERROR"
  | "INVITE_EXPIRED"
  | "INVITE_MAXED"
  | "INVITE_REVOKED"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
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
