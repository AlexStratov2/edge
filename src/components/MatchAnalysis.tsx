"use client";

import { useMemo, useState } from "react";
import type { AnalysisLeague } from "@/lib/model/build";
import { cardAnalysis, cornerAnalysis, goalAnalysis, OverLine } from "@/lib/model/matchAnalysis";
import { Card, SectionTitle } from "@/components/ui";
import { ProbBar } from "@/components/viz";
import { LeagueBadge } from "@/components/LeagueBadge";

export function MatchAnalysis({ leagues }: { leagues: AnalysisLeague[] }) {
  const [code, setCode] = useState(leagues[0]?.code ?? "");
  const league = leagues.find((l) => l.code === code) ?? leagues[0];
  const teams = league?.teams ?? [];
  const [homeSlug, setHomeSlug] = useState(teams[0]?.slug ?? "");
  const [awaySlug, setAwaySlug] = useState(teams[1]?.slug ?? "");

  const home = teams.find((t) => t.slug === homeSlug) ?? teams[0];
  const away = teams.find((t) => t.slug === awaySlug) ?? teams[1];

  const onLeague = (c: string) => {
    const lg = leagues.find((l) => l.code === c)!;
    setCode(c);
    setHomeSlug(lg.teams[0]?.slug ?? "");
    setAwaySlug(lg.teams[1]?.slug ?? "");
  };

  const goals = useMemo(
    () => (league && home && away ? goalAnalysis(league, home, away) : null),
    [league, home, away],
  );
  const corners = useMemo(
    () => (league?.hasCorners && home && away ? cornerAnalysis(home, away) : null),
    [league, home, away],
  );
  const cards = useMemo(
    () => (league?.hasCards && home && away ? cardAnalysis(home, away) : null),
    [league, home, away],
  );

  if (!league || !home || !away || !goals) {
    return <Card className="p-8 text-center text-sm text-muted">No league data available.</Card>;
  }

  const sameTeam = home.slug === away.slug;

  return (
    <div className="space-y-5">
      {/* Pickers */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <LeagueBadge code={league.code} size="sm" />
            <Select value={code} onChange={onLeague}>
              {leagues.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Select value={homeSlug} onChange={setHomeSlug}>
              {teams.map((t) => (
                <option key={t.slug} value={t.slug}>{t.name}</option>
              ))}
            </Select>
            <span className="text-sm text-muted">vs</span>
            <Select value={awaySlug} onChange={setAwaySlug}>
              {teams.map((t) => (
                <option key={t.slug} value={t.slug}>{t.name}</option>
              ))}
            </Select>
          </div>
        </div>
        {sameTeam && <p className="mt-2 text-xs text-warn">Pick two different teams.</p>}
      </Card>

      {/* Header line */}
      <div className="flex items-center justify-center gap-4 text-center">
        <div className="flex-1 text-right text-lg font-semibold">{home.name}</div>
        <div className="tabnum text-sm text-muted">
          ≈ {goals.expHome.toFixed(1)}–{goals.expAway.toFixed(1)}
        </div>
        <div className="flex-1 text-left text-lg font-semibold">{away.name}</div>
      </div>

      {/* Goals */}
      <section>
        <SectionTitle title="GOALS" hint={`Home / draw / away, the goals ladder, both-teams-to-score and by half. ${league.season}.`} />
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-2 text-[11px] tracked text-muted">Match result</div>
            <ProbBar home={goals.pHome} draw={goals.pDraw} away={goals.pAway} />
            <div className="mt-4 space-y-2">
              {goals.ou.map((o) => (
                <OverRow key={o.line} label={`Over ${o.line} goals`} o={o} />
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <Meter label="Both teams to score" p={goals.bttsYes} />
            <div className="my-3 border-t border-line" />
            <div className="mb-2 text-[11px] tracked text-muted">By half</div>
            <Meter label="1st half: over 0.5" p={goals.firstHalfOver05} />
            <Meter label="1st half: over 1.5" p={goals.firstHalfOver15} />
            <Meter label="2nd half: over 1.5" p={goals.secondHalfOver15} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {goals.topScores.slice(0, 4).map((s) => (
                <span key={s.score} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] tabnum text-ink-2">
                  {s.score} <span className="text-muted">{Math.round(s.p * 100)}%</span>
                </span>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* Corners */}
      {corners ? (
        <section>
          <SectionTitle title="CORNERS" hint={`Expected ≈ ${corners.expTotal.toFixed(1)} total (${corners.expHome.toFixed(1)} + ${corners.expAway.toFixed(1)}).`} />
          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="p-4">
              <div className="mb-2 text-[11px] tracked text-muted">Match total</div>
              <div className="space-y-2">
                {corners.ou.map((o) => (
                  <OverRow key={o.line} label={`Over ${o.line}`} o={o} />
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <div className="mb-2 text-[11px] tracked text-muted">Team corners</div>
              <div className="text-xs text-muted">{home.name}</div>
              {corners.homeTeam.map((t) => (
                <Meter key={`h${t.line}`} label={`Over ${t.line}`} p={t.over} />
              ))}
              <div className="mt-2 text-xs text-muted">{away.name}</div>
              {corners.awayTeam.map((t) => (
                <Meter key={`a${t.line}`} label={`Over ${t.line}`} p={t.over} />
              ))}
            </Card>
          </div>
        </section>
      ) : (
        <p className="text-xs text-muted">Corner data isn&apos;t available for this league.</p>
      )}

      {/* Cards */}
      {cards ? (
        <section>
          <SectionTitle title="CARDS" hint={`Expected ≈ ${cards.expTotal.toFixed(1)} total.`} />
          <Card className="p-4">
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {cards.ou.map((o) => (
                <OverRow key={o.line} label={`Over ${o.line} cards`} o={o} />
              ))}
            </div>
          </Card>
        </section>
      ) : (
        <p className="text-xs text-muted">Card data isn&apos;t available for this league.</p>
      )}
    </div>
  );
}

function OverRow({ label, o }: { label: string; o: OverLine }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-ink-2">{label}</span>
        <span className="tabnum text-muted">
          <span className="text-brand">{Math.round(o.over * 100)}%</span> · under {Math.round(o.under * 100)}%
        </span>
      </div>
      <Bar p={o.over} />
    </div>
  );
}

function Meter({ label, p }: { label: string; p: number }) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-ink-2">{label}</span>
        <span className="tabnum text-brand">{Math.round(p * 100)}%</span>
      </div>
      <Bar p={p} />
    </div>
  );
}

function Bar({ p }: { p: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, p * 100))}%`, background: "var(--color-brand)" }} />
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-line-2 bg-surface-2 px-3 py-1.5 text-sm text-ink outline-none focus:border-brand"
    >
      {children}
    </select>
  );
}
