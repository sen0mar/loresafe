const countFormatter = new Intl.NumberFormat();
const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric"
});
const shortDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

export const formatCount = (value: number) => countFormatter.format(value);

export const formatShortDate = (value: string | Date) =>
  shortDateFormatter.format(
    typeof value === "string" ? new Date(value) : value
  );

export const formatShortDateTime = (value: string | Date) =>
  shortDateTimeFormatter.format(
    typeof value === "string" ? new Date(value) : value
  );
