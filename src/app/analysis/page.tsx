import { getAnalysisData } from "@/lib/model/build";
import { MatchAnalysis } from "@/components/MatchAnalysis";

export default async function AnalysisPage() {
  const leagues = await getAnalysisData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Match analysis</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          Pick any two teams from a league and see the chances for every market — goals, the
          over/under ladder, both teams to score, by half, <span className="text-ink">corners</span>{" "}
          and <span className="text-ink">cards</span>. League matches only (no cups), based on this
          season&apos;s form.
        </p>
      </div>
      {leagues.length === 0 ? (
        <p className="text-sm text-muted">No league data available yet.</p>
      ) : (
        <MatchAnalysis leagues={leagues} />
      )}
      <p className="text-xs text-muted">
        Percentages are estimates from this season&apos;s scoring, corner and card rates — a guide,
        not a guarantee. Bet responsibly.
      </p>
    </div>
  );
}
