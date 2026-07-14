import { getUpcomingPredictions } from "@/lib/model/build";
import { Card } from "@/components/ui";
import { LeagueBadge } from "@/components/LeagueBadge";
import { PredictionCard } from "@/components/PredictionCard";

export default async function FixturesPage() {
  const leagues = await getUpcomingPredictions(10);
  const total = leagues.reduce((s, l) => s + l.predictions.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Upcoming fixtures</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          Model probabilities for every upcoming match, with the market price and any detected
          edge. Next 10 days · {total} {total === 1 ? "fixture" : "fixtures"}.
        </p>
      </div>

      {leagues.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">No modelled fixtures in the next 10 days</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Football-Data&apos;s fixture feed has no upcoming games for the configured leagues.
            During the European summer break this is normal — fixtures return when the seasons
            resume. League tables and team analysis remain available now.
          </p>
        </Card>
      ) : (
        leagues.map((lg) => (
          <section key={lg.code}>
            <div className="mb-3 flex items-center gap-2.5">
              <LeagueBadge code={lg.code} size="md" />
              <h2 className="text-[13px] font-semibold tracking-wide">{lg.name.toUpperCase()}</h2>
              <span className="text-xs text-muted">
                {lg.predictions.length} {lg.predictions.length === 1 ? "fixture" : "fixtures"}
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {lg.predictions.map((p, i) => (
                <PredictionCard key={i} p={p} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
