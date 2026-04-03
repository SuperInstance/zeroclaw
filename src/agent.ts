// agent.ts — The core agent loop: think → act → observe → learn
import { Skill } from './skills.js';
import { Equipment } from './equipment.js';
import { Soul } from './soul.js';
import { IO } from './io.js';

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

  constructor(soul: Soul, io: IO) {
    this.soul = soul;
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

  // Think: analyze current state, decide what to do
  private think(input: string): string {
    let context = input;
    for (const skill of this.state.skills.values()) {
      context = skill.think(context);
    }
    context += `\n[soul: ${this.state.soul.personality}]`;
    context += `\n[memory: ${this.state.memory.slice(-10).join(' | ')}]`;
    return context;
  }

  // Act: execute skill or use equipment
  private async act(plan: string): Promise<string> {
    // Try to match an equipment action
    for (const eq of this.state.equipment.values()) {
      if (plan.toLowerCase().includes(eq.name.toLowerCase())) {
        return JSON.stringify(await eq.use('execute', { plan }));
      }
    }
    // Default: use repo I/O
    return await this.io.exec(plan);
  }

  // Observe: read results, update state
  private observe(result: string): void {
    this.state.memory.push(result);
    if (this.state.memory.length > 100) {
      this.state.memory = this.state.memory.slice(-50);
    }
  }

  // Learn: persist insights back to repo
  private async learn(insight: string): Promise<void> {
    const ts = new Date().toISOString();
    await this.io.write(`memory/${ts}.md`, insight);
    await this.io.gitCommit(`learn: ${insight.slice(0, 72)}`);
  }

  // The loop
  async run(input: string): Promise<string> {
    const thought = this.think(input);
    const result = await this.act(thought);
    this.observe(result);
    await this.learn(`[${input}] → [${result.slice(0, 100)}]`);
    return result;
  }

  startREPL(): void {
    this.running = true;
    const rl = { stdin: process.stdin, stdout: process.stdout };
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
