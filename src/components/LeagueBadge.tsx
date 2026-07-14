import { LEAGUE_BY_CODE } from "@/lib/leagues";

/**
 * A tinted country/league monogram chip. Replaces flag emoji (which do not
 * render on Windows) with a consistent, on-brand badge coloured by the league
 * accent. `code` is a Football-Data division code.
 */
export function LeagueBadge({
  code,
  size = "md",
}: {
  code: string;
  size?: "sm" | "md" | "lg";
}) {
  const cfg = LEAGUE_BY_CODE.get(code);
  const label = cfg?.short ?? code.slice(0, 2).toUpperCase();
  const accent = cfg?.accent ?? "var(--color-muted)";
  const dims =
    size === "lg"
      ? "h-9 w-9 text-[13px] rounded-lg"
      : size === "sm"
        ? "h-5 w-6 text-[10px] rounded"
        : "h-6 w-7 text-[11px] rounded-md";
  return (
    <span
      className={`inline-grid shrink-0 place-items-center font-bold tabnum ${dims}`}
      style={{
        color: accent,
        background: `color-mix(in srgb, ${accent} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${accent} 38%, transparent)`,
      }}
      title={cfg?.name ?? code}
      aria-label={cfg?.name ?? code}
    >
      {label}
    </span>
  );
}
