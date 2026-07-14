import { ReactNode } from "react";

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag
      className={`rounded-[var(--radius-card)] border border-line bg-surface ${className}`}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[13px] font-semibold tracking-wide text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent = "ink",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "ink" | "good" | "warn" | "crit" | "brand";
}) {
  const color =
    accent === "good"
      ? "text-good"
      : accent === "warn"
        ? "text-warn"
        : accent === "crit"
          ? "text-crit"
          : accent === "brand"
            ? "text-brand"
            : "text-ink";
  return (
    <Card className="p-4">
      <div className="text-[11px] tracked text-muted">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold tabnum ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-2">{sub}</div>}
    </Card>
  );
}

const PILL_TONES: Record<string, string> = {
  neutral: "var(--color-muted)",
  good: "var(--color-good)",
  warn: "var(--color-warn)",
  crit: "var(--color-crit)",
  info: "var(--color-s1)",
};

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "crit" | "info";
}) {
  const c = PILL_TONES[tone];
  const neutral = tone === "neutral";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabnum"
      style={{
        color: neutral ? "var(--color-ink-2)" : c,
        background: neutral
          ? "var(--color-surface-2)"
          : `color-mix(in srgb, ${c} 15%, transparent)`,
        borderColor: neutral
          ? "var(--color-line-2)"
          : `color-mix(in srgb, ${c} 35%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body: ReactNode }) {
  return (
    <Card className="p-8 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>
    </Card>
  );
}
