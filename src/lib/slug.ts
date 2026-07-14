// URL-safe team slugs. Team names contain spaces and apostrophes (e.g.
// "Nott'm Forest") that make poor static-export file paths, so routes use a slug
// and resolve it back to the team name within the league.

// Combining diacritical marks U+0300–U+036F (written as ASCII escapes).
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "") // strip accents (é -> e)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
