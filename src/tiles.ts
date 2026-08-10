/**
 * ZeroClaw — Tile System
 *
 * Tiles are the ZeroClaw's reflexes. They start empty and grow.
 * Each tile is a small JSON file in tiles/.
 *
 * As tiles accumulate, the ZeroClaw becomes faster and cheaper.
 * Most interactions are handled by tiles (reflex, < 1ms, no API call).
 * Only novel situations require model invocation (cortex, expensive).
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type { Tile, LearnSource } from './types.js';

const TILE_PATTERN_THRESHOLD = 0.5;
const TILE_REINFORCEMENT_BOOST = 0.1;
const TILE_DECAY = 0.01;

export class TileStore {
  private tilesDir: string;
  private cache: Map<string, Tile> = new Map();
  private loaded = false;

  constructor(clawFolder: string) {
    this.tilesDir = path.join(clawFolder, 'tiles');
  }

  async load(): Promise<void> {
    this.cache.clear();
    try {
      const files = await fs.readdir(this.tilesDir);
      const tileFiles = files.filter(f => f.endsWith('.json'));
      for (const file of tileFiles) {
        const content = await fs.readFile(path.join(this.tilesDir, file), 'utf-8');
        const tile = JSON.parse(content) as Tile;
        this.cache.set(tile.id, tile);
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
    this.loaded = true;
  }

  async flush(): Promise<void> {
    await fs.mkdir(this.tilesDir, { recursive: true });
    for (const tile of this.cache.values()) {
      const filePath = path.join(this.tilesDir, `${tile.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(tile, null, 2) + '\n');
    }
  }

  get(id: string): Tile | undefined {
    return this.cache.get(id);
  }

  all(): Tile[] {
    return Array.from(this.cache.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  count(): number {
    return this.cache.size;
  }

  match(input: string): Tile | null {
    let bestMatch: Tile | null = null;
    let bestScore = 0;

    for (const tile of this.cache.values()) {
      const score = this.scoreMatch(input, tile);
      if (score > bestScore && score >= TILE_PATTERN_THRESHOLD) {
        bestScore = score;
        bestMatch = tile;
      }
    }

    return bestMatch;
  }

  private scoreMatch(input: string, tile: Tile): number {
    const lowerInput = input.toLowerCase();

    try {
      const regex = new RegExp(tile.pattern, 'i');
      if (regex.test(lowerInput)) {
        return tile.confidence;
      }
    } catch {
      // fall through
    }

    const keywords = tile.pattern.split('|').map(k => k.trim().toLowerCase());
    for (const kw of keywords) {
      if (lowerInput.includes(kw)) {
        return tile.confidence * 0.9;
      }
    }

    return 0;
  }

  async create(params: {
    pattern: string;
    action: string;
    reflexResponse?: string;
    learnedFrom: LearnSource;
    tags?: string[];
  }): Promise<Tile> {
    const id = this.nextTileId();
    const tile: Tile = {
      id,
      pattern: params.pattern,
      action: params.action,
      confidence: 0.5,
      timesUsed: 0,
      timesReinforced: 0,
      createdAt: new Date().toISOString(),
      learnedFrom: params.learnedFrom,
      reflexResponse: params.reflexResponse,
      tags: params.tags || [],
    };

    this.cache.set(id, tile);
    await this.flush();
    return tile;
  }

  use(tileId: string): Tile | null {
    const tile = this.cache.get(tileId);
    if (!tile) return null;
    tile.timesUsed++;
    return tile;
  }

  reinforce(tileId: string): Tile | null {
    const tile = this.cache.get(tileId);
    if (!tile) return null;
    tile.timesReinforced++;
    tile.confidence = Math.min(1.0, tile.confidence + TILE_REINFORCEMENT_BOOST);
    return tile;
  }

  weaken(tileId: string): Tile | null {
    const tile = this.cache.get(tileId);
    if (!tile) return null;
    tile.confidence = Math.max(0.0, tile.confidence - TILE_DECAY * 5);
    return tile;
  }

  private nextTileId(): string {
    const count = this.cache.size;
    return String(count + 1).padStart(3, '0');
  }

  stats(): {
    count: number;
    avgConfidence: number;
    totalUses: number;
    totalReinforced: number;
    bySource: Record<string, number>;
  } {
    const tiles = this.all();
    const bySource: Record<string, number> = {};
    let totalConfidence = 0;
    let totalUses = 0;
    let totalReinforced = 0;

    for (const t of tiles) {
      totalConfidence += t.confidence;
      totalUses += t.timesUsed;
      totalReinforced += t.timesReinforced;
      bySource[t.learnedFrom] = (bySource[t.learnedFrom] || 0) + 1;
    }

    return {
      count: tiles.length,
      avgConfidence: tiles.length > 0 ? totalConfidence / tiles.length : 0,
      totalUses,
      totalReinforced,
      bySource,
    };
  }
}
