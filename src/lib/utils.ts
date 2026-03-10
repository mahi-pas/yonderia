import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import { nanoid } from "nanoid";

type DateValue = Date | string;

function toDate(value: DateValue): Date {
  const parsed = value instanceof Date ? value : parseISO(value);

  if (!isValid(parsed)) {
    throw new Error("Invalid date value received.");
  }

  return parsed;
}

export function formatShortDate(value: DateValue): string {
  return format(toDate(value), "MMM d, yyyy");
}

export function formatDateTime(value: DateValue): string {
  return format(toDate(value), "MMM d, yyyy h:mm a");
}

export function formatDayLabel(value: DateValue): string {
  return format(toDate(value), "EEE, MMM d");
}

export function formatRelativeDate(value: DateValue): string {
  return formatDistanceToNow(toDate(value), { addSuffix: true });
}

export function formatTripDateRange(startDate: DateValue, endDate: DateValue): string {
  return [formatShortDate(startDate), formatShortDate(endDate)].join(" - ");
}

export function generateInviteCode(): string {
  return nanoid(10);
}
