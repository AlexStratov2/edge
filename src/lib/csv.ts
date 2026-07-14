// Minimal, dependency-free CSV parser tuned for Football-Data.co.uk files.
// Handles a UTF-8 BOM, quoted fields and empty trailing values.

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const clean = text.replace(/^﻿/, "");
  const lines = splitLines(clean);
  if (lines.length === 0) return [];
  const header = splitLine(lines[0]);
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const cells = splitLine(line);
    const row: CsvRow = {};
    for (let c = 0; c < header.length; c++) {
      row[header[c]] = (cells[c] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;
}

function splitLines(text: string): string[] {
  return text.split(/\r\n|\n|\r/);
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Parse a number, returning undefined for blanks / non-numeric cells. */
export function num(v: string | undefined): number | undefined {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Football-Data dates are dd/mm/yy or dd/mm/yyyy. */
export function parseFdDate(v: string | undefined): Date | undefined {
  if (!v) return undefined;
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  const d = new Date(Date.UTC(year, month, day));
  return Number.isNaN(d.getTime()) ? undefined : d;
}
