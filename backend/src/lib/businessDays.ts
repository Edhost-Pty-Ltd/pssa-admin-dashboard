/** Africa/Johannesburg calendar helpers for complaint service times (weekends skipped; public holidays not yet). */

function johannesburgYmd(date: Date) {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .split("-")
    .map(Number);
  return { year, month, day };
}

function utcNoonFromYmd(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 10, 0, 0));
}

function weekdayInJohannesburg(date: Date) {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Johannesburg",
    weekday: "short",
  }).format(date);
  return label;
}

function isWeekend(date: Date) {
  const day = weekdayInJohannesburg(date);
  return day === "Sat" || day === "Sun";
}

/** Add N business days from `from` in Africa/Johannesburg (Sat/Sun skipped). */
export function addBusinessDays(from: Date, days: number) {
  let { year, month, day } = johannesburgYmd(from);
  let remaining = days;
  let cursor = utcNoonFromYmd(year, month, day);

  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    if (!isWeekend(cursor)) remaining -= 1;
  }
  return cursor;
}
