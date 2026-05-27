import type { Confidence, Scores } from "./scoring";

export type Verdict =
  | "IGNORE"
  | "WATCH"
  | "GOOD_BELOW_TARGET"
  | "INTERESTING_RISKY"
  | "SCARCE_OVERPRICED"
  | "STRONG_SIGNAL"
  | "AVOID_HYPE";

export function pickVerdict(args: {
  scores: Scores;
  confidence: Confidence;
  currentPriceCents: number | null;
  targetPriceCents: number | null;
}): Verdict {
  const { scores, confidence, currentPriceCents, targetPriceCents } = args;

  if (confidence === "LOW") return "WATCH";

  const { scarcityScore, momentumScore, demandScore, riskScore } = scores;

  if (
    scarcityScore > 70 &&
    momentumScore > 60 &&
    riskScore < 50
  ) {
    return "STRONG_SIGNAL";
  }
  if (scarcityScore > 70 && momentumScore > 60 && riskScore >= 50) {
    return "INTERESTING_RISKY";
  }
  if (
    currentPriceCents !== null &&
    targetPriceCents !== null &&
    scarcityScore > 60 &&
    currentPriceCents > targetPriceCents * 1.4
  ) {
    return "SCARCE_OVERPRICED";
  }
  if (momentumScore > 70 && demandScore < 30) {
    return "AVOID_HYPE";
  }
  if (
    currentPriceCents !== null &&
    targetPriceCents !== null &&
    currentPriceCents <= targetPriceCents
  ) {
    return "GOOD_BELOW_TARGET";
  }
  if (scarcityScore < 30 && momentumScore < 30) {
    return "IGNORE";
  }
  return "WATCH";
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  IGNORE: "Ignore",
  WATCH: "Watch",
  GOOD_BELOW_TARGET: "Good below target",
  INTERESTING_RISKY: "Interesting but risky",
  SCARCE_OVERPRICED: "Scarce but overpriced",
  STRONG_SIGNAL: "Strong collectible signal",
  AVOID_HYPE: "Avoid hype price",
};

export const VERDICT_BLURB: Record<Verdict, string> = {
  IGNORE: "Common, abundant, prices flat. Skip unless you specifically want this.",
  WATCH: "Not enough signal in either direction yet. Keep an eye on it.",
  GOOD_BELOW_TARGET:
    "Today's asking price is below our fair-buy estimate. Reasonable entry.",
  INTERESTING_RISKY:
    "Scarcity and momentum are real, but the risk signals (low sold volume, wide spread, reissue risk) are also elevated.",
  SCARCE_OVERPRICED:
    "Genuinely hard to find right now, but current asks are well above the fair-buy estimate.",
  STRONG_SIGNAL:
    "Multiple positive signals lining up: scarcer over time, prices trending up, risk profile contained.",
  AVOID_HYPE:
    "Prices are rising but actual sold-through volume is thin — looks like seller-driven hype, not real demand.",
};
