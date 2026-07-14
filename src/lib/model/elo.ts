// Independent Elo-based 1X2 model — a second opinion alongside the Dixon-Coles
// goal model. Uses ClubElo ratings (already fetched, official API). When both
// models agree on the favourite, an opportunity is higher-confidence.

const HOME_ADVANTAGE = 65; // Elo points, ClubElo-style
const MAX_DRAW = 0.30; // draw rate when teams are evenly matched

export interface EloProbs {
  pHome: number;
  pDraw: number;
  pAway: number;
}

/**
 * Convert two Elo ratings into 1X2 probabilities. The expected score (home
 * points share) comes from the standard Elo logistic; the draw share is modelled
 * as largest when the teams are even and shrinking as the gap widens.
 */
export function eloProbs(homeElo: number, awayElo: number, hfa = HOME_ADVANTAGE): EloProbs {
  const dr = homeElo - awayElo + hfa;
  const we = 1 / (1 + Math.pow(10, -dr / 400)); // home expected points share (0..1)
  const pDraw = MAX_DRAW * (1 - Math.abs(2 * we - 1));
  const pHome = Math.max(0, we - pDraw / 2);
  const pAway = Math.max(0, 1 - we - pDraw / 2);
  const total = pHome + pDraw + pAway;
  return { pHome: pHome / total, pDraw: pDraw / total, pAway: pAway / total };
}

/** Which of Home / Draw / Away a probability triple favours. */
export function favourite(p: { pHome: number; pDraw: number; pAway: number }): "H" | "D" | "A" {
  if (p.pHome >= p.pDraw && p.pHome >= p.pAway) return "H";
  if (p.pAway >= p.pDraw && p.pAway >= p.pHome) return "A";
  return "D";
}

/**
 * Do the goal model and the Elo model agree on which side is favoured? Requires
 * a clear lean (not a near-coin-flip) so weak agreements are not oversold.
 */
export function isConsensus(
  model: { pHome: number; pDraw: number; pAway: number },
  elo: { pHome: number; pDraw: number; pAway: number },
): boolean {
  const modelLean = Math.sign(model.pHome - model.pAway);
  const eloLean = Math.sign(elo.pHome - elo.pAway);
  const clear = Math.abs(model.pHome - model.pAway) > 0.08 && Math.abs(elo.pHome - elo.pAway) > 0.08;
  return clear && modelLean === eloLean && modelLean !== 0;
}
