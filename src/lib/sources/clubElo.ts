// ClubElo source: free Elo ratings for clubs plus a global fixtures file with a
// pre-computed scoreline probability distribution. CSV API, no key.
// NOTE: ClubElo is HTTP-only (no HTTPS). http://api.clubelo.com/

import { CsvRow, num, parseCsv } from "@/lib/csv";
import { fetchTextCached } from "@/lib/cache";

const BASE = "http://api.clubelo.com";
const TTL = 12 * 60 * 60 * 1000; // 12h

export interface EloRating {
  club: string;
  country: string;
  elo: number;
}

/**
 * Current Elo ratings for every club on a given date (defaults to "today"
 * relative to the passed date). Returns a map keyed by a normalised club name.
 */
export async function loadEloRatings(now: Date): Promise<Map<string, EloRating>> {
  const iso = now.toISOString().slice(0, 10);
  const url = `${BASE}/${iso}`;
  const map = new Map<string, EloRating>();
  let text: string;
  try {
    text = await fetchTextCached(url, { ttlMs: TTL });
  } catch {
    return map;
  }
  const rows = parseCsv(text);
  for (const row of rows) {
    const club = row["Club"];
    const elo = num(row["Elo"]);
    if (!club || elo === undefined) continue;
    map.set(normaliseClub(club), { club, country: row["Country"] ?? "", elo });
  }
  return map;
}

export interface EloFixture {
  date: string;
  country: string;
  home: string;
  away: string;
  pHome: number;
  pDraw: number;
  pAway: number;
}

/** Upcoming fixtures with ClubElo's own 1X2 probabilities (from the GD split). */
export async function loadEloFixtures(): Promise<EloFixture[]> {
  const url = `${BASE}/Fixtures`;
  let text: string;
  try {
    text = await fetchTextCached(url, { ttlMs: 60 * 60 * 1000 });
  } catch {
    return [];
  }
  const rows = parseCsv(text);
  const out: EloFixture[] = [];
  for (const row of rows) {
    const f = eloRowToFixture(row);
    if (f) out.push(f);
  }
  return out;
}

function eloRowToFixture(row: CsvRow): EloFixture | null {
  const home = row["Home"];
  const away = row["Away"];
  if (!home || !away) return null;
  // Away win = goal difference < 0, draw = 0, home = > 0.
  const gdKeys = Object.keys(row).filter((k) => k.startsWith("GD"));
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (const k of gdKeys) {
    const p = num(row[k]) ?? 0;
    if (k === "GD=0") pDraw += p;
    else if (k.includes("=-") || k.includes("<-")) pAway += p;
    else pHome += p;
  }
  const total = pHome + pDraw + pAway;
  if (total <= 0) return null;
  return {
    date: row["Date"] ?? "",
    country: row["Country"] ?? "",
    home,
    away,
    pHome: pHome / total,
    pDraw: pDraw / total,
    pAway: pAway / total,
  };
}

/** Normalise a club name so ClubElo and Football-Data spellings line up better. */
export function normaliseClub(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(fc|cf|afc|sc|ac|as|ss|us|rc|1899|1846|1900|calcio)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}
