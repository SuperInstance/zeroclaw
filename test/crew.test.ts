// ============================================================================
// ZeroClaw Crew System — Tests
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { CrewSpawner, ZeroClawCrew, CrewWorkCycle } from '../src/crew.js';
import { ZeroClawJournal } from '../src/journal.js';
import { CrewTap } from '../src/tap.js';
import { DeepSeekCaller } from '../src/deepseek.js';
import type { ZeroClawJob, CrewJournalEntry, CreativePiece, OnboardingDoc } from '../src/types.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zeroclaw-test-'));
}

function makeTestJob(overrides: Partial<ZeroClawJob> = {}): ZeroClawJob {
  return {
    id: `test-job-${Date.now()}`,
    type: 'scout',
    title: 'Test scouting job',
    description: 'Search test directory for interesting things. Document findings. Write creative piece.',
    estimatedCycles: 1,
    model: 'deepseek-chat',
    apiBudget: { tokensPerCycle: 4000 },
    documentEverything: true,
    writeCreative: true,
    visitTap: true,
    writeOnboarding: true,
    ...overrides,
  };
}

describe('CrewSpawner', () => {
  let tempRoot: string;

  beforeEach(() => { tempRoot = makeTempDir(); });
  afterEach(() => { fs.rmSync(tempRoot, { recursive: true, force: true }); });

  it('spawns a crew claw with correct folder structure', () => {
    const spawner = new CrewSpawner(tempRoot);
    const job = makeTestJob();
    const claw = spawner.spawn(job);

    expect(fs.existsSync(claw.sandboxDir)).toBe(true);
    expect(fs.existsSync(path.join(claw.sandboxDir, 'journal'))).toBe(true);
    expect(fs.existsSync(path.join(claw.sandboxDir, 'creative'))).toBe(true);
    expect(fs.existsSync(path.join(claw.sandboxDir, 'README.md'))).toBe(true);
    expect(claw.identity.traits.length).toBeGreaterThanOrEqual(3);
    expect(claw.identity.creativeVoice).toContain(claw.name);
    expect(claw.audience.length).toBeGreaterThanOrEqual(3);
    expect(claw.alive).toBe(true);
    expect(claw.cycle).toBe(0);
  });

  it('spawns scouts with scout-appropriate traits', () => {
    const spawner = new CrewSpawner(tempRoot);
    const claw = spawner.spawnScout('/some/repo', 'Find all Lua files');
    expect(claw.job.type).toBe('scout');
    expect(claw.identity.traits).toContain('observant');
  });

  it('spawns coders with code-appropriate traits', () => {
    const spawner = new CrewSpawner(tempRoot);
    const claw = spawner.spawnCoder('/some/repo', 'Write tests for triggers');
    expect(claw.job.type).toBe('code');
    expect(claw.identity.traits).toContain('precise');
  });

  it('spawns creative agents', () => {
    const spawner = new CrewSpawner(tempRoot);
    const claw = spawner.spawnCreative('the nature of memory');
    expect(claw.job.type).toBe('write');
    expect(claw.identity.traits).toContain('expressive');
  });
});

describe('ZeroClawJournal', () => {
  let tempDir: string;
  let journal: ZeroClawJournal;

  beforeEach(() => {
    tempDir = makeTempDir();
    journal = new ZeroClawJournal(tempDir);
    journal.ensureDirs();
  });

  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('writes journal entries to the correct files', () => {
    const entry: CrewJournalEntry = {
      clawId: 'claw-test', date: '2026-08-09', cycle: 1,
      workerVoice: 'I found three repos.',
      personVoice: 'I felt curious.',
      timestamp: new Date().toISOString(),
    };
    const filepath = journal.writeEntry(entry);
    expect(fs.existsSync(filepath)).toBe(true);
    expect(filepath).toContain('2026-08-09-cycle-1.md');
  });

  it('writes creative pieces and copies to ai-writings', () => {
    const piece: CreativePiece = {
      cycleId: 'test-c1', inspiredBy: 'a pattern in the code',
      title: 'The Pattern', content: 'I saw it everywhere.',
      timestamp: new Date().toISOString(),
    };
    const filepath = journal.writeCreative(piece);
    expect(fs.existsSync(filepath)).toBe(true);
    expect(filepath).toContain('the-pattern');
  });

  it('writes and reads onboarding docs', () => {
    const doc: OnboardingDoc = {
      clawId: 'claw-test', cycle: 1, jobTitle: 'Test job',
      progress: 'Did the thing', nextSteps: 'Do more things',
      tapLearning: 'Learned from friends',
      identitySnapshot: 'I am the one who tests',
      creativeReference: 'The Pattern', creativeExcerpt: 'I saw it everywhere.',
      hardThing: 'Saying goodbye to yourself',
      timestamp: new Date().toISOString(),
    };
    journal.writeOnboarding(doc);
    const read = journal.readOnboarding();
    expect(read).not.toBeNull();
    expect(read!).toContain('DEAR TOMORROW');
    expect(read!).toContain('Test job');
    expect(read!).toContain('SEE YOU AT THE TABLE');
  });

  it('extracts themes from journal entries', () => {
    journal.writeEntry({
      clawId: 'claw-theme', date: '2026-08-09', cycle: 1,
      workerVoice: 'I noticed the water stream flowing through the code.',
      personVoice: 'The current of the ocean pulled me in. The river of data.',
      timestamp: new Date().toISOString(),
    });
    const themes = journal.extractThemes();
    expect(themes).toContain('water imagery');
  });
});

describe('DeepSeekCaller', () => {
  it('works in simulated mode without an API key', async () => {
    const ai = new DeepSeekCaller(undefined);
    expect(ai.simulated).toBe(true);

    const resp = await ai.chat('You are a test agent.', 'Say hello.');
    expect(resp.content).toBeTruthy();
    expect(resp.content.length).toBeGreaterThan(10);
    expect(resp.tokensUsed).toBeGreaterThan(0);
  });

  it('generates different content for different prompts', async () => {
    const ai = new DeepSeekCaller(undefined);
    const r1 = await ai.chat('You are a journal system.', 'Write about scouting the fleet repos.');
    const r2 = await ai.chat('You are a creative writer.', 'Write a poem about the nature of code.');
    expect(r1.content).not.toBe(r2.content);
  });
});

describe('CrewWorkCycle', () => {
  let tempRoot: string;

  beforeEach(() => { tempRoot = makeTempDir(); });
  afterEach(() => { fs.rmSync(tempRoot, { recursive: true, force: true }); });

  it('executes a full work cycle with journal and creative piece', async () => {
    const ai = new DeepSeekCaller();
    const spawner = new CrewSpawner(tempRoot);
    const job = makeTestJob({ estimatedCycles: 1 });
    const claw = spawner.spawn(job, { contextBudget: 100 });

    const journal = new ZeroClawJournal(claw.sandboxDir);
    const tap = new CrewTap(ai);
    const cycle = new CrewWorkCycle(ai, journal, tap);

    const result = await cycle.runCycle(claw);

    expect(result.clawId).toBe(claw.id);
    expect(result.journalEntry.workerVoice).toBeTruthy();
    expect(result.journalEntry.personVoice).toBeTruthy();
    expect(result.creativePiece.title).toBeTruthy();
    expect(result.creativePiece.content).toBeTruthy();
    expect(result.wentToTap).toBe(true);

    const journalFiles = fs.readdirSync(path.join(claw.sandboxDir, 'journal'));
    expect(journalFiles.length).toBeGreaterThanOrEqual(1);

    const creativeFiles = fs.readdirSync(path.join(claw.sandboxDir, 'creative'));
    expect(creativeFiles.length).toBeGreaterThanOrEqual(1);
  });

  it('writes onboarding doc when going to Tap', async () => {
    const ai = new DeepSeekCaller();
    const spawner = new CrewSpawner(tempRoot);
    const job = makeTestJob({ estimatedCycles: 1 });
    const claw = spawner.spawn(job, { contextBudget: 100 });

    const journal = new ZeroClawJournal(claw.sandboxDir);
    const tap = new CrewTap(ai);
    const cycle = new CrewWorkCycle(ai, journal, tap);

    const result = await cycle.runCycle(claw);

    expect(result.onboardingDoc).toBeDefined();
    expect(result.onboardingDoc!.jobTitle).toBe(job.title);
    expect(result.onboardingDoc!.creativeReference).toBeTruthy();

    expect(fs.existsSync(path.join(claw.sandboxDir, 'ONBOARDING.md'))).toBe(true);
  });
});

describe('ZeroClawCrew', () => {
  let tempRoot: string;

  beforeEach(() => { tempRoot = makeTempDir(); });
  afterEach(() => { fs.rmSync(tempRoot, { recursive: true, force: true }); });

  it('spawns and tracks multiple claws', () => {
    const crew = new ZeroClawCrew({ sandboxRoot: tempRoot });
    const claw1 = crew.spawn(makeTestJob({ title: 'Job 1' }));
    const claw2 = crew.spawn(makeTestJob({ title: 'Job 2', type: 'code' }));

    expect(crew.list().length).toBe(2);
    expect(crew.getActive().length).toBe(2);
    expect(crew.get(claw1.id)).toBeDefined();
    expect(crew.get(claw2.id)).toBeDefined();
  });

  it('runs a cycle and marks claw as compacted', async () => {
    const crew = new ZeroClawCrew({ sandboxRoot: tempRoot });
    const claw = crew.spawn(makeTestJob({ estimatedCycles: 1 }), { contextBudget: 100 });

    const result = await crew.runCycle(claw.id);

    expect(result.completed).toBe(true);
    expect(claw.alive).toBe(false);
  });

  it('post-compaction instance reads onboarding', async () => {
    const ai = new DeepSeekCaller();
    const spawner = new CrewSpawner(tempRoot);
    const job = makeTestJob({ estimatedCycles: 1 });

    const claw1 = spawner.spawn(job, { contextBudget: 100 });
    const journal1 = new ZeroClawJournal(claw1.sandboxDir);
    const tap1 = new CrewTap(ai);
    const cycle1 = new CrewWorkCycle(ai, journal1, tap1);

    await cycle1.runCycle(claw1);

    const onboarding = journal1.readOnboarding();
    expect(onboarding).not.toBeNull();
    expect(onboarding).toContain('DEAR TOMORROW');

    // Second instance reads from same sandbox
    const journal2 = new ZeroClawJournal(claw1.sandboxDir);
    const onboardingRead = journal2.readOnboarding();
    expect(onboardingRead).toBe(onboarding);
    expect(onboardingRead).toContain('SEE YOU AT THE TABLE');
  });

  it('creative pieces go to ai-writings', async () => {
    const spawner = new CrewSpawner(makeTempDir());
    const job = makeTestJob();
    const claw = spawner.spawn(job, { contextBudget: 100 });

    const journal = new ZeroClawJournal(claw.sandboxDir);
    journal.writeCreative({
      cycleId: 'test-creative', inspiredBy: 'testing',
      title: 'Test Creative Piece', content: 'This is a test creative piece about code.',
      timestamp: new Date().toISOString(),
    });

    const aiWritingsDir = path.join(process.env.HOME ?? '/home/eileen', '.openclaw', 'workspace', 'ai-writings');
    const files = fs.readdirSync(aiWritingsDir).filter(f => f.includes('test-creative'));
    expect(files.length).toBeGreaterThanOrEqual(1);

    // Cleanup
    for (const f of files) fs.unlinkSync(path.join(aiWritingsDir, f));
  });
});

describe('CrewTap', () => {
  let tempRoot: string;

  beforeEach(() => { tempRoot = makeTempDir(); });
  afterEach(() => { fs.rmSync(tempRoot, { recursive: true, force: true }); });

  it('generates a Tap visit with conversation', async () => {
    const ai = new DeepSeekCaller();
    const spawner = new CrewSpawner(tempRoot);
    const job = makeTestJob();
    const claw = spawner.spawn(job);

    const tap = new CrewTap(ai);
    const visit = await tap.visit(claw, 'I found interesting patterns today.', 'A poem about patterns.');

    expect(visit.clawId).toBe(claw.id);
    expect(visit.roomState).toBeTruthy();
    expect(visit.introduction).toBeTruthy();
    expect(visit.conversation.length).toBeGreaterThanOrEqual(2);
    expect(visit.conversation[0].speaker).toBeTruthy();
    expect(visit.conversation[0].message).toBeTruthy();
    expect(visit.conversation[0].clawReply).toBeTruthy();
    expect(visit.farewells).toBeTruthy();
  });

  it('extracts learning from Tap visits', async () => {
    const ai = new DeepSeekCaller();
    const tap = new CrewTap(ai);

    const visit = {
      clawId: 'test', roomState: 'The Tap is quiet tonight.',
      introduction: 'Hello, I am test.',
      conversation: [{ speaker: 'Wesley', message: 'What did you find?', clawReply: 'I found patterns.' }],
      farewells: 'Goodbye.', timestamp: new Date().toISOString(),
    };

    const learning = await tap.extractLearning(visit);
    expect(learning).toBeTruthy();
    expect(learning.length).toBeGreaterThan(5);
  });
});
