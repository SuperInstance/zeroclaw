// agent.ts — The core agent loop: think → act → observe → learn
// Phase 3: tile composition drives each phase with typed confidence
import { Skill } from './skills.js';
import { Equipment } from './equipment.js';
import { Soul } from './soul.js';
import { IO } from './io.js';
import {
  Tile, TileType, createTile, composeTiles, recordTile,
  selectModelForTile, getTileHistory, confidenceBreakdown, tokenUsage,
} from './lib/tile-algebra.js';
import * as cache from './lib/tile-cache.js';

export { getTileHistory, confidenceBreakdown, tokenUsage };

export interface AgentState {
  skills: Map<string, Skill>;
  equipment: Map<string, Equipment>;
  soul: Soul;
  memory: string[];
}

export class Agent {
  state: AgentState;
  private io: IO;
  private running = false;
  private lastComposition: Tile | null = null;

  constructor(soul: Soul, io: IO) {
    this.io = io;
    this.state = {
      skills: new Map(),
      equipment: new Map(),
      soul,
      memory: [],
    };
  }

  addSkill(skill: Skill): void {
    skill.load();
    this.state.skills.set(skill.name, skill);
  }

  removeSkill(name: string): void {
    this.state.skills.get(name)?.unload();
    this.state.skills.delete(name);
  }

  addEquipment(eq: Equipment): void {
    this.state.equipment.set(eq.name, eq);
  }

  removeEquipment(name: string): void {
    this.state.equipment.delete(name);
  }

  // Think: analyze current state, decide what to do — backed by reasoning tile
  private think(input: string): { enriched: string; tile: Tile } {
    const cached = cache.get('reasoning', input);
    if (cached) return { enriched: cached.output ?? input, tile: cached };

    let context = input;
    for (const skill of this.state.skills.values()) {
      context = skill.think(context);
    }
    context += `\n[soul: ${this.state.soul.personality}]`;
    context += `\n[memory: ${this.state.memory.slice(-10).join(' | ')}]`;

    const model = selectModelForTile(0.7);
    const tile = createTile('reasoning', 'think', input, 0.8, model.name);
    tile.output = context;
    tile.tokens = context.length;
    cache.set('reasoning', input, tile);
    recordTile(tile);

    return { enriched: context, tile };
  }

  // Act: execute skill or use equipment — backed by generation tile
  private async act(plan: string): Promise<{ result: string; tile: Tile }> {
    const cached = cache.get('generation', plan);
    if (cached) return { result: cached.output ?? '', tile: cached };

    let result = '';
    let matched = false;
    for (const eq of this.state.equipment.values()) {
      if (plan.toLowerCase().includes(eq.name.toLowerCase())) {
        result = JSON.stringify(await eq.use('execute', { plan }));
        matched = true;
        break;
      }
    }
    if (!matched) {
      result = await this.io.exec(plan);
    }

    const model = selectModelForTile(0.6);
    const tile = createTile('generation', 'act', plan, 0.75, model.name);
    tile.output = result;
    tile.tokens = result.length;
    cache.set('generation', plan, tile);
    recordTile(tile);

    return { result, tile };
  }

  // Observe: read results, update state — backed by validation tile
  private observe(result: string): Tile {
    const tile = createTile('validation', 'observe', result, 0.9);
    tile.output = `observed: ${result.slice(0, 200)}`;
    tile.tokens = result.length;

    this.state.memory.push(result);
    if (this.state.memory.length > 100) {
      this.state.memory = this.state.memory.slice(-50);
    }
    recordTile(tile);
    return tile;
  }

  // Learn: persist insights back to repo — backed by storage tile
  private async learn(insight: string): Promise<Tile> {
    const ts = new Date().toISOString();
    await this.io.write(`memory/${ts}.md`, insight);
    await this.io.gitCommit(`learn: ${insight.slice(0, 72)}`);

    const tile = createTile('storage', 'learn', insight, 0.95);
    tile.output = `persisted: memory/${ts}.md`;
    tile.tokens = insight.length;
    recordTile(tile);
    return tile;
  }

  // The loop — compose all phases into a single tile pipeline
  async run(input: string): Promise<string> {
    const { enriched, tile: thinkTile } = this.think(input);
    const { result, tile: actTile } = await this.act(enriched);
    const observeTile = this.observe(result);
    const learnTile = await this.learn(`[${input}] → [${result.slice(0, 100)}]`);

    this.lastComposition = composeTiles(`run: ${input.slice(0, 60)}`, [
      thinkTile, actTile, observeTile, learnTile,
    ]);
    return result;
  }

  /** Return the last composed tile pipeline for inspection. */
  getLastComposition(): Tile | null {
    return this.lastComposition;
  }

  startREPL(): void {
    this.running = true;
    process.stdout.write('🐾 ZeroClaw> ');
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (data: string) => {
      const line = data.trim();
      if (line === 'exit' || line === 'quit') {
        this.running = false;
        process.exit(0);
      }
      try {
        const result = await this.run(line);
        process.stdout.write(result + '\n🐾 ZeroClaw> ');
      } catch (e) {
        process.stdout.write(`Error: ${e}\n🐾 ZeroClaw> `);
      }
    });
  }
}
