import { z } from "zod";

export const maximumPageNumber = 100;

export const boundedPageSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(maximumPageNumber)
  .default(1);

export const getBoundedPageOffset = (page: number, limit: number) => {
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > maximumPageNumber ||
    !Number.isSafeInteger(limit) ||
    limit < 1
  ) {
    throw new RangeError("Pagination values are outside the supported range.");
  }

  return (page - 1) * limit;
};
