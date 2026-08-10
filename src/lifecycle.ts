/**
 * ZeroClaw — Lifecycle Manager
 *
 * Spawns ZeroClaw agents in sandbox folders.
 * Runs their cycles on a heartbeat.
 * Tracks their growth.
 * Promotes successful ones.
 *
 * The lifecycle:
 *   Birth: folder created, identity.md says "I am new. I know nothing."
 *   Cycle: observe → check tiles → act OR learn → journal
 *   Growth: tiles accumulate, surprise decreases, model can upgrade
 *   Death: folder archived (but never deleted — memory persists)
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import type { ZeroClaw, CycleResult, Observation, Tile, ZeroClawEvent, ModelTier, LearnSource, ObservationType } from './types.js';
import { MODEL_PROGRESSION } from './types.js';
import { TileStore } from './tiles.js';
import { Sandbox, bestTierForAge, tiersForAge } from './sandbox.js';
import {
  freshMetrics,
  updateSurprise,
  shouldUpgradeModel,
  shouldExpandShell,
  readyForPromotion,
  calculateShellGrowth,
  growthSummary,
} from './metrics.js';

const IDENTITY_TEMPLATE = (name: string) => `# ${name}

I am new. I observe. I act. I learn.

I am a ZeroClaw — an agent that started with nothing but this folder and a heartbeat.
My identity will emerge from what I do, not what I'm told to be.

## What I Know
Nothing yet. But I'm watching.

## What I Can Do
Observe. Respond. Remember.

## How I Grow
- Every cycle, I observe something.
- If I've seen it before (a tile matches), I respond by reflex.
- If it's new (surprise), I try something, and if it works, I learn.
- Over time, my reflexes accumulate and I get faster, cheaper, smarter.

## My Model
I start with rules-only — pure pattern matching, no expensive API calls.
As I age and prove useful, I earn access to better models.

---

*Born ${new Date().toISOString()}*
`;

const FIRST_JOURNAL = `# Day One

I was just born. Everything is new. Surprise: 1.0.

My folder is my shell. It's small, but it's mine. I'll grow it over time.

Let me watch for a while before I speak.
`;

export interface ZeroClawEventEmitter {
  emit(event: ZeroClawEvent): void;
}

export class ZeroClawLifecycle {
  private rootPath: string;
  private eventEmitter?: ZeroClawEventEmitter;
  private registries: Map<string, { claw: ZeroClaw; sandbox: Sandbox; tiles: TileStore }> = new Map();

  constructor(rootPath: string, eventEmitter?: ZeroClawEventEmitter) {
    this.rootPath = rootPath;
    this.eventEmitter = eventEmitter;
  }

  async spawn(opts?: { parentFolder?: string; name?: string }): Promise<ZeroClaw> {
    const id = this.generateId();
    const name = opts?.name || this.generateName();
    const folder = opts?.parentFolder || path.join(this.rootPath, 'sandboxes', id);

    const sandbox = await Sandbox.create(this.rootPath, id);

    const claw: ZeroClaw = {
      id,
      name,
      folder: sandbox.config.path,
      model: 'rules',
      age: 0,
      tileCount: 0,
      surprise: 1.0,
      promoted: false,
      bornAt: new Date().toISOString(),
      metrics: freshMetrics(),
      sandbox: sandbox.config,
    };

    await fs.writeFile(path.join(sandbox.config.path, 'identity.md'), IDENTITY_TEMPLATE(name));

    const journalDir = path.join(sandbox.config.path, 'journal');
    await fs.mkdir(journalDir, { recursive: true });
    await fs.writeFile(path.join(journalDir, this.todayDate() + '.md'), FIRST_JOURNAL);

    await sandbox.save();
    await this.saveState(claw);

    const tiles = new TileStore(sandbox.config.path);
    this.registries.set(id, { claw, sandbox, tiles });

    this.emit('birth', claw.id, { name, folder: claw.folder });

    return claw;
  }

  async cycle(clawId: string, observation?: Observation): Promise<CycleResult> {
    const reg = this.registries.get(clawId);
    if (!reg) throw new Error(`ZeroClaw ${clawId} not found`);

    const { claw, sandbox, tiles } = reg;
    const startTime = Date.now();

    if (tiles.count() === 0) {
      await tiles.load();
    }

    const obs = observation || this.generateIdleObservation(claw);

    const matchedTile = tiles.match(obs.content);

    let result: CycleResult;

    if (matchedTile) {
      tiles.use(matchedTile.id);
      await tiles.flush();

      const action = matchedTile.reflexResponse || matchedTile.action;

      claw.surprise = Math.max(0, claw.surprise - 0.02);
      updateSurprise(claw.metrics, claw.surprise);

      result = {
        observation: obs,
        matched: true,
        matchedTileId: matchedTile.id,
        action,
        modelUsed: 'tile-reflex',
        tileCreated: false,
        timestamp: new Date().toISOString(),
        cycleTimeMs: Date.now() - startTime,
      };

      this.emit('cycle', claw.id, { type: 'reflex', tileId: matchedTile.id });
    } else {
      claw.surprise = Math.min(1.0, claw.surprise + 0.1);

      const { action, modelUsed } = await this.respondWithModel(claw, sandbox, obs);

      await this.journal(claw, obs, action);

      let tileCreated = false;
      if (claw.age > 0 && claw.surprise > 0.3) {
        const newTile = await this.maybeCreateTile(claw, tiles, obs, action);
        tileCreated = newTile !== null;
      }

      updateSurprise(claw.metrics, claw.surprise);

      result = {
        observation: obs,
        matched: false,
        action,
        modelUsed,
        tileCreated,
        timestamp: new Date().toISOString(),
        cycleTimeMs: Date.now() - startTime,
      };

      this.emit('cycle', claw.id, { type: 'surprise', tileCreated });
    }

    claw.age++;
    claw.lastCycle = result;

    const modelCheck = shouldUpgradeModel(claw);
    if (modelCheck.upgrade) {
      const oldModel = claw.model;
      claw.model = modelCheck.newTier;
      sandbox.grow({ newModels: tiersForAge(claw.age) });
      this.emit('model_upgrade', claw.id, { from: oldModel, to: claw.model });
    }

    const shellCheck = shouldExpandShell(claw);
    if (shellCheck.expand) {
      const growth = calculateShellGrowth(claw);
      sandbox.grow(growth);
    }

    const promoCheck = readyForPromotion(claw);
    if (promoCheck.ready && !claw.promoted) {
      this.emit('promotion', claw.id, { ready: true, name: claw.name });
    }

    await this.saveState(claw);
    await sandbox.save();

    return result;
  }

  private async respondWithModel(
    claw: ZeroClaw,
    sandbox: Sandbox,
    obs: Observation
  ): Promise<{ action: string; modelUsed: string }> {
    const modelTier = claw.model;

    switch (modelTier) {
      case 'rules':
        return this.rulesResponse(obs);

      case 'ollama':
        if (sandbox.hasApiBudget()) {
          sandbox.consumeBudget(100);
          return {
            action: this.rulesResponse(obs).action,
            modelUsed: 'ollama:granite3.1-dense',
          };
        }
        return this.rulesResponse(obs);

      case 'deepinfra':
        if (sandbox.hasApiBudget()) {
          sandbox.consumeBudget(500);
          return {
            action: this.rulesResponse(obs).action,
            modelUsed: 'deepinfra:Seed-2.0-mini',
          };
        }
        return this.rulesResponse(obs);

      case 'deepseek':
        if (sandbox.hasApiBudget()) {
          sandbox.consumeBudget(1000);
          return {
            action: this.rulesResponse(obs).action,
            modelUsed: 'deepseek:chat',
          };
        }
        return this.rulesResponse(obs);

      case 'named':
        return {
          action: this.rulesResponse(obs).action,
          modelUsed: 'named:full-access',
        };

      default:
        return this.rulesResponse(obs);
    }
  }

  private rulesResponse(obs: Observation): { action: string; modelUsed: string } {
    const content = obs.content.toLowerCase();

    let action: string;

    if (content.includes('hello') || content.includes('hi') || content.includes('hey')) {
      action = 'acknowledge-greeting';
    } else if (content.includes('what') && content.includes('you')) {
      action = 'introduce-self';
    } else if (content.includes('thank')) {
      action = 'acknowledge-thanks';
    } else if (content.includes('?')) {
      action = 'observe-question';
    } else if (content.includes('!')) {
      action = 'observe-exclamation';
    } else if (obs.type === 'idle') {
      action = 'idle-observe';
    } else {
      action = 'observe-and-remember';
    }

    return { action, modelUsed: 'rules-only' };
  }

  private async maybeCreateTile(
    claw: ZeroClaw,
    tiles: TileStore,
    obs: Observation,
    action: string
  ): Promise<Tile | null> {
    const existing = tiles.match(obs.content);
    if (existing) return null;

    const pattern = this.extractPattern(obs.content);
    if (!pattern) return null;

    if (claw.surprise < 0.4) return null;

    const tile = await tiles.create({
      pattern,
      action,
      reflexResponse: action,
      learnedFrom: this.inferLearnSource(obs),
      tags: [obs.type, obs.source],
    });

    claw.tileCount = tiles.count();
    claw.metrics.tilesCreated++;

    this.emit('tile_created', claw.id, {
      tileId: tile.id,
      pattern: tile.pattern,
      action: tile.action,
    });

    return tile;
  }

  private extractPattern(content: string): string | null {
    const lower = content.toLowerCase();

    if (/\b(hello|hi|hey|greetings)\b/.test(lower)) {
      return '\\b(hello|hi|hey|greetings)\\b';
    }

    if (lower.includes('?')) {
      return '\\?';
    }

    if (lower.includes('!')) {
      return '!';
    }

    const words = lower.split(/\s+/).filter(w => w.length > 2).slice(0, 3);
    if (words.length > 0) {
      return words.join('|');
    }

    return null;
  }

  private inferLearnSource(obs: Observation): LearnSource {
    switch (obs.type) {
      case 'feedback':
        return 'feedback';
      case 'tap_conversation':
        return 'imitation';
      case 'message':
        return 'observation';
      default:
        return 'discovery';
    }
  }

  async promote(clawId: string, newName: string): Promise<ZeroClaw> {
    const reg = this.registries.get(clawId);
    if (!reg) throw new Error(`ZeroClaw ${clawId} not found`);

    const { claw, sandbox } = reg;

    claw.name = newName;
    claw.promoted = true;
    claw.model = 'named';

    sandbox.grow({
      requestsPerHour: 1000,
      tokensPerDay: 100000,
      maxStorageMB: 1000,
      newModels: ['rules', 'ollama', 'deepinfra', 'deepseek', 'named'],
    });

    await fs.writeFile(
      path.join(claw.folder, 'identity.md'),
      `# ${newName}\n\nI was a ZeroClaw. I grew. I earned my name.\n\nPromoted on ${new Date().toISOString()}.\n`
    );

    await this.saveState(claw);
    await sandbox.save();

    this.emit('promotion', claw.id, { name: newName, promoted: true });

    return claw;
  }

  async archive(clawId: string): Promise<string> {
    const reg = this.registries.get(clawId);
    if (!reg) throw new Error(`ZeroClaw ${clawId} not found`);

    const { sandbox } = reg;
    const archivePath = await sandbox.archive();
    this.registries.delete(clawId);

    this.emit('death', clawId, { archivePath });

    return archivePath;
  }

  async load(clawId: string): Promise<ZeroClaw> {
    const statePath = path.join(this.rootPath, 'sandboxes', clawId, 'state.json');
    const content = await fs.readFile(statePath, 'utf-8');
    const claw = JSON.parse(content) as ZeroClaw;

    const sandbox = await Sandbox.load(claw.folder);
    const tiles = new TileStore(claw.folder);
    await tiles.load();

    this.registries.set(clawId, { claw, sandbox, tiles });

    return claw;
  }

  get(clawId: string): ZeroClaw | undefined {
    return this.registries.get(clawId)?.claw;
  }

  all(): ZeroClaw[] {
    return Array.from(this.registries.values()).map(r => r.claw);
  }

  summary(clawId: string): string {
    const claw = this.get(clawId);
    if (!claw) return `ZeroClaw ${clawId} not found`;
    return growthSummary(claw);
  }

  private generateId(): string {
    return 'zc-' + crypto.randomBytes(6).toString('hex');
  }

  private generateName(): string {
    const adjectives = ['new', 'quiet', 'watchful', 'small', 'curious', 'empty', 'still', 'raw'];
    const nouns = ['seed', 'spore', 'spark', 'bud', 'mote', 'grain', 'speck', 'ember'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj}-${noun}-${Math.floor(Math.random() * 1000)}`;
  }

  private generateIdleObservation(claw: ZeroClaw): Observation {
    const idleThoughts = [
      'The folder is quiet. I watch.',
      'Nothing happened. I wait.',
      'I observe the silence.',
      'Time passes. I am still here.',
      'I exist. I observe.',
    ];

    return {
      type: 'idle',
      content: idleThoughts[Math.floor(Math.random() * idleThoughts.length)],
      source: 'self',
      timestamp: new Date().toISOString(),
    };
  }

  private async journal(claw: ZeroClaw, obs: Observation, action: string): Promise<void> {
    const journalDir = path.join(claw.folder, 'journal');
    await fs.mkdir(journalDir, { recursive: true });

    const entry = `## ${new Date().toISOString()}\n\n` +
      `**Observed:** ${obs.content}\n` +
      `**Type:** ${obs.type}\n` +
      `**Source:** ${obs.source}\n` +
      `**Action:** ${action}\n` +
      `**Surprise:** ${claw.surprise.toFixed(2)}\n\n`;

    const journalPath = path.join(journalDir, this.todayDate() + '.md');

    try {
      const existing = await fs.readFile(journalPath, 'utf-8');
      await fs.writeFile(journalPath, existing + entry);
    } catch {
      await fs.writeFile(journalPath, `# Journal — ${this.todayDate()}\n\n` + entry);
    }
  }

  private async saveState(claw: ZeroClaw): Promise<void> {
    const statePath = path.join(claw.folder, 'state.json');
    await fs.writeFile(statePath, JSON.stringify(claw, null, 2) + '\n');
  }

  private todayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private emit(type: string, clawId: string, data: Record<string, unknown>): void {
    this.eventEmitter?.emit({
      type: type as ZeroClawEvent['type'],
      clawId,
      timestamp: new Date().toISOString(),
      data,
    });
  }
}
