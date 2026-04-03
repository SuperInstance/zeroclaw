// tile-algebra.ts — Phase 3: Typed task tiles with confidence composition
// Tiles are atomic units of agent work. Composing tiles multiplies confidence.

export type TileType = 'reasoning' | 'generation' | 'validation' | 'routing' | 'storage';

export interface Tile {
  id: string;
  type: TileType;
  label: string;
  confidence: number;       // 0..1
  model?: string;           // model used or recommended
  input: string;
  output?: string;
  tokens?: number;
  timestamp: number;
  children?: Tile[];        // composed sub-tiles
}

export interface ModelSpec {
  name: string;
  costPer1k: number;        // cost per 1k tokens
  maxConfidence: number;    // ceiling confidence this model can achieve per tile
}

const DEFAULT_MODELS: ModelSpec[] = [
  { name: 'claude-haiku-4-5-20251001',   costPer1k: 0.001, maxConfidence: 0.70 },
  { name: 'claude-sonnet-4-6',           costPer1k: 0.003, maxConfidence: 0.88 },
  { name: 'claude-opus-4-6',             costPer1k: 0.015, maxConfidence: 0.97 },
];

let tileHistory: Tile[] = [];
let tileCounter = 0;

export function createTile(
  type: TileType,
  label: string,
  input: string,
  confidence = 0.5,
  model?: string,
): Tile {
  return {
    id: `tile-${++tileCounter}-${Date.now().toString(36)}`,
    type,
    label,
    confidence: Math.min(1, Math.max(0, confidence)),
    model,
    input,
    timestamp: Date.now(),
  };
}

/** Compose tiles into a pipeline. Overall confidence = product of all tile confidences. */
export function composeTiles(label: string, tiles: Tile[]): Tile {
  const confidence = tiles.reduce((acc, t) => acc * t.confidence, 1);
  const tokens = tiles.reduce((acc, t) => acc + (t.tokens ?? 0), 0);
  const composed: Tile = {
    id: `tile-${++tileCounter}-${Date.now().toString(36)}`,
    type: 'routing',
    label,
    confidence,
    input: tiles.map(t => t.input).join(' → '),
    output: tiles.map(t => t.output ?? '').join(' → '),
    tokens,
    timestamp: Date.now(),
    children: tiles,
  };
  tileHistory.push(composed);
  return composed;
}

/** Pick the cheapest model that can achieve the target confidence for a tile type. */
export function selectModelForTile(
  targetConfidence: number,
  models: ModelSpec[] = DEFAULT_MODELS,
): ModelSpec {
  const sorted = [...models].sort((a, b) => a.costPer1k - b.costPer1k);
  const pick = sorted.find(m => m.maxConfidence >= targetConfidence);
  return pick ?? sorted[sorted.length - 1];
}

/** Get all tiles recorded in this session. */
export function getTileHistory(): Tile[] {
  return [...tileHistory];
}

/** Confidence breakdown: decompose a composed tile into per-child confidence. */
export function confidenceBreakdown(tile: Tile): { label: string; type: TileType; confidence: number }[] {
  if (!tile.children?.length) {
    return [{ label: tile.label, type: tile.type, confidence: tile.confidence }];
  }
  return tile.children.flatMap(confidenceBreakdown);
}

/** Token usage across all history. */
export function tokenUsage(): { total: number; byType: Record<TileType, number> } {
  const byType: Record<TileType, number> = {
    reasoning: 0, generation: 0, validation: 0, routing: 0, storage: 0,
  };
  function walk(t: Tile) {
    byType[t.type] += t.tokens ?? 0;
    t.children?.forEach(walk);
  }
  tileHistory.forEach(walk);
  return { total: Object.values(byType).reduce((a, b) => a + b, 0), byType };
}

/** Record a single tile into history (useful for standalone tiles not in a composition). */
export function recordTile(tile: Tile): Tile {
  tileHistory.push(tile);
  return tile;
}

/** Reset history (for tests or fresh session). */
export function resetHistory(): void {
  tileHistory = [];
  tileCounter = 0;
}
