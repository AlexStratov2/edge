// Football-Data.co.uk source: free historical match CSVs (results + stats +
// multi-bookmaker odds) and a global upcoming-fixtures file with odds.
// No API key required. https://www.football-data.co.uk/

import { CsvRow, num, parseCsv, parseFdDate } from "@/lib/csv";
import { fetchTextCached } from "@/lib/cache";
import { Fixture, Match, Result } from "@/lib/types";

const BASE = "https://www.football-data.co.uk";
const HISTORY_TTL = 6 * 60 * 60 * 1000; // 6h
const FIXTURES_TTL = 60 * 60 * 1000; // 1h

/** Prefer market-average odds, fall back to Bet365, then a couple of others. */
function pickOdds(row: CsvRow, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = num(row[k]);
    if (v && v > 1) return v;
  }
  return undefined;
}

function rowToMatch(row: CsvRow, div: string): Match | null {
  const date = parseFdDate(row["Date"]);
  const home = row["HomeTeam"];
  const away = row["AwayTeam"];
  const fthg = num(row["FTHG"]);
  const ftag = num(row["FTAG"]);
  const ftr = row["FTR"] as Result;
  if (!date || !home || !away || fthg === undefined || ftag === undefined) return null;
  if (ftr !== "H" && ftr !== "D" && ftr !== "A") return null;

  return {
    div,
    date,
    homeTeam: home,
    awayTeam: away,
    fthg,
    ftag,
    ftr,
    hthg: num(row["HTHG"]),
    htag: num(row["HTAG"]),
    hs: num(row["HS"]),
    as: num(row["AS"]),
    hst: num(row["HST"]),
    ast: num(row["AST"]),
    hc: num(row["HC"]),
    ac: num(row["AC"]),
    hy: num(row["HY"]),
    ay: num(row["AY"]),
    hr: num(row["HR"]),
    ar: num(row["AR"]),
    referee: row["Referee"] || undefined,
    oddsH: pickOdds(row, ["AvgH", "B365H", "PSH", "BWH"]),
    oddsD: pickOdds(row, ["AvgD", "B365D", "PSD", "BWD"]),
    oddsA: pickOdds(row, ["AvgA", "B365A", "PSA", "BWA"]),
    over25: pickOdds(row, ["Avg>2.5", "B365>2.5", "P>2.5"]),
    under25: pickOdds(row, ["Avg<2.5", "B365<2.5", "P<2.5"]),
  };
}

/** Load all matches for a division across the given season codes. */
export async function loadMatches(div: string, seasons: string[]): Promise<Match[]> {
  const all: Match[] = [];
  for (const season of seasons) {
    const url = `${BASE}/mmz4281/${season}/${div}.csv`;
    let text: string;
    try {
      text = await fetchTextCached(url, { ttlMs: HISTORY_TTL });
    } catch {
      continue; // season not published yet -> skip
    }
    const rows = parseCsv(text);
    for (const row of rows) {
      const m = rowToMatch(row, div);
      if (m) all.push(m);
    }
  }
  all.sort((a, b) => a.date.getTime() - b.date.getTime());
  return all;
}

function rowToFixture(row: CsvRow): Fixture | null {
  const date = parseFdDate(row["Date"]);
  const home = row["HomeTeam"];
  const away = row["AwayTeam"];
  const div = row["Div"];
  if (!date || !home || !away || !div) return null;
  return {
    div,
    date,
    time: row["Time"] || undefined,
    homeTeam: home,
    awayTeam: away,
    oddsH: pickOdds(row, ["AvgH", "B365H", "PSH", "BWH"]),
    oddsD: pickOdds(row, ["AvgD", "B365D", "PSD", "BWD"]),
    oddsA: pickOdds(row, ["AvgA", "B365A", "PSA", "BWA"]),
    over25: pickOdds(row, ["Avg>2.5", "B365>2.5", "P>2.5"]),
    under25: pickOdds(row, ["Avg<2.5", "B365<2.5", "P<2.5"]),
    ahLine: num(row["AHh"]) ?? num(row["AHCh"]),
  };
}

/** Load the global upcoming-fixtures file (all leagues, with pre-match odds). */
export async function loadFixtures(): Promise<Fixture[]> {
  const url = `${BASE}/fixtures.csv`;
  let text: string;
  try {
    text = await fetchTextCached(url, { ttlMs: FIXTURES_TTL });
  } catch {
    return [];
  }
  const rows = parseCsv(text);
  const out: Fixture[] = [];
  for (const row of rows) {
    const f = rowToFixture(row);
    if (f) out.push(f);
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime());
  return out;
}
