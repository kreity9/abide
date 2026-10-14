// Local-calendar date helpers. Days are keyed "YYYY-MM-DD" in the browser's own
// timezone, and parsed at local noon so DST shifts never move a day.

const pad = (n) => String(n).padStart(2, "0");

export function key(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today() {
  return key(new Date());
}

export function parse(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function isKey(k) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k || "")) return false;
  return key(parse(k)) === k;
}

export function addDays(k, n) {
  const d = parse(k);
  d.setDate(d.getDate() + n);
  return key(d);
}

export function diffDays(a, b) {
  return Math.round((parse(b) - parse(a)) / 86400000);
}

export function weekStart(k, startsOn = 0) {
  const d = parse(k);
  return addDays(k, -((d.getDay() - startsOn + 7) % 7));
}

export function weekDays(k, startsOn = 0) {
  const s = weekStart(k, startsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

export function monthKey(k) {
  return k.slice(0, 7);
}

export function addMonths(mk, n) {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1, 12);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** 6-row calendar grid for a "YYYY-MM" month: [{key, inMonth}] */
export function monthGrid(mk, startsOn = 0) {
  const first = `${mk}-01`;
  const start = weekStart(first, startsOn);
  return Array.from({ length: 42 }, (_, i) => {
    const k = addDays(start, i);
    return { key: k, inMonth: monthKey(k) === mk };
  });
}

export function daysInMonth(mk) {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

const fmt = (opts) => new Intl.DateTimeFormat(undefined, opts);
export const fmtLong = (k) => fmt({ weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(parse(k));
export const fmtDate = (k) => fmt({ month: "long", day: "numeric", year: "numeric" }).format(parse(k));
export const fmtShort = (k) => fmt({ weekday: "short", month: "short", day: "numeric" }).format(parse(k));
export const fmtWeekday = (k) => fmt({ weekday: "long" }).format(parse(k));
export const fmtDow = (k) => fmt({ weekday: "short" }).format(parse(k));
export const fmtMonth = (mk) => fmt({ month: "long", year: "numeric" }).format(parse(`${mk}-01`));

export function greeting(hour = new Date().getHours()) {
  if (hour < 5) return "Peace be with you";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Whole days since 1970-01-01 for a key; stable across timezones. */
export function dayNumber(k) {
  const [y, m, d] = k.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function relativeLabel(k, now = today()) {
  const n = diffDays(now, k);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  return n > 0 ? `In ${n} days` : `${-n} days ago`;
}
