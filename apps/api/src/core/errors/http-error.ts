export type ApiErrorCode =
  | "BAD_REQUEST"
  | "INTERNAL_SERVER_ERROR"
  | "NOT_FOUND";

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
