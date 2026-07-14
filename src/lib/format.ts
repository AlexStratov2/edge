// Small display helpers.

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(d: Date): string {
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function fmtKickoff(d: Date, time?: string): string {
  return time ? `${fmtDate(d)} · ${time}` : fmtDate(d);
}

export function odds(n: number | undefined): string {
  return n && n > 1 ? n.toFixed(2) : "—";
}

export function one(n: number): string {
  return n.toFixed(1);
}
