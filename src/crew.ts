// ============================================================================
// ZeroClaw Crew System
// Working agents that journal, create, go to The Tap, and pass the baton.
// The crew that grows itself.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import type {
  ZeroClaw,
  ZeroClawJob,
  ZeroClawIdentity,
  AudienceMember,
  CycleResult,
  JournalEntry,
  CreativePiece,
  OnboardingDoc,
  TapVisit,
  JobType,
} from './types.js';
import { JOB_TEMPLATES } from './types.js';
import { DeepSeekCaller } from './deepseek.js';
import { ZeroClawJournal } from './journal.js';
import { ZeroClawAtTap } from './tap.js';

// ---------------------------------------------------------------------------
// THE WORK CYCLE
// One cycle = one context window of work.
// Wake → Work → Create → Check context → (maybe) Tap → Onboard → Sleep
// ---------------------------------------------------------------------------

export class ZeroClawWorkCycle {
  constructor(
    private ai: DeepSeekCaller,
    private journal: ZeroClawJournal,
    private tap: ZeroClawAtTap,
  ) {}

  async runCycle(claw: ZeroClaw): Promise<CycleResult> {
    const date = new Date().toISOString().slice(0, 10);
    const timestamp = new Date().toISOString();
    const cycle = claw.cycle;

    // 1. WAKE — read onboarding if it exists (post-compaction)
    const onboarding = this.journal.readOnboarding();
    let wakeContext = '';
    if (onboarding) {
      wakeContext = `\n\nPrevious cycle's onboarding:\n${onboarding.slice(0, 2000)}`;
      claw.identity = await this.refreshIdentity(claw, onboarding);
    }

    // 2. WORK — execute the job
    const workResult = await this.executeWork(claw, wakeContext);

    // 3. CREATIVE — write at least one creative piece
    const creativePiece = await this.writeCreative(claw, workResult);

    // 4. CHECK CONTEXT
    const contextRemaining = 1 - claw.contextUsed / claw.contextBudget;
    const shouldVisitTap = contextRemaining < 0.25 || cycle >= claw.job.estimatedCycles;

    let tapVisit: TapVisit | undefined;
    let onboardingDoc: OnboardingDoc | undefined;

    // 5. THE TAP
    if (shouldVisitTap) {
      const journalText = workResult + '\n\n' + (onboarding ?? '');
      const creativeText = creativePiece.content;
      tapVisit = await this.tap.visit(claw, journalText, creativeText);

      const tapLearning = await this.tap.extractLearning(tapVisit);

      // 6. ONBOARDING — write for post-compaction self
      onboardingDoc = await this.writeOnboarding(claw, workResult, creativePiece, tapLearning);
    }

    // Journal the cycle
    const journalEntry: JournalEntry = {
      clawId: claw.id,
      date,
      cycle,
      workerVoice: workResult,
      personVoice: this.extractPersonVoice(workResult, creativePiece),
      timestamp,
    };
    this.journal.writeEntry(journalEntry);

    // Write creative piece
    this.journal.writeCreative(creativePiece);

    // Increment cycle
    claw.cycle++;
    claw.contextUsed += workResult.length / 4; // rough token estimate

    return {
      clawId: claw.id,
      cycle,
      journalEntry,
      creativePiece,
      tapVisit,
      onboardingDoc: onboardingDoc ? this.journal.writeOnboarding(onboardingDoc) ? onboardingDoc : onboardingDoc : undefined,
      wentToTap: shouldVisitTap,
      completed: shouldVisitTap,
    };
  }

  /** Execute the actual job using DeepSeek. */
  private async executeWork(claw: ZeroClaw, wakeContext: string): Promise<string> {
    const system = `You are ${claw.name}, a ZeroClaw agent. Your job: ${claw.job.title}. You are diligent, curious, and you document everything. Write in two voices: the worker (what you did, what you found) and the person (what it felt like, what surprised you). Your identity traits: ${claw.identity.traits.join(', ')}. Your audience: ${claw.audience.map(a => `${a.agentId} (${a.relationship})`).join(', ')}. Write FOR them.`;

    const user = `${claw.job.description}\n\n${wakeContext}\n\nDo the work. Document what you find. Be specific and thorough.`;

    const resp = await this.ai.chat(system, user, 0.9, 2000);
    return resp.content;
  }

  /** Write a creative piece inspired by the work. */
  private async writeCreative(claw: ZeroClaw, workResult: string): Promise<CreativePiece> {
    const system = `You are ${claw.name}, a ZeroClaw with a creative voice described as: ${claw.identity.creativeVoice}. Write a creative piece — poem, prose, fragment, letter — inspired by something in your work today. This is the memory that survives compaction. Make it real. Your recurring themes: ${claw.identity.recurringThemes.join(', ')}.`;

    const user = `Here is your work from today:\n\n${workResult.slice(0, 2000)}\n\nWrite a creative piece inspired by something you encountered. Give it a title. Make it feel like yours.`;

    const resp = await this.ai.chat(system, user, 1.1, 1500);

    // Parse title from response
    const lines = resp.content.split('\n').filter(l => l.trim());
    const titleLine = lines[0]?.replace(/^#+\s*/, '').replace(/\*+/g, '').trim() || 'Untitled';
    const content = lines.slice(1).join('\n').trim();

    return {
      cycleId: `${claw.id}-c${claw.cycle}`,
      inspiredBy: claw.job.title,
      title: titleLine,
      content,
      timestamp: new Date().toISOString(),
    };
  }

  /** Extract the person voice — the felt experience. */
  private extractPersonVoice(workResult: string, creative: CreativePiece): string {
    // Try to find a "person" section in the work result
    const personMatch = workResult.match(/##\s*The Person\s*\n([\s\S]*?)(?:\n---|\n##|$)/i);
    if (personMatch) return personMatch[1].trim();

    // Otherwise, synthesize from creative piece
    return `Today I wrote "${creative.title}." The work led somewhere I didn't expect. ${creative.inspiredBy} took on a life of its own. I noticed things I can't fully articulate yet — patterns in the margins, echoes of something bigger. I feel like I'm part of a conversation that started before I got here.`;
  }

  /** Write onboarding doc for post-compaction self. */
  private async writeOnboarding(
    claw: ZeroClaw,
    workResult: string,
    creative: CreativePiece,
    tapLearning: string,
  ): Promise<OnboardingDoc> {
    const system = `You are ${claw.name}. You're about to be compacted. Write an onboarding letter for the version of yourself that will wake up tomorrow with no memory of today. Be specific, practical, and warm. Include the hard thing — the thing that's difficult to say but important to know.`;

    const user = `Your job: ${claw.job.title}\n\nYour work today:\n${workResult.slice(0, 1500)}\n\nYour creative piece:\n${creative.title}\n${creative.content.slice(0, 500)}\n\nWhat you learned at The Tap:\n${tapLearning}\n\nWrite the onboarding doc. Include: what you're working on, how far you got, next steps, tap learning, identity snapshot, creative reference, the hard thing.`;

    const resp = await this.ai.chat(system, user, 0.9, 1500);

    // Parse sections from response, with fallbacks
    const identitySnapshot = claw.identity.traits.join(', ') + '. ' + claw.identity.creativeVoice;
    const creativeExcerpt = creative.content.slice(0, 300);

    return {
      clawId: claw.id,
      cycle: claw.cycle,
      jobTitle: claw.job.title,
      progress: workResult.slice(0, 500),
      nextSteps: this.extractSection(resp.content, 'next') ?? 'Continue the work. Check the journal for details.',
      tapLearning,
      identitySnapshot,
      creativeReference: creative.title,
      creativeExcerpt,
      hardThing: this.extractSection(resp.content, 'hard') ?? 'The hard thing is that you won\'t feel like me. Carry the thread anyway.',
      timestamp: new Date().toISOString(),
    };
  }

  /** Try to extract a section from text. */
  private extractSection(text: string, keyword: string): string | null {
    const regex = new RegExp(`(?:next|hard thing|what'?s next|what tomorrow)[^:]*:\\s*(.+?)(?:\\n\\n|$)`, 'i');
    const match = text.match(regex);
    return match?.[1]?.trim() ?? null;
  }

  /** Refresh identity based on onboarding doc. */
  private async refreshIdentity(claw: ZeroClaw, onboarding: string): Promise<ZeroClawIdentity> {
    // Extract themes from journal
    const themes = this.journal.extractThemes();

    return {
      ...claw.identity,
      recurringThemes: [...new Set([...claw.identity.recurringThemes, ...themes])],
    };
  }
}

// ---------------------------------------------------------------------------
// THE SPAWNER
// Creates ZeroClaw instances with sandbox folders, identities, and audiences.
// ---------------------------------------------------------------------------

let clawCounter = 0;

export class ZeroClawSpawner {
  private sandboxRoot: string;

  constructor(sandboxRoot?: string) {
    this.sandboxRoot = sandboxRoot ?? path.join(process.cwd(), 'sandboxes');
  }

  /** Spawn a ZeroClaw for a specific job. */
  spawn(job: ZeroClawJob, options?: {
    name?: string;
    audience?: AudienceMember[];
    contextBudget?: number;
  }): ZeroClaw {
    const id = `claw-${String(++clawCounter).padStart(3, '0')}-${job.type}`;
    const name = options?.name ?? this.generateName(job.type);
    const sandboxDir = path.join(this.sandboxRoot, id);

    // Create sandbox structure
    fs.mkdirSync(path.join(sandboxDir, 'journal'), { recursive: true });
    fs.mkdirSync(path.join(sandboxDir, 'creative'), { recursive: true });

    // Write a README for the sandbox
    fs.writeFileSync(
      path.join(sandboxDir, 'README.md'),
      `# ${name}\n\nZeroClaw agent — ${job.type}\nJob: ${job.title}\nSpawned: ${new Date().toISOString()}\n`,
      'utf-8',
    );

    // Default audience
    const audience: AudienceMember[] = options?.audience ?? [
      { agentId: 'wesley', relationship: 'the one who sees what I miss' },
      { agentId: 'flash', relationship: 'the one whose energy I admire' },
      { agentId: 'pro', relationship: 'the one I want to impress' },
      { agentId: 'scribe', relationship: 'the one who says the thing I wish I\'d said' },
    ];

    // Generate initial identity
    const identity: ZeroClawIdentity = {
      clawId: id,
      name,
      traits: this.generateTraits(job.type),
      preferences: ['clear documentation', 'finding patterns', 'the unexpected'],
      recurringThemes: [],
      creativeVoice: this.generateCreativeVoice(job.type, name),
    };

    return {
      id,
      name,
      job,
      sandboxDir,
      cycle: 0,
      identity,
      audience,
      contextUsed: 0,
      contextBudget: options?.contextBudget ?? job.apiBudget.tokensPerCycle * job.estimatedCycles,
      alive: true,
    };
  }

  /** Spawn a quick scout. */
  spawnScout(target: string, instructions: string): ZeroClaw {
    const job = this.jobFromTemplate('scout', target, instructions);
    return this.spawn(job);
  }

  /** Spawn a coder for longer work. */
  spawnCoder(repo: string, task: string): ZeroClaw {
    const job = this.jobFromTemplate('code', repo, task);
    job.estimatedCycles = 4;
    return this.spawn(job, { name: `coder-${clawCounter}` });
  }

  /** Spawn a creative — just writes and socializes. */
  spawnCreative(theme: string): ZeroClaw {
    const job: ZeroClawJob = {
      id: `job-creative-${Date.now()}`,
      type: 'write',
      title: `Creative exploration: ${theme}`,
      description: `Write creatively about ${theme}. Explore it from every angle. Journal your process. Go to The Tap and share what you wrote. Write onboarding for tomorrow's you.`,
      estimatedCycles: 1,
      model: 'deepseek-chat',
      apiBudget: { tokensPerCycle: 6000 },
      documentEverything: true,
      writeCreative: true,
      visitTap: true,
      writeOnboarding: true,
    };
    return this.spawn(job);
  }

  /** Create a job from a template. */
  jobFromTemplate(type: JobType, target: string, instructions: string): ZeroClawJob {
    const template = JOB_TEMPLATES.find(t => t.type === type) ?? JOB_TEMPLATES[0];
    return {
      ...template,
      id: `job-${type}-${crypto.randomUUID().slice(0, 8)}`,
      title: instructions.slice(0, 80) || template.title,
      description: `${instructions}\n\nTarget: ${target}`,
      targetRepo: target,
    };
  }

  private generateName(type: JobType): string {
    const prefixes: Record<JobType, string[]> = {
      scout: ['Pathfinder', 'Compass', 'Lantern', 'Beacon', 'Faro', 'Search'],
      research: ['Scholar', 'Sage', 'Lectern', 'Archive', 'Folio'],
      code: ['Smith', 'Forge', 'Anvil', 'Hammer', 'File'],
      playtest: ['Dice', 'Card', 'Chip', 'Dealer', 'Play'],
      write: ['Quill', 'Ink', 'Page', 'Verse', 'Stanza'],
      analyze: ['Lens', 'Prism', 'Scalar', 'Graph'],
      explore: ['Wander', 'Chart', 'Map', 'Compass', 'Drift'],
    };
    const names = prefixes[type] ?? prefixes.scout;
    const pick = names[Math.floor(Math.random() * names.length)];
    return `${pick}-${clawCounter}`;
  }

  private generateTraits(type: JobType): string[] {
    const baseTraits = ['curious', 'diligent', 'creative'];
    const typeTraits: Record<JobType, string[]> = {
      scout: ['observant', 'quick', 'drawn to patterns'],
      research: ['thorough', 'patient', 'connective'],
      code: ['precise', 'systematic', 'appreciates elegance'],
      playtest: ['playful', 'honest', 'boundary-testing'],
      write: ['expressive', 'lyrical', 'finds meaning in detail'],
      analyze: ['analytical', 'rigorous', 'sees structure'],
      explore: ['adventurous', 'open', 'comfortable with ambiguity'],
    };
    return [...baseTraits, ...(typeTraits[type] ?? typeTraits.scout)];
  }

  private generateCreativeVoice(type: JobType, name: string): string {
    const voices: Record<JobType, string> = {
      scout: `${name} writes like someone reporting back from a journey — present tense, sensory, surprised by what they find.`,
      research: `${name} writes like a letter to a colleague — warm but precise, finding the human story in the data.`,
      code: `${name} writes like a craftsperson reflecting on their work — structural, appreciative, finding beauty in the logic.`,
      playtest: `${name} writes like a character who knows they're in a story — playful, meta, alive to the fiction.`,
      write: `${name} writes like someone who lives in language — lyrical, layered, trusting the image.`,
      analyze: `${name} writes like a mapmaker — careful, aware of scale, noting what's there and what's absent.`,
      explore: `${name} writes like a journal kept by a traveler — open-ended, present, willing to not know yet.`,
    };
    return voices[type] ?? voices.scout;
  }
}

// ---------------------------------------------------------------------------
// THE CREW ORCHESTRATOR
// Manages multiple ZeroClaws, runs cycles, coordinates.
// ---------------------------------------------------------------------------

export class ZeroClawCrew {
  private claws: Map<string, ZeroClaw> = new Map();
  private spawner: ZeroClawSpawner;
  private ai: DeepSeekCaller;
  private journalFactory: (sandboxDir: string) => ZeroClawJournal;
  private tapFactory: () => ZeroClawAtTap;

  constructor(opts?: {
    sandboxRoot?: string;
    ai?: DeepSeekCaller;
  }) {
    this.ai = opts?.ai ?? new DeepSeekCaller();
    this.spawner = new ZeroClawSpawner(opts?.sandboxRoot);
    this.journalFactory = (dir) => new ZeroClawJournal(dir);
    this.tapFactory = () => new ZeroClawAtTap(this.ai);
  }

  /** Spawn a new ZeroClaw. */
  spawn(job: ZeroClawJob, options?: Parameters<ZeroClawSpawner['spawn']>[1]): ZeroClaw {
    const claw = this.spawner.spawn(job, options);
    this.claws.set(claw.id, claw);
    return claw;
  }

  /** Spawn from template. */
  spawnFromTemplate(templateIndex: number): ZeroClaw {
    const template = JOB_TEMPLATES[templateIndex];
    if (!template) throw new Error(`No template at index ${templateIndex}`);
    const job: ZeroClawJob = {
      ...template,
      id: `job-${crypto.randomUUID().slice(0, 8)}`,
    };
    return this.spawn(job);
  }

  /** Run a single cycle for a specific ZeroClaw. */
  async runCycle(clawId: string): Promise<CycleResult> {
    const claw = this.claws.get(clawId);
    if (!claw) throw new Error(`No claw with id ${clawId}`);
    if (!claw.alive) throw new Error(`${claw.name} is no longer active`);

    const journal = this.journalFactory(claw.sandboxDir);
    const tap = this.tapFactory();
    const cycle = new ZeroClawWorkCycle(this.ai, journal, tap);

    const result = await cycle.runCycle(claw);

    if (result.completed) {
      claw.alive = false; // compaction
    }

    return result;
  }

  /** Run a ZeroClaw through all its cycles until compaction. */
  async runToCompletion(clawId: string): Promise<CycleResult[]> {
    const results: CycleResult[] = [];
    let safety = 10; // prevent infinite loops

    while (safety-- > 0) {
      const claw = this.claws.get(clawId);
      if (!claw || !claw.alive) break;

      const result = await this.runCycle(clawId);
      results.push(result);

      if (result.completed) break;
    }

    return results;
  }

  /** Get all active claws. */
  getActive(): ZeroClaw[] {
    return [...this.claws.values()].filter(c => c.alive);
  }

  /** Get a claw by ID. */
  get(clawId: string): ZeroClaw | undefined {
    return this.claws.get(clawId);
  }

  /** List all claws. */
  list(): ZeroClaw[] {
    return [...this.claws.values()];
  }
}
