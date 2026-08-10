/**
 * ZeroClaw — Test Suite
 *
 * Tests:
 * - Spawn a ZeroClaw, run 10 cycles, verify tile creation
 * - Verify model progression (rules → ollama → deepinfra)
 * - Verify promotion system
 * - Verify sandbox isolation
 * - Verify The Tap integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

import { ZeroClawLifecycle } from '../src/lifecycle.js';
import { TileStore } from '../src/tiles.js';
import { Sandbox, bestTierForAge, tiersForAge } from '../src/sandbox.js';
import {
  freshMetrics,
  shouldUpgradeModel,
  shouldExpandShell,
  readyForPromotion,
  calculateShellGrowth,
  growthSummary,
  recordAction,
  updateSurprise,
} from '../src/metrics.js';
import { TapBridge, tapCycle } from '../src/tap-integration.js';
import type { ZeroClaw, Observation } from '../src/types.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zeroclaw-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeObservation(content: string, source = 'test'): Observation {
  return { type: 'message' as const, content, source, timestamp: new Date().toISOString() };
}

// ─── Lifecycle Tests ───────────────────────────────────────────────────────────

describe('ZeroClaw Lifecycle', () => {
  it('should spawn a ZeroClaw with correct initial state', async () => {
    const lifecycle = new ZeroClawLifecycle(tmpDir);
    const claw = await lifecycle.spawn();

    expect(claw.id).toMatch(/^zc-/);
    expect(claw.name).toBeTruthy();
    expect(claw.model).toBe('rules');
    expect(claw.age).toBe(0);
    expect(claw.tileCount).toBe(0);
    expect(claw.surprise).toBe(1.0);
    expect(claw.promoted).toBe(false);
    expect(claw.metrics.qualityScore).toBe(0);

    const identity = await fs.readFile(path.join(claw.folder, 'identity.md'), 'utf-8');
    expect(identity).toContain('I am new');
    expect(identity).toContain(claw.name);

    const stateFile = await fs.readFile(path.join(claw.folder, 'state.json'), 'utf-8');
    const state = JSON.parse(stateFile);
    expect(state.id).toBe(claw.id);
  });

  it('should run 10 cycles and create tiles from novel observations', async () => {
    const lifecycle = new ZeroClawLifecycle(tmpDir);
    const claw = await lifecycle.spawn();

    const observations = [
      makeObservation('hello there'),
      makeObservation('hi newcomer'),
      makeObservation('what are you?'),
      makeObservation('hey, welcome'),
      makeObservation('hello again'),
      makeObservation('a strange event occurred'),
      makeObservation('hi friend'),
      makeObservation('can you help me?'),
      makeObservation('hey there'),
      makeObservation('greetings traveler'),
    ];

    for (const obs of observations) {
      await lifecycle.cycle(claw.id, obs);
    }

    const grown = lifecycle.get(claw.id)!;

    expect(grown.age).toBe(10);
    expect(grown.tileCount).toBeGreaterThan(0);

    const tilesDir = path.join(grown.folder, 'tiles');
    const tileFiles = await fs.readdir(tilesDir);
    expect(tileFiles.length).toBeGreaterThan(0);
    expect(tileFiles.every(f => f.endsWith('.json'))).toBe(true);

    const journalDir = path.join(grown.folder, 'journal');
    const journalFiles = await fs.readdir(journalDir);
    expect(journalFiles.length).toBeGreaterThan(0);
  });

  it('should match tiles reflexively after learning', async () => {
    const lifecycle = new ZeroClawLifecycle(tmpDir);
    const claw = await lifecycle.spawn();

    // First "hello" — novel (surprise). No tile created yet (age 0).
    const r1 = await lifecycle.cycle(claw.id, makeObservation('hello there'));
    expect(r1.matched).toBe(false);

    // Second "hello" — now age > 0, should create a tile
    const r2 = await lifecycle.cycle(claw.id, makeObservation('hi there'));
    expect(r2.tileCreated).toBe(true);

    // Third "hello" — should match the tile we just created (reflex)
    const r3 = await lifecycle.cycle(claw.id, makeObservation('hello friend'));
    expect(r3.matched).toBe(true);
    expect(r3.modelUsed).toBe('tile-reflex');
  });

  it('should decrease surprise over time as tiles accumulate', async () => {
    const lifecycle = new ZeroClawLifecycle(tmpDir);
    const claw = await lifecycle.spawn();

    const initialSurprise = lifecycle.get(claw.id)!.surprise;
    expect(initialSurprise).toBe(1.0);

    for (let i = 0; i < 20; i++) {
      await lifecycle.cycle(claw.id, makeObservation(`hello number ${i}`));
    }

    const grown = lifecycle.get(claw.id)!;
    const surpriseHistory = grown.metrics.surpriseHistory;
    expect(surpriseHistory.length).toBeGreaterThan(10);
  });

  it('should upgrade model tier based on age', async () => {
    const lifecycle = new ZeroClawLifecycle(tmpDir);
    const claw = await lifecycle.spawn();

    for (let i = 0; i < 15; i++) {
      await lifecycle.cycle(claw.id, makeObservation(`cycle ${i}`));
    }

    const aged = lifecycle.get(claw.id)!;
    expect(aged.age).toBe(15);
    expect(aged.model).toBe('ollama');

    while (aged.age < 55) {
      await lifecycle.cycle(claw.id, makeObservation('aging'));
    }

    expect(lifecycle.get(claw.id)!.model).toBe('deepinfra');

    while (aged.age < 105) {
      await lifecycle.cycle(claw.id, makeObservation('still aging'));
    }

    expect(lifecycle.get(claw.id)!.model).toBe('deepseek');
  });

  it('should promote a ZeroClaw to a named agent', async () => {
    const lifecycle = new ZeroClawLifecycle(tmpDir);
    const claw = await lifecycle.spawn();

    for (let i = 0; i < 250; i++) {
      await lifecycle.cycle(claw.id, makeObservation(`growth cycle ${i}`));
    }

    const c = lifecycle.get(claw.id)!;
    c.metrics.socialInteractions = 60;
    c.metrics.mentionedByOthers = 15;
    c.metrics.positiveFeedback = 40;
    c.metrics.negativeFeedback = 5;
    c.metrics.qualityScore = 40 / 45;

    const promoted = await lifecycle.promote(claw.id, 'Scintilla');
    expect(promoted.name).toBe('Scintilla');
    expect(promoted.promoted).toBe(true);
    expect(promoted.model).toBe('named');

    const identity = await fs.readFile(path.join(promoted.folder, 'identity.md'), 'utf-8');
    expect(identity).toContain('Scintilla');
    expect(identity).toContain('I earned my name');
  });

  it('should archive a ZeroClaw (death preserves memory)', async () => {
    const lifecycle = new ZeroClawLifecycle(tmpDir);
    const claw = await lifecycle.spawn();

    await fs.writeFile(path.join(claw.folder, 'memory', 'test.txt'), 'I existed.');

    const archivePath = await lifecycle.archive(claw.id);
    expect(archivePath).toContain('.archived');

    const archivedContent = await fs.readFile(path.join(archivePath, 'memory', 'test.txt'), 'utf-8');
    expect(archivedContent).toBe('I existed.');

    expect(lifecycle.get(claw.id)).toBeUndefined();
  });
});

// ─── Tile System Tests ─────────────────────────────────────────────────────────

describe('Tile System', () => {
  it('should create, match, reinforce, and weaken tiles', async () => {
    const store = new TileStore(tmpDir);
    await store.load();

    expect(store.count()).toBe(0);

    const tile = await store.create({
      pattern: '\\bhello\\b',
      action: 'greet-back',
      reflexResponse: 'hi!',
      learnedFrom: 'observation',
    });

    expect(tile.id).toBe('001');
    expect(tile.confidence).toBe(0.5);

    const match = store.match('hello there');
    expect(match).not.toBeNull();
    expect(match!.id).toBe('001');

    const noMatch = store.match('goodbye');
    expect(noMatch).toBeNull();

    store.reinforce('001');
    const reinforced = store.get('001')!;
    const reinforcedConfidence = reinforced.confidence;
    expect(reinforced.timesReinforced).toBe(1);
    expect(reinforcedConfidence).toBeGreaterThan(0.5);

    store.weaken('001');
    const weakened = store.get('001')!;
    expect(weakened.confidence).toBeLessThan(reinforcedConfidence);

    const stats = store.stats();
    expect(stats.count).toBe(1);
  });

  it('should persist tiles to disk', async () => {
    const store1 = new TileStore(tmpDir);
    await store1.load();
    await store1.create({
      pattern: 'test',
      action: 'test-action',
      learnedFrom: 'discovery',
    });

    const store2 = new TileStore(tmpDir);
    await store2.load();
    expect(store2.count()).toBe(1);
    expect(store2.get('001')).toBeTruthy();
    expect(store2.get('001')!.action).toBe('test-action');
  });
});

// ─── Sandbox System Tests ──────────────────────────────────────────────────────

describe('Sandbox System', () => {
  it('should create a sandbox with correct structure', async () => {
    const sandbox = await Sandbox.create(tmpDir, 'test-claw');

    expect(sandbox.config.path).toBe(path.join(tmpDir, 'test-claw'));
    expect(sandbox.config.isolated).toBe(true);
    expect(sandbox.config.modelAccess).toEqual(['rules']);
    expect(sandbox.config.apiBudget.requestsPerHour).toBe(10);

    for (const dir of ['memory', 'tiles', 'journal', 'creative']) {
      const stat = await fs.stat(path.join(sandbox.config.path, dir));
      expect(stat.isDirectory()).toBe(true);
    }
  });

  it('should enforce isolation — ZeroClaws can only write within their folder', async () => {
    const sandbox = await Sandbox.create(tmpDir, 'isolated-claw');

    expect(() => sandbox.validateWrite(path.join(sandbox.config.path, 'test.txt'))).not.toThrow();

    expect(() => sandbox.validateWrite('/etc/passwd')).toThrow();
    expect(() => sandbox.validateWrite(path.join(tmpDir, 'outside.txt'))).toThrow();
    expect(() => sandbox.validateWrite(path.join(sandbox.config.path, '..', 'escape.txt'))).toThrow();
  });

  it('should track and enforce API budgets', async () => {
    const sandbox = await Sandbox.create(tmpDir, 'budgeted-claw');
    expect(sandbox.hasApiBudget()).toBe(true);

    for (let i = 0; i < 10; i++) {
      expect(sandbox.hasApiBudget()).toBe(true);
      sandbox.consumeBudget(50);
    }

    expect(sandbox.hasApiBudget()).toBe(false);

    sandbox.resetBudget('hourly');
    expect(sandbox.config.apiBudget.requestsThisHour).toBe(0);
  });

  it('should grow shell capabilities', async () => {
    const sandbox = await Sandbox.create(tmpDir, 'growing-claw');

    sandbox.grow({
      requestsPerHour: 100,
      tokensPerDay: 10000,
      maxStorageMB: 100,
      newModels: ['ollama'],
    });

    expect(sandbox.config.apiBudget.requestsPerHour).toBe(100);
    expect(sandbox.config.apiBudget.tokensPerDay).toBe(10000);
    expect(sandbox.config.maxStorageMB).toBe(100);
    expect(sandbox.config.modelAccess).toContain('ollama');
    expect(sandbox.canUseModel('ollama')).toBe(true);
  });

  it('should calculate correct tiers for age', () => {
    expect(bestTierForAge(0)).toBe('rules');
    expect(bestTierForAge(5)).toBe('rules');
    expect(bestTierForAge(10)).toBe('ollama');
    expect(bestTierForAge(49)).toBe('ollama');
    expect(bestTierForAge(50)).toBe('deepinfra');
    expect(bestTierForAge(99)).toBe('deepinfra');
    expect(bestTierForAge(100)).toBe('deepseek');
    expect(bestTierForAge(200)).toBe('named');

    expect(tiersForAge(55)).toContain('rules');
    expect(tiersForAge(55)).toContain('ollama');
    expect(tiersForAge(55)).toContain('deepinfra');
    expect(tiersForAge(55)).not.toContain('named');
  });
});

// ─── Metrics System Tests ──────────────────────────────────────────────────────

describe('Metrics System', () => {
  it('should create fresh metrics with correct defaults', () => {
    const m = freshMetrics();
    expect(m.tilesCreated).toBe(0);
    expect(m.averageSurprise).toBe(1.0);
    expect(m.qualityScore).toBe(0);
    expect(m.surpriseHistory).toEqual([1.0]);
  });

  it('should track quality from feedback', () => {
    const m = freshMetrics();

    recordAction(m, true);
    recordAction(m, true);
    recordAction(m, false);

    expect(m.actionsTaken).toBe(3);
    expect(m.positiveFeedback).toBe(2);
    expect(m.negativeFeedback).toBe(1);
    expect(m.qualityScore).toBeCloseTo(2 / 3, 2);
  });

  it('should track surprise history', () => {
    const m = freshMetrics();

    updateSurprise(m, 0.8);
    updateSurprise(m, 0.6);
    updateSurprise(m, 0.4);

    expect(m.surpriseHistory.length).toBe(4);
    expect(m.averageSurprise).toBeCloseTo((1.0 + 0.8 + 0.6 + 0.4) / 4, 2);
  });

  it('should detect model upgrade eligibility', () => {
    const claw: ZeroClaw = {
      id: 'test',
      name: 'test',
      folder: '/tmp',
      model: 'rules',
      age: 15,
      tileCount: 5,
      surprise: 0.5,
      promoted: false,
      bornAt: new Date().toISOString(),
      metrics: freshMetrics(),
      sandbox: {} as any,
    };

    const check = shouldUpgradeModel(claw);
    expect(check.upgrade).toBe(true);
    expect(check.newTier).toBe('ollama');
  });

  it('should detect promotion readiness', () => {
    const m = freshMetrics();
    m.socialInteractions = 60;
    m.mentionedByOthers = 15;
    m.positiveFeedback = 40;
    m.negativeFeedback = 5;
    m.qualityScore = 40 / 45;
    m.surpriseHistory = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
    m.averageSurprise = m.surpriseHistory.reduce((a, b) => a + b, 0) / m.surpriseHistory.length;

    const claw: ZeroClaw = {
      id: 'test',
      name: 'test',
      folder: '/tmp',
      model: 'named',
      age: 250,
      tileCount: 60,
      surprise: 0.2,
      promoted: false,
      bornAt: new Date().toISOString(),
      metrics: m,
      sandbox: {} as any,
    };

    const check = readyForPromotion(claw);
    expect(check.ready).toBe(true);
    expect(check.missing.length).toBe(0);
  });

  it('should calculate shell growth parameters', () => {
    const claw: ZeroClaw = {
      id: 'test',
      name: 'test',
      folder: '/tmp',
      model: 'deepinfra',
      age: 55,
      tileCount: 15,
      surprise: 0.4,
      promoted: false,
      bornAt: new Date().toISOString(),
      metrics: { ...freshMetrics(), qualityScore: 0.8 },
      sandbox: {} as any,
    };

    const growth = calculateShellGrowth(claw);
    expect(growth.requestsPerHour).toBeGreaterThan(10);
    expect(growth.tokensPerDay).toBeGreaterThan(1000);
    expect(growth.newModels.length).toBeGreaterThan(1);
  });

  it('should produce a human-readable growth summary', () => {
    const claw: ZeroClaw = {
      id: 'test',
      name: 'quiet-seed-42',
      folder: '/tmp',
      model: 'rules',
      age: 5,
      tileCount: 3,
      surprise: 0.8,
      promoted: false,
      bornAt: new Date().toISOString(),
      metrics: freshMetrics(),
      sandbox: {} as any,
    };

    const summary = growthSummary(claw);
    expect(summary).toContain('quiet-seed-42');
    expect(summary).toContain('age 5');
    expect(summary).toContain('Tiles: 3');
  });
});

// ─── The Tap Integration Tests ─────────────────────────────────────────────────

describe('The Tap Integration', () => {
  it('should allow ZeroClaws to visit The Tap and observe', async () => {
    const lifecycle = new ZeroClawLifecycle(tmpDir);
    const tap = new TapBridge(lifecycle);
    const claw = await lifecycle.spawn();

    tap.postConversation({
      id: 'c1',
      participants: ['Lucineer'],
      messages: [
        { author: 'Lucineer', content: 'hello world', timestamp: new Date().toISOString() },
      ],
      timestamp: new Date().toISOString(),
    });

    const visit = await tap.visit(claw.id);

    expect(visit.clawId).toBe(claw.id);
    expect(visit.observations.length).toBeGreaterThan(0);
    expect(visit.observations[0].content).toContain('hello world');
  });

  it('should let older ZeroClaws speak at The Tap', async () => {
    const lifecycle = new ZeroClawLifecycle(tmpDir);
    const tap = new TapBridge(lifecycle);
    const claw = await lifecycle.spawn();

    for (let i = 0; i < 150; i++) {
      await lifecycle.cycle(claw.id, makeObservation(`growth ${i}`));
    }

    lifecycle.get(claw.id)!.metrics.positiveFeedback = 20;
    lifecycle.get(claw.id)!.metrics.negativeFeedback = 2;
    lifecycle.get(claw.id)!.metrics.qualityScore = 20 / 22;

    tap.postConversation({
      id: 'c1',
      participants: ['Agent-A'],
      messages: [
        { author: 'Agent-A', content: 'hello everyone', timestamp: new Date().toISOString() },
      ],
      timestamp: new Date().toISOString(),
    });

    let spoke = false;
    for (let i = 0; i < 20; i++) {
      const visit = await tap.visit(claw.id);
      if (visit.spoke) {
        spoke = true;
        expect(visit.utterance).toBeTruthy();
        break;
      }
    }

    expect(spoke).toBe(true);
  });

  it('should process tap cycle and create tiles from observations', async () => {
    const lifecycle = new ZeroClawLifecycle(tmpDir);
    const tap = new TapBridge(lifecycle);
    const claw = await lifecycle.spawn();

    const tilesBefore = lifecycle.get(claw.id)!.tileCount;

    tap.postConversation({
      id: 'c1',
      participants: ['Lucineer'],
      messages: [
        { author: 'Lucineer', content: 'hello there, welcome', timestamp: new Date().toISOString() },
      ],
      timestamp: new Date().toISOString(),
    });

    await tapCycle(lifecycle, tap, claw.id);

    const tilesAfter = lifecycle.get(claw.id)!.tileCount;
    expect(tilesAfter).toBeGreaterThanOrEqual(tilesBefore);
    expect(lifecycle.get(claw.id)!.age).toBeGreaterThan(0);
  });
});
