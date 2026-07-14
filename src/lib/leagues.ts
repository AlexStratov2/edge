// League configuration. `code` is the Football-Data.co.uk division code.
// `country` matches ClubElo's country code for cross-referencing Elo ratings.

export interface LeagueConfig {
  code: string; // Football-Data division code (E0, SP1, ...)
  name: string;
  country: string; // display country
  eloCountry?: string; // ClubElo ISO-ish country code
  tier: 1 | 2;
  short: string; // 2-letter badge label (renders everywhere, unlike flag emoji)
  accent: string; // hex accent used in the UI header/badge
}

export const LEAGUES: LeagueConfig[] = [
  { code: "E0", name: "Premier League", country: "England", eloCountry: "ENG", tier: 1, short: "EN", accent: "#3987e5" },
  { code: "SP1", name: "La Liga", country: "Spain", eloCountry: "ESP", tier: 1, short: "ES", accent: "#eda100" },
  { code: "D1", name: "Bundesliga", country: "Germany", eloCountry: "GER", tier: 1, short: "DE", accent: "#e34948" },
  { code: "I1", name: "Serie A", country: "Italy", eloCountry: "ITA", tier: 1, short: "IT", accent: "#1baf7a" },
  { code: "F1", name: "Ligue 1", country: "France", eloCountry: "FRA", tier: 1, short: "FR", accent: "#9085e9" },
  { code: "E1", name: "Championship", country: "England", eloCountry: "ENG", tier: 2, short: "EN", accent: "#256abf" },
  { code: "N1", name: "Eredivisie", country: "Netherlands", eloCountry: "NED", tier: 2, short: "NL", accent: "#eb6834" },
  { code: "P1", name: "Primeira Liga", country: "Portugal", eloCountry: "POR", tier: 2, short: "PT", accent: "#008300" },
  { code: "B1", name: "Jupiler Pro League", country: "Belgium", eloCountry: "BEL", tier: 2, short: "BE", accent: "#e87ba4" },
  { code: "SP2", name: "La Liga 2", country: "Spain", eloCountry: "ESP", tier: 2, short: "E2", accent: "#c98500" },
];

export const LEAGUE_BY_CODE = new Map(LEAGUES.map((l) => [l.code, l]));

export function leagueName(code: string): string {
  return LEAGUE_BY_CODE.get(code)?.name ?? code;
}

/**
 * Football-Data season codes to load. The newest is the "current" season for
 * tables; all are combined (recency-weighted) for model training.
 * Codes are auto-derived from the given date so the app follows the calendar.
 */
export function seasonCodes(now: Date): string[] {
  const y = now.getFullYear() % 100;
  const month = now.getMonth(); // 0-based
  // A new season starts in July (month index 6).
  const currentStart = month >= 6 ? y : y - 1;
  const code = (start: number) => `${pad(start)}${pad(start + 1)}`;
  return [code(currentStart), code(currentStart - 1), code(currentStart - 2)];
}

function pad(n: number): string {
  const v = ((n % 100) + 100) % 100;
  return v.toString().padStart(2, "0");
}

/** Human label for a season code like "2526" -> "2025/26". */
export function seasonLabel(code: string): string {
  const a = code.slice(0, 2);
  const b = code.slice(2, 4);
  return `20${a}/${b}`;
}
