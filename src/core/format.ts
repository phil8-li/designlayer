/**
 * The one formatter for each number and date shape the UI prints.
 *
 * Counts: plain under 1,000, grouped up to 9,999, compact past that ("12.3K").
 * Dates: "Sep 25", with the year only once it is more than a year old.
 * Fixed to en-US because every other word around these numbers is English.
 */

const grouped = new Intl.NumberFormat("en-US")
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
const monthDayYear = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

/** `999`, `1,234`, `12.3K`. */
export function formatCount(count: number): string {
  return Math.abs(count) < 10_000 ? grouped.format(count) : compact.format(count)
}

/** `1 note`, `3 notes`, `1,234 notes`. `many` defaults to `one` plus "s". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`
}

/** `Sep 25`, or `Sep 25, 2025` for a date more than a year before `now`. */
export function formatDate(time: number | Date, now: number = Date.now()): string {
  const date = time instanceof Date ? time : new Date(time)
  return now - date.getTime() > YEAR_MS ? monthDayYear.format(date) : monthDay.format(date)
}
