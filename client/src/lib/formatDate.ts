import { format, formatDistanceToNow as fDistanceToNow, isToday, isYesterday } from "date-fns";

/**
 * Formats a date relative to now (e.g., "2h ago", "Yesterday", etc.)
 */
export function formatDistanceToNow(date: Date): string {
  if (isToday(date)) {
    // For today, show relative time (e.g., "2h ago", "Just now")
    return fDistanceToNow(date, { addSuffix: true });
  } else if (isYesterday(date)) {
    // For yesterday
    return "Yesterday";
  } else {
    // For older dates, show the date in MMM dd format (e.g., "Jun 28")
    return format(date, "MMM d");
  }
}

/**
 * Formats a date in full format (e.g., "June 28, 2023 at 2:30 PM")
 */
export function formatFullDate(date: Date): string {
  return format(date, "PPpp");
}
