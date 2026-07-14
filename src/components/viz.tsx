import { FormResult } from "@/lib/types";
import { pct } from "@/lib/model/odds";

/**
 * Segmented 1X2 probability bar. Home = blue, Draw = yellow, Away = red, with a
 * 2px surface gap between segments (mark-spec "surface gap", not a stroke).
 */
export function ProbBar({
  home,
  draw,
  away,
  labels = true,
}: {
  home: number;
  draw: number;
  away: number;
  labels?: boolean;
}) {
  const seg = (p: number, color: string) => ({
    flex: `${Math.max(p, 0.001)} 0 0`,
    background: color,
  });
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div style={seg(home, "var(--color-s1)")} />
        <div className="w-[2px] shrink-0 bg-surface" />
        <div style={seg(draw, "var(--color-s3)")} />
        <div className="w-[2px] shrink-0 bg-surface" />
        <div style={seg(away, "var(--color-s6)")} />
      </div>
      {labels && (
        <div className="mt-1 flex justify-between text-[11px] tabnum text-ink-2">
          <span>
            <Dot color="var(--color-s1)" /> {pct(home, 0)}
          </span>
          <span>
            <Dot color="var(--color-s3)" /> {pct(draw, 0)}
          </span>
          <span>
            {pct(away, 0)} <Dot color="var(--color-s6)" />
          </span>
        </div>
      )}
    </div>
  );
}

/** A single two-part meter for a binary market (e.g. Over vs Under). */
export function SplitMeter({
  left,
  right,
  leftColor = "var(--color-s2)",
  rightColor = "var(--color-line-2)",
}: {
  left: number;
  right: number;
  leftColor?: string;
  rightColor?: string;
}) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div style={{ flex: `${Math.max(left, 0.001)} 0 0`, background: leftColor }} />
      <div className="w-[2px] shrink-0 bg-surface" />
      <div style={{ flex: `${Math.max(right, 0.001)} 0 0`, background: rightColor }} />
    </div>
  );
}

export function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full align-middle"
      style={{ background: color }}
      aria-hidden
    />
  );
}

/** Recent form as W/D/L pips, most-recent first. */
export function FormPips({ form }: { form: FormResult[] }) {
  const color: Record<FormResult, string> = {
    W: "var(--color-good)",
    D: "var(--color-warn)",
    L: "var(--color-crit)",
  };
  const ink: Record<FormResult, string> = {
    W: "#071a10",
    D: "#1a1204",
    L: "#1a0605",
  };
  if (form.length === 0) return <span className="text-xs text-muted">—</span>;
  return (
    <div className="flex gap-1">
      {form.map((r, i) => (
        <span
          key={i}
          className="grid h-[18px] w-[18px] place-items-center rounded text-[10px] font-bold"
          style={{ background: color[r], color: ink[r] }}
          title={r}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

/** EV badge — greener and stronger the bigger the edge. */
export function ValueBadge({ ev }: { ev: number }) {
  const strong = ev >= 0.08;
  const tone = ev >= 0.02 ? "good" : "muted";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tabnum"
      style={
        tone === "good"
          ? {
              background: `color-mix(in srgb, var(--color-good) ${strong ? 26 : 15}%, transparent)`,
              borderColor: "color-mix(in srgb, var(--color-good) 40%, transparent)",
              color: "var(--color-good)",
            }
          : {
              background: "var(--color-surface-2)",
              borderColor: "var(--color-line-2)",
              color: "var(--color-muted)",
            }
      }
    >
      {ev >= 0 ? "+" : ""}
      {(ev * 100).toFixed(1)}%
    </span>
  );
}

/** Horizontal strength bar centred on the league average (1.0). */
export function StrengthBar({ value, kind }: { value: number; kind: "attack" | "defense" }) {
  // attack: higher is better (green). defense: higher means leakier (red).
  const good = kind === "attack" ? value >= 1 : value <= 1;
  const color = good ? "var(--color-good)" : "var(--color-serious)";
  const width = Math.min(100, Math.abs(value - 1) * 120 + 6);
  const fromLeft = value >= 1;
  return (
    <div className="relative h-2 w-full rounded-full bg-surface-2">
      <div className="absolute left-1/2 top-0 h-full w-px bg-line-2" />
      <div
        className="absolute top-0 h-full rounded-full"
        style={{
          width: `${width / 2}%`,
          background: color,
          left: fromLeft ? "50%" : undefined,
          right: fromLeft ? undefined : "50%",
        }}
      />
    </div>
  );
}
