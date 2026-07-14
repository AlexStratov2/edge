"use client";

import { useEffect, useState } from "react";
import type { ReplayFixture, SplitStat } from "@/lib/model/build";
import { Card, Pill } from "@/components/ui";
import { ProbBar } from "@/components/viz";
import { LeagueBadge } from "@/components/LeagueBadge";

interface Record {
  bets: number;
  won: number;
  staked: number;
  profit: number;
}
const ZERO: Record = { bets: 0, won: 0, staked: 0, profit: 0 };
const STORE_KEY = "edge-replay-record";

interface Market {
  key: string;
  label: string;
  odds?: number;
  won: boolean;
  modelProb: number;
}

function marketsFor(f: ReplayFixture): Market[] {
  const m: Market[] = [
    { key: "H", label: "Home win", odds: f.odds.h, won: f.result.ftr === "H", modelProb: f.model.pHome },
    { key: "D", label: "Draw", odds: f.odds.d, won: f.result.ftr === "D", modelProb: f.model.pDraw },
    { key: "A", label: "Away win", odds: f.odds.a, won: f.result.ftr === "A", modelProb: f.model.pAway },
    { key: "O", label: "Over 2.5", odds: f.odds.over25, won: f.result.over25, modelProb: f.model.pOver25 },
    { key: "U", label: "Under 2.5", odds: f.odds.under25, won: !f.result.over25, modelProb: 1 - f.model.pOver25 },
  ];
  return m.filter((x) => x.odds && x.odds > 1);
}

export function ReplayGame({ fixtures }: { fixtures: ReplayFixture[] }) {
  const [mounted, setMounted] = useState(false);
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [record, setRecord] = useState<Record>(ZERO);

  useEffect(() => {
    setMounted(true);
    // shuffle a viewing order on the client (avoids SSR/hydration mismatch)
    const idx = fixtures.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    setOrder(idx);
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setRecord(JSON.parse(raw));
    } catch {}
  }, [fixtures]);

  if (!mounted || order.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted">Loading fixtures…</Card>;
  }
  if (fixtures.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted">No replay fixtures available.</Card>;
  }

  const f = fixtures[order[pos % order.length]];
  const markets = marketsFor(f);
  const picked = markets.find((m) => m.key === pick);

  const save = (r: Record) => {
    setRecord(r);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(r));
    } catch {}
  };

  const reveal = () => {
    if (revealed) return;
    if (picked) {
      const profit = picked.won ? picked.odds! - 1 : -1;
      save({
        bets: record.bets + 1,
        won: record.won + (picked.won ? 1 : 0),
        staked: record.staked + 1,
        profit: record.profit + profit,
      });
    }
    setRevealed(true);
  };

  const next = () => {
    setRevealed(false);
    setPick(null);
    setPos((p) => p + 1);
  };

  const resetRecord = () => save(ZERO);

  const roi = record.staked > 0 ? record.profit / record.staked : 0;
  const hit = record.bets > 0 ? record.won / record.bets : 0;

  return (
    <div className="space-y-5">
      {/* Scoreboard */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <div>
          <div className="text-[11px] tracked text-muted">Your paper record</div>
          <div className="text-lg font-semibold tabnum">
            {record.won}/{record.bets} <span className="text-sm font-normal text-muted">won</span>
          </div>
        </div>
        <Stat label="Hit rate" value={record.bets ? `${Math.round(hit * 100)}%` : "—"} />
        <Stat
          label="Profit"
          value={record.bets ? `${record.profit >= 0 ? "+" : ""}${record.profit.toFixed(2)}u` : "—"}
          tone={record.profit >= 0 ? "good" : "crit"}
        />
        <Stat
          label="ROI"
          value={record.staked ? `${roi >= 0 ? "+" : ""}${(roi * 100).toFixed(1)}%` : "—"}
          tone={roi >= 0 ? "good" : "crit"}
        />
        <button
          onClick={resetRecord}
          className="ml-auto rounded-md border border-line-2 px-3 py-1.5 text-xs text-ink-2 hover:bg-surface-2"
        >
          Reset
        </button>
      </Card>

      {/* The fixture */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <LeagueBadge code={f.code} size="sm" />
            <span className="text-sm text-muted">{f.league}</span>
          </div>
          <span className="text-[11px] text-muted">a past match · result hidden</span>
        </div>

        <div className="px-4 py-4">
          <div className="mb-4 flex items-center justify-center gap-4 text-center">
            <div className="flex-1 text-right text-lg font-semibold">{f.home}</div>
            <div className="tabnum text-2xl font-bold text-muted">
              {revealed ? `${f.result.fthg}–${f.result.ftag}` : "?–?"}
            </div>
            <div className="flex-1 text-left text-lg font-semibold">{f.away}</div>
          </div>

          {/* Pre-match splits */}
          <div className="grid gap-3 sm:grid-cols-2">
            <TeamSplit title={`${f.home} — last 10`} overall={f.homeOverall} venue={f.homeHome} venueLabel="at home" />
            <TeamSplit title={`${f.away} — last 10`} overall={f.awayOverall} venue={f.awayAway} venueLabel="away" />
          </div>

          {/* Model read */}
          <div className="mt-4 rounded-lg bg-surface-2 p-3">
            <div className="mb-1.5 text-[11px] tracked text-muted">The model&apos;s read</div>
            <ProbBar home={f.model.pHome} draw={f.model.pDraw} away={f.model.pAway} />
            <div className="mt-2 flex gap-4 text-xs text-ink-2">
              <span>Over 2.5: <span className="tabnum text-ink">{Math.round(f.model.pOver25 * 100)}%</span></span>
              <span>BTTS: <span className="tabnum text-ink">{Math.round(f.model.pBttsYes * 100)}%</span></span>
            </div>
          </div>

          {/* Place a paper bet */}
          {!revealed && (
            <div className="mt-4">
              <div className="mb-2 text-[11px] tracked text-muted">Your call — pick one, then reveal</div>
              <div className="flex flex-wrap gap-2">
                {markets.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setPick(m.key)}
                    className="rounded-md border px-3 py-2 text-sm transition-colors"
                    style={
                      pick === m.key
                        ? {
                            borderColor: "var(--color-brand)",
                            background: "color-mix(in srgb, var(--color-brand) 18%, transparent)",
                            color: "var(--color-ink)",
                          }
                        : {
                            borderColor: "var(--color-line-2)",
                            background: "var(--color-surface-2)",
                            color: "var(--color-ink-2)",
                          }
                    }
                  >
                    {m.label} <span className="tabnum text-muted">@ {m.odds!.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reveal / outcome */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {!revealed ? (
              <>
                <button
                  onClick={reveal}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-good-ink hover:opacity-90"
                >
                  {picked ? `Reveal — betting ${picked.label}` : "Reveal result"}
                </button>
                {!picked && <span className="text-xs text-muted">or pick a selection first to stake 1 unit</span>}
              </>
            ) : (
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <OutcomeSummary f={f} picked={picked} />
                <button
                  onClick={next}
                  className="ml-auto rounded-md border border-line-2 bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-elevated"
                >
                  Next match →
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function OutcomeSummary({ f, picked }: { f: ReplayFixture; picked?: Market }) {
  const resultText =
    f.result.ftr === "H" ? `${f.home} won` : f.result.ftr === "A" ? `${f.away} won` : "Draw";
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Pill tone="neutral">
        {resultText} · {f.result.fthg}–{f.result.ftag}
      </Pill>
      <Pill tone={f.result.over25 ? "info" : "neutral"}>
        {f.result.over25 ? "Over 2.5 ✓" : "Under 2.5"}
      </Pill>
      <Pill tone={f.result.btts ? "info" : "neutral"}>{f.result.btts ? "BTTS ✓" : "No BTTS"}</Pill>
      {picked && (
        <Pill tone={picked.won ? "good" : "crit"}>
          Your {picked.label}: {picked.won ? `won +${(picked.odds! - 1).toFixed(2)}u` : "lost −1u"}
        </Pill>
      )}
    </div>
  );
}

function TeamSplit({
  title,
  overall,
  venue,
  venueLabel,
}: {
  title: string;
  overall: SplitStat;
  venue: SplitStat;
  venueLabel: string;
}) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="mb-2 text-[11px] tracked text-muted">{title}</div>
      <SplitRow label="Overall" s={overall} />
      <div className="mt-1.5 border-t border-line pt-1.5">
        <SplitRow label={venueLabel} s={venue} />
      </div>
    </div>
  );
}

function SplitRow({ label, s }: { label: string; s: SplitStat }) {
  if (s.games === 0) return <div className="text-xs text-muted">{label}: no games</div>;
  return (
    <div className="text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted">{label}</span>
        <span className="tabnum font-medium">
          {s.w}-{s.d}-{s.l}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 tabnum text-muted">
        <span>GF {s.gfPg.toFixed(1)}</span>
        <span>GA {s.gaPg.toFixed(1)}</span>
        <span>O2.5 {Math.round(s.over25Pct * 100)}%</span>
        <span>BTTS {Math.round(s.bttsPct * 100)}%</span>
        <span>CS {Math.round(s.csPct * 100)}%</span>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "crit" }) {
  const c = tone === "good" ? "text-good" : tone === "crit" ? "text-crit" : "text-ink";
  return (
    <div>
      <div className="text-[11px] tracked text-muted">{label}</div>
      <div className={`text-lg font-semibold tabnum ${c}`}>{value}</div>
    </div>
  );
}
