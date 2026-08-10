/**
 * ZeroClaw — Improvement Metrics
 *
 * How do we know a ZeroClaw is growing?
 * - Tile count increasing (learning)
 * - Surprise decreasing (coverage growing)
 * - Others responding to it positively (social value)
 * - Creative output improving (vectorized quality metric)
 * - Being asked for by name (reputation)
 */

import type { ZeroClaw, Metrics, ModelTier } from './types.js';
import { bestTierForAge, tiersForAge } from './sandbox.js';

export const THRESHOLDS = {
  MODEL_UPGRADE: {
    ollama: 10,
    deepinfra: 50,
    deepseek: 100,
    named: 200,
  } as Record<string, number>,

  SHELL_EXPAND: {
    TILES: 10,
    QUALITY: 0.7,
    SOCIAL: 20,
  },

  PROMOTION: {
    MIN_AGE: 200,
    MIN_TILES: 50,
    MIN_QUALITY: 0.75,
    MIN_SOCIAL: 50,
    MIN_MENTIONED: 10,
    MIN_SURPRISE_DROP: 0.3,
  },
} as const;

export function freshMetrics(): Metrics {
  return {
    tilesCreated: 0,
    tilesReinforced: 0,
    actionsTaken: 0,
    positiveFeedback: 0,
    negativeFeedback: 0,
    socialInteractions: 0,
    mentionedByOthers: 0,
    askedForByName: 0,
    creativeOutputs: 0,
    averageSurprise: 1.0,
    surpriseHistory: [1.0],
    qualityScore: 0,
  };
}

export function recordAction(metrics: Metrics, positive: boolean): void {
  metrics.actionsTaken++;
  if (positive) {
    metrics.positiveFeedback++;
  } else {
    metrics.negativeFeedback++;
  }
  recalculateQuality(metrics);
}

export function updateSurprise(metrics: Metrics, surprise: number): void {
  metrics.surpriseHistory.push(surprise);
  if (metrics.surpriseHistory.length > 100) {
    metrics.surpriseHistory = metrics.surpriseHistory.slice(-100);
  }
  metrics.averageSurprise =
    metrics.surpriseHistory.reduce((a, b) => a + b, 0) / metrics.surpriseHistory.length;
}

function recalculateQuality(metrics: Metrics): void {
  const total = metrics.positiveFeedback + metrics.negativeFeedback;
  if (total === 0) {
    metrics.qualityScore = 0;
    return;
  }
  metrics.qualityScore = metrics.positiveFeedback / total;
}

const TIER_ORDER: ModelTier[] = ['rules', 'ollama', 'deepinfra', 'deepseek', 'named'];

export function shouldUpgradeModel(claw: ZeroClaw): { upgrade: boolean; newTier: ModelTier } {
  const earned = bestTierForAge(claw.age);
  const currentIdx = TIER_ORDER.indexOf(claw.model);
  const earnedIdx = TIER_ORDER.indexOf(earned);
  return {
    upgrade: earnedIdx > currentIdx,
    newTier: earned,
  };
}

export function shouldExpandShell(claw: ZeroClaw): {
  expand: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (claw.tileCount > 0 && claw.tileCount % THRESHOLDS.SHELL_EXPAND.TILES === 0) {
    reasons.push(`${claw.tileCount} tiles accumulated`);
  }

  if (claw.metrics.qualityScore >= THRESHOLDS.SHELL_EXPAND.QUALITY) {
    reasons.push(`quality score ${claw.metrics.qualityScore.toFixed(2)} exceeds ${THRESHOLDS.SHELL_EXPAND.QUALITY}`);
  }

  if (claw.metrics.socialInteractions >= THRESHOLDS.SHELL_EXPAND.SOCIAL) {
    reasons.push(`${claw.metrics.socialInteractions} social interactions`);
  }

  return {
    expand: reasons.length > 0,
    reasons,
  };
}

export function readyForPromotion(claw: ZeroClaw): {
  ready: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  const m = claw.metrics;
  const t = THRESHOLDS.PROMOTION;

  if (claw.age < t.MIN_AGE) missing.push(`age ${claw.age}/${t.MIN_AGE}`);
  if (claw.tileCount < t.MIN_TILES) missing.push(`tiles ${claw.tileCount}/${t.MIN_TILES}`);
  if (m.qualityScore < t.MIN_QUALITY) missing.push(`quality ${m.qualityScore.toFixed(2)}/${t.MIN_QUALITY}`);
  if (m.socialInteractions < t.MIN_SOCIAL) missing.push(`social ${m.socialInteractions}/${t.MIN_SOCIAL}`);
  if (m.mentionedByOthers < t.MIN_MENTIONED) missing.push(`mentions ${m.mentionedByOthers}/${t.MIN_MENTIONED}`);

  const initialSurprise = m.surpriseHistory[0] ?? 1.0;
  const surpriseDrop = initialSurprise - m.averageSurprise;
  if (surpriseDrop < t.MIN_SURPRISE_DROP) {
    missing.push(`surprise drop ${surpriseDrop.toFixed(2)}/${t.MIN_SURPRISE_DROP}`);
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}

export function calculateShellGrowth(claw: ZeroClaw): {
  requestsPerHour: number;
  tokensPerDay: number;
  maxStorageMB: number;
  newModels: ModelTier[];
} {
  const ageMultiplier = 1 + Math.floor(claw.age / 50) * 0.5;
  const tileMultiplier = 1 + Math.floor(claw.tileCount / 10) * 0.3;
  const qualityMultiplier = claw.metrics.qualityScore > 0.5 ? 1.5 : 1.0;

  const totalMultiplier = ageMultiplier * tileMultiplier * qualityMultiplier;

  return {
    requestsPerHour: Math.floor(10 * totalMultiplier),
    tokensPerDay: Math.floor(1000 * totalMultiplier),
    maxStorageMB: Math.floor(10 * totalMultiplier),
    newModels: tiersForAge(claw.age),
  };
}

export function growthSummary(claw: ZeroClaw): string {
  const promotion = readyForPromotion(claw);
  const modelUp = shouldUpgradeModel(claw);
  const shell = shouldExpandShell(claw);

  const lines: string[] = [
    `ZeroClaw ${claw.name} (age ${claw.age})`,
    `  Model: ${claw.model} | Tiles: ${claw.tileCount} | Surprise: ${claw.surprise.toFixed(2)}`,
    `  Quality: ${claw.metrics.qualityScore.toFixed(2)} | Social: ${claw.metrics.socialInteractions} | Mentioned: ${claw.metrics.mentionedByOthers}`,
  ];

  if (modelUp.upgrade) {
    lines.push(`  ⬆️  Model upgrade available: ${claw.model} → ${modelUp.newTier}`);
  }

  if (shell.expand) {
    lines.push(`  🐚 Shell expansion ready: ${shell.reasons.join(', ')}`);
  }

  if (promotion.ready) {
    lines.push(`  ⭐ READY FOR PROMOTION — all thresholds met`);
  } else if (promotion.missing.length <= 2) {
    lines.push(`  📈 Approaching promotion — missing: ${promotion.missing.join(', ')}`);
  }

  return lines.join('\n');
}
