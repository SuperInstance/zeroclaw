// tile-cache.ts — Phase 3: KV-backed tile result cache with typed keys

import { Tile, TileType } from './tile-algebra.js';

export interface CacheEntry {
  key: string;
  tile: Tile;
  cachedAt: number;
  ttlMs: number;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

const store = new Map<string, CacheEntry>();

function makeKey(type: TileType, input: string): string {
  const hash = simpleHash(input);
  return `tile:${type}:${hash}`;
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function get(type: TileType, input: string): Tile | undefined {
  const key = makeKey(type, input);
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > entry.ttlMs) {
    store.delete(key);
    return undefined;
  }
  return entry.tile;
}

export function set(type: TileType, input: string, tile: Tile, ttlMs = DEFAULT_TTL): void {
  const key = makeKey(type, input);
  store.set(key, { key, tile, cachedAt: Date.now(), ttlMs });
}

export function clear(): void {
  store.clear();
}

export function size(): number {
  return store.size;
}

/** Evict expired entries. */
export function evict(): number {
  let evicted = 0;
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.cachedAt > entry.ttlMs) {
      store.delete(key);
      evicted++;
    }
  }
  return evicted;
}
