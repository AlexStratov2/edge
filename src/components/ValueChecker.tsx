"use client";

import { useState } from "react";
import type { SuggestedPick } from "@/lib/model/build";
import { Pill } from "@/components/ui";
import { LeagueBadge } from "@/components/LeagueBadge";
import { fmtDate } from "@/lib/format";
import { pct } from "@/lib/model/odds";

/**
 * Our model gives the probability → "fair odds" = 1 / probability. The user
 * types the odds their own bookmaker offers, and we judge whether it's value
 * (positive expected value). This finds opportunities for any league — even ones
 * with no odds feed (Romania) — because the user supplies the price.
 */
export function ValueChecker({ picks }: { picks: SuggestedPick[] }) {
  const [odds, setOdds] = useState<Record<number, string>>({});

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="bg-surface-2 text-left text-[11px] tracked text-muted">
            <th className="px-3 py-2 font-medium">Match</th>
            <th className="px-3 py-2 font-medium">Our call</th>
            <th className="px-2 py-2 text-right font-medium">Our chance</th>
            <th className="px-2 py-2 text-right font-medium">Fair odds</th>
            <th className="px-2 py-2 text-center font-medium">Your bookie&apos;s odds</th>
            <th className="px-2 py-2 text-right font-medium">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {picks.slice(0, 30).map((p, i) => {
            const fair = 1 / p.prob;
            const raw = odds[i];
            const userOdds = raw ? Number(raw) : NaN;
            const valid = Number.isFinite(userOdds) && userOdds > 1;
            const ev = valid ? p.prob * userOdds - 1 : null;
            return (
              <tr key={i} className="border-t border-line bg-surface">
                <td className="px-3 py-2.5">
                  <div className="font-medium">{p.home} v {p.away}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted">
                    <LeagueBadge code={p.code} size="sm" /> {p.league} · {fmtDate(new Date(`${p.date}T12:00:00Z`))}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <Pill tone="info">{p.market}</Pill>
                </td>
                <td className="px-2 py-2.5 text-right tabnum text-ink-2">{pct(p.prob, 0)}</td>
                <td className="px-2 py-2.5 text-right tabnum font-semibold">{fair.toFixed(2)}</td>
                <td className="px-2 py-2.5 text-center">
                  <input
                    inputMode="decimal"
                    value={raw ?? ""}
                    onChange={(e) => setOdds((o) => ({ ...o, [i]: e.target.value }))}
                    placeholder="e.g. 1.80"
                    className="w-20 rounded-md border border-line-2 bg-surface-2 px-2 py-1 text-center text-sm tabnum outline-none focus:border-brand"
                  />
                </td>
                <td className="px-2 py-2.5 text-right">
                  {ev === null ? (
                    <span className="text-xs text-muted">—</span>
                  ) : ev >= 0.02 ? (
                    <Pill tone="good">value +{(ev * 100).toFixed(0)}%</Pill>
                  ) : ev >= 0 ? (
                    <Pill tone="warn">slim</Pill>
                  ) : (
                    <Pill tone="crit">no value</Pill>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
