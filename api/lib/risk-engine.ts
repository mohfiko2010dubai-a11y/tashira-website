export type RiskSignals = {
  retries: number;
  failures: number;
  deviceChanges: number;
  ipChanges: number;
  velocityEvents: number;
  applicantCount: number;
};

export type RiskAssessment = {
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  score: number;
  factors: Array<{ signal: keyof RiskSignals; value: number; points: number }>;
  modelVersion: "risk-v1";
};

const WEIGHTS: Record<keyof RiskSignals, number> = {
  retries: 8,
  failures: 12,
  deviceChanges: 10,
  ipChanges: 10,
  velocityEvents: 5,
  applicantCount: 2,
};

export function assessRisk(signals: RiskSignals): RiskAssessment {
  const factors = (Object.keys(WEIGHTS) as Array<keyof RiskSignals>).map((signal) => ({
    signal,
    value: Math.max(0, signals[signal]),
    points: Math.max(0, signals[signal]) * WEIGHTS[signal],
  })).filter((factor) => factor.points > 0);
  const score = Math.min(100, factors.reduce((sum, factor) => sum + factor.points, 0));
  const level = score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";
  return { level, score, factors, modelVersion: "risk-v1" };
}
