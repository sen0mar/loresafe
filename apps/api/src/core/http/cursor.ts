import { z } from "zod";

import { HttpError } from "../errors/http-error.js";

const timestampUuidCursorSchema = z
  .object({
    createdAt: z.iso.datetime({ offset: true }),
    id: z.uuid()
  })
  .strict();

const boundedOffsetCursorSchema = (maximumOffset: number) =>
  z
    .object({
      offset: z.number().int().safe().min(0).max(maximumOffset)
    })
    .strict();

export type TimestampUuidCursor = {
  createdAt: Date;
  id: string;
};

export const encodeTimestampUuidCursor = ({
  createdAt,
  id
}: TimestampUuidCursor) =>
  encodeCursor({ createdAt: createdAt.toISOString(), id });

export const decodeTimestampUuidCursor = (
  cursor: string | undefined
): TimestampUuidCursor | null => {
  if (!cursor) {
    return null;
  }

  const parsed = parseCursor(cursor, timestampUuidCursorSchema);

  return {
    createdAt: new Date(parsed.createdAt),
    id: parsed.id
  };
};

export const encodeBoundedOffsetCursor = (offset: number) =>
  encodeCursor({ offset });

export const decodeBoundedOffsetCursor = (
  cursor: string | undefined,
  maximumOffset: number
) => {
  if (!cursor) {
    return null;
  }

  return parseCursor(cursor, boundedOffsetCursorSchema(maximumOffset));
};

const encodeCursor = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const parseCursor = <TSchema extends z.ZodType>(
  cursor: string,
  schema: TSchema
): z.infer<TSchema> => {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    return schema.parse(JSON.parse(json) as unknown);
  } catch {
    throw new HttpError(
      400,
      "BAD_REQUEST",
      "Check the pagination cursor and try again."
    );
  }
};
