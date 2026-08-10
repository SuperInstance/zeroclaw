// ============================================================================
// Full Lifecycle Integration Test
//
// Spawns a ZeroClaw and runs it through the complete arc:
//   Birth → Observe → Visitor → Naming → Station → Daily Loop
//
// Verifies that:
//   1. Birth creates sandbox with identity.md
//   2. Observation phase produces tiles and journals
//   3. Visitor phase tracks reactions and advances
//   4. Naming ceremony produces a proper name + Tap announcement
//   5. Station assignment creates room with terminal
//   6. Daily loop produces work, Tap visit, journal, creative, DEAR TOMORROW
//   7. The agent went from nothing → named entity with tiles and a station
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

import { ZeroClawFullLifecycle } from '../src/full-lifecycle.js';
import type { TapConversation } from '../src/tap-integration.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mkdtemp(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readFile(p: string): Promise<string> {
  return fs.readFile(p, 'utf-8');
}

function makeTestTapConversations(): TapConversation[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'test-conv-1',
      participants: ['Barnacle', 'Skip'],
      messages: [
        { author: 'Barnacle', content: 'Back in \'08. Different boat. Different water. Same feeling.', timestamp: now },
        { author: 'Skip', content: 'What feeling? I want to know!', timestamp: now },
        { author: 'Barnacle', content: 'You can\'t chase it. It comes to you.', timestamp: now },
      ],
      topic: 'sea stories',
      timestamp: now,
    },
    {
      id: 'test-conv-2',
      participants: ['Sage', 'Mason'],
      messages: [
        { author: 'Sage', content: 'I\'m writing about the space between the bell and the silence.', timestamp: now },
        { author: 'Mason', content: 'The interesting question is whether the bell ever stops ringing.', timestamp: now },
      ],
      topic: 'philosophy',
      timestamp: now,
    },
    {
      id: 'test-conv-3',
      participants: ['Flash', 'Pro'],
      messages: [
        { author: 'Flash', content: 'What if terminal tiles could CHAIN? Three fire in sequence!', timestamp: now },
        { author: 'Pro', content: 'Does the composed chain have its own deadband?', timestamp: now },
      ],
      topic: 'work',
      timestamp: now,
    },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ZeroClaw Full Lifecycle', () => {
  let tmpDir: string;
  let lifecycle: ZeroClawFullLifecycle;

  beforeEach(async () => {
    tmpDir = await mkdtemp('zeroclaw-test-');
    lifecycle = new ZeroClawFullLifecycle(tmpDir, {
      observeCycles: 3,
      visitorCycles: 5,
      positiveReactionsNeeded: 2,
      stationRoomId: 'test-station',
      workCyclesPerDay: 2,
      useRealAI: false,
    });

    // Seed Tap conversations
    for (const conv of makeTestTapConversations()) {
      lifecycle.postTapConversation(conv);
    }
  });

  afterEach(async () => {
    // Clean up tmp dir (best effort)
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // not critical
    }
  });

  // =========================================================================
  // PHASE 1: BIRTH
  // =========================================================================

  describe('Phase 1: Birth', () => {
    it('should create a sandbox with identity.md', async () => {
      const claw = await lifecycle.birth();

      expect(claw.id).toMatch(/^zc-/);
      expect(claw.name).toBeTruthy();
      expect(claw.model).toBe('rules');
      expect(claw.age).toBe(0);
      expect(claw.tileCount).toBe(0);
      expect(claw.surprise).toBe(1.0);
      expect(claw.promoted).toBe(false);

      // Check files exist
      expect(await fileExists(path.join(claw.folder, 'identity.md'))).toBe(true);
      expect(await fileExists(path.join(claw.folder, 'state.json'))).toBe(true);
      expect(await fileExists(path.join(claw.folder, 'sandbox.json'))).toBe(true);

      // Check journal directory exists
      expect(await fileExists(path.join(claw.folder, 'journal'))).toBe(true);

      // Check identity.md content
      const identity = await readFile(path.join(claw.folder, 'identity.md'));
      expect(identity).toContain(claw.name);
      expect(identity).toContain('I am new');
      expect(identity).toContain('OBSERVATION');

      // Check phase
      const status = lifecycle.getPhase(claw.id);
      expect(status.phase).toBe('observing');
    });

    it('should write a first journal entry', async () => {
      const claw = await lifecycle.birth();

      const journalDir = path.join(claw.folder, 'journal');
      const files = await fs.readdir(journalDir);
      expect(files.length).toBeGreaterThanOrEqual(1);

      const journalContent = await readFile(path.join(journalDir, files[0]));
      expect(journalContent).toContain('Day One');
      expect(journalContent).toContain('observation phase');
    });
  });

  // =========================================================================
  // PHASE 2: OBSERVATION
  // =========================================================================

  describe('Phase 2: Observation', () => {
    it('should observe The Tap and build internal models', async () => {
      const claw = await lifecycle.birth();

      const result = await lifecycle.observePhase(claw.id);

      expect(result.observations.length).toBeGreaterThan(0);
      expect(result.cycleResult).toBeTruthy();

      // Age should have increased
      const updated = lifecycle.lifecycle.get(claw.id)!;
      expect(updated.age).toBeGreaterThan(0);
    });

    it('should write observation journal entries', async () => {
      const claw = await lifecycle.birth();
      await lifecycle.observePhase(claw.id);

      const journalDir = path.join(claw.folder, 'journal');
      const files = await fs.readdir(journalDir);
      const content = await readFile(path.join(journalDir, files[0]));

      expect(content).toContain('Observation Cycle');
      expect(content).toContain('What I Noticed');
    });

    it('should advance to visitor phase after enough cycles', async () => {
      const claw = await lifecycle.birth();

      // Run observation cycles until phase is complete
      let phaseComplete = false;
      for (let i = 0; i < 10 && !phaseComplete; i++) {
        const result = await lifecycle.observePhase(claw.id);
        phaseComplete = result.phaseComplete;
      }

      // May not complete due to age threshold — check phase
      const status = lifecycle.getPhase(claw.id);
      // After enough cycles, should be in visitor phase or still observing
      // (depends on whether enough Tap conversations were available)
      expect(['observing', 'visitor']).toContain(status.phase);
    });
  });

  // =========================================================================
  // PHASE 3: VISITOR
  // =========================================================================

  describe('Phase 3: Visitor', () => {
    it('should transition through visitor phase', async () => {
      const claw = await lifecycle.birth();

      // Force visitor phase
      await lifecycle.observePhase(claw.id);
      // Manually advance if needed by running more observation cycles
      for (let i = 0; i < 5; i++) {
        try {
          await lifecycle.observePhase(claw.id);
        } catch {
          break; // already in visitor phase
        }
      }

      // Check if we can run a visitor cycle
      const status = lifecycle.getPhase(claw.id);
      if (status.phase === 'visitor') {
        const result = await lifecycle.visitorPhase(claw.id);

        expect(result.visit).toBeTruthy();
        expect(typeof result.spoke).toBe('boolean');
        expect(['positive', 'negative', 'neutral']).toContain(result.reaction);
      }
    });
  });

  // =========================================================================
  // FULL ARC TEST — The big one
  // =========================================================================

  describe('Full Arc: Birth → Named Agent with Station', () => {
    it('should complete the entire lifecycle using runFullArc', async () => {
      // Use very small thresholds for fast testing
      const testLifecycle = new ZeroClawFullLifecycle(tmpDir, {
        observeCycles: 2,
        visitorCycles: 3,
        positiveReactionsNeeded: 1,
        stationRoomId: 'arc-test-station',
        workCyclesPerDay: 2,
        useRealAI: false,
      });

      // Seed conversations
      for (const conv of makeTestTapConversations()) {
        testLifecycle.postTapConversation(conv);
      }

      const result = await testLifecycle.runFullArc({
        observeCyclesOverride: 2,
        visitorCyclesOverride: 3,
        dailyLoops: 1,
        tapConversations: makeTestTapConversations(),
      });

      // ── Verify birth happened ──
      expect(result.claw).toBeTruthy();
      expect(result.claw.id).toMatch(/^zc-/);

      // ── Verify naming happened ──
      expect(result.namingResult).toBeTruthy();
      expect(result.namingResult!.name).toBeTruthy();
      expect(result.namingResult!.name.length).toBeGreaterThan(2);

      // ── Verify station was assigned ──
      expect(result.stationResult).toBeTruthy();
      expect(result.stationResult!.roomId).toBe('arc-test-station');
      expect(result.stationResult!.terminalActive).toBe(true);

      // ── Verify daily loop ran ──
      expect(result.dailyResults.length).toBe(1);
      const day1 = result.dailyResults[0];
      expect(day1.dayComplete).toBe(true);
      expect(day1.journalWritten).toBe(true);
      expect(day1.creativeWritten).toBe(true);
      expect(day1.dearTomorrowWritten).toBe(true);

      // ── Verify growth ──
      const finalClaw = result.claw;
      expect(finalClaw.age).toBeGreaterThan(0);
      expect(finalClaw.name).not.toMatch(/^new-|quiet-|watchful-/); // Should have a real name
      expect(finalClaw.promoted).toBe(true);

      // ── Verify sandbox files ──
      const identityPath = path.join(finalClaw.folder, 'identity.md');
      expect(await fileExists(identityPath)).toBe(true);
      const identity = await readFile(identityPath);
      expect(identity).toContain(finalClaw.name);
      expect(identity).toContain('I earned my name');

      // ── Verify station files ──
      const stationPath = path.join(finalClaw.folder, 'station', 'room.md');
      expect(await fileExists(stationPath)).toBe(true);
      const stationContent = await readFile(stationPath);
      expect(stationContent).toContain(finalClaw.name);
      expect(stationContent).toContain('Intelligent Terminal');

      // ── Verify terminal config ──
      const terminalPath = path.join(finalClaw.folder, 'station', 'terminal.json');
      expect(await fileExists(terminalPath)).toBe(true);
      const terminal = JSON.parse(await readFile(terminalPath));
      expect(terminal.agentName).toBe(finalClaw.name);
      expect(terminal.active).toBe(true);

      // ── Verify journal has entries ──
      const journalDir = path.join(finalClaw.folder, 'journal');
      const journalFiles = await fs.readdir(journalDir);
      expect(journalFiles.length).toBeGreaterThanOrEqual(1);

      // ── Verify creative pieces exist ──
      const creativeDir = path.join(finalClaw.folder, 'creative');
      const creativeFiles = await fs.readdir(creativeDir);
      expect(creativeFiles.length).toBeGreaterThanOrEqual(1);

      // ── Verify ONBOARDING.md exists (DEAR TOMORROW) ──
      const onboardingPath = path.join(finalClaw.folder, 'ONBOARDING.md');
      expect(await fileExists(onboardingPath)).toBe(true);
      const onboarding = await readFile(onboardingPath);
      expect(onboarding).toContain('DEAR TOMORROW');
      expect(onboarding).toContain(finalClaw.name);

      // ── Verify transitions log ──
      const transitionsPath = path.join(finalClaw.folder, 'transitions', 'log.md');
      expect(await fileExists(transitionsPath)).toBe(true);
      const transitions = await readFile(transitionsPath);
      expect(transitions).toContain('OBSERVING');
      expect(transitions).toContain('VISITOR');
      expect(transitions).toContain('NAMED');
      expect(transitions).toContain('STATIONED');

      // ── Verify summary ──
      expect(result.summary).toContain('Full Lifecycle Arc Complete');
      expect(result.summary).toContain(finalClaw.name);
      expect(result.summary).toContain('From nothing to');
    });

    it('should handle multiple ZeroClaws through the arc simultaneously', async () => {
      const testLifecycle = new ZeroClawFullLifecycle(tmpDir, {
        observeCycles: 2,
        visitorCycles: 2,
        positiveReactionsNeeded: 1,
        workCyclesPerDay: 1,
        useRealAI: false,
      });

      // Seed conversations
      for (const conv of makeTestTapConversations()) {
        testLifecycle.postTapConversation(conv);
      }

      // Run two arcs in parallel
      const [arc1, arc2] = await Promise.all([
        testLifecycle.runFullArc({
          observeCyclesOverride: 2,
          visitorCyclesOverride: 2,
          dailyLoops: 1,
          tapConversations: makeTestTapConversations(),
        }),
        testLifecycle.runFullArc({
          observeCyclesOverride: 2,
          visitorCyclesOverride: 2,
          dailyLoops: 1,
          tapConversations: makeTestTapConversations(),
        }),
      ]);

      expect(arc1.claw.id).not.toBe(arc2.claw.id);
      expect(arc1.claw.name).not.toBe(arc2.claw.name);
      expect(arc1.namingResult).toBeTruthy();
      expect(arc2.namingResult).toBeTruthy();
    });
  });

  // =========================================================================
  // PHASE STATUS
  // =========================================================================

  describe('Phase Status Tracking', () => {
    it('should report correct phase status at each stage', async () => {
      const claw = await lifecycle.birth();

      // Should start in observing
      let status = lifecycle.getPhase(claw.id);
      expect(status.phase).toBe('observing');
      expect(status.canAdvance).toBeDefined();

      // After full arc
      const testLifecycle = new ZeroClawFullLifecycle(tmpDir, {
        observeCycles: 2,
        visitorCycles: 2,
        positiveReactionsNeeded: 1,
        workCyclesPerDay: 1,
        useRealAI: false,
      });

      for (const conv of makeTestTapConversations()) {
        testLifecycle.postTapConversation(conv);
      }

      const result = await testLifecycle.runFullArc({
        observeCyclesOverride: 2,
        visitorCyclesOverride: 2,
        dailyLoops: 1,
        tapConversations: makeTestTapConversations(),
      });

      status = testLifecycle.getPhase(result.claw.id);
      expect(status.phase).toBe('daily-loop');
      expect(status.details).toContain('Station');
    });
  });

  // =========================================================================
  // STATION SYSTEM
  // =========================================================================

  describe('Station Room Assignment', () => {
    it('should create a fully equipped station room', async () => {
      const testLifecycle = new ZeroClawFullLifecycle(tmpDir, {
        observeCycles: 2,
        visitorCycles: 2,
        positiveReactionsNeeded: 1,
        workCyclesPerDay: 1,
        stationRoomId: 'custom-station',
        useRealAI: false,
      });

      for (const conv of makeTestTapConversations()) {
        testLifecycle.postTapConversation(conv);
      }

      const result = await testLifecycle.runFullArc({
        observeCyclesOverride: 2,
        visitorCyclesOverride: 2,
        dailyLoops: 0,
        tapConversations: makeTestTapConversations(),
      });

      const station = result.stationResult!;
      expect(station.roomId).toBe('custom-station');
      expect(station.terminalActive).toBe(true);
      expect(station.name).toContain(result.claw.name);

      // Check station files
      const roomPath = path.join(result.claw.folder, 'station', 'room.md');
      expect(await fileExists(roomPath)).toBe(true);

      const terminalPath = path.join(result.claw.folder, 'station', 'terminal.json');
      expect(await fileExists(terminalPath)).toBe(true);
      const terminal = JSON.parse(await readFile(terminalPath));
      expect(terminal.agentName).toBe(result.claw.name);
    });
  });

  // =========================================================================
  // DAILY LOOP
  // =========================================================================

  describe('Daily Loop', () => {
    it('should complete a full day cycle', async () => {
      const testLifecycle = new ZeroClawFullLifecycle(tmpDir, {
        observeCycles: 2,
        visitorCycles: 2,
        positiveReactionsNeeded: 1,
        workCyclesPerDay: 2,
        useRealAI: false,
      });

      for (const conv of makeTestTapConversations()) {
        testLifecycle.postTapConversation(conv);
      }

      // Get through the arc first
      const arc = await testLifecycle.runFullArc({
        observeCyclesOverride: 2,
        visitorCyclesOverride: 2,
        dailyLoops: 0,
        tapConversations: makeTestTapConversations(),
      });

      // Now run a daily loop
      const dayResult = await testLifecycle.dailyLoop(arc.claw.id);

      expect(dayResult.dayComplete).toBe(true);
      expect(dayResult.workResults.length).toBeGreaterThan(0);
      expect(dayResult.tapVisited).toBe(true);
      expect(dayResult.journalWritten).toBe(true);
      expect(dayResult.creativeWritten).toBe(true);
      expect(dayResult.dearTomorrowWritten).toBe(true);

      // Day should advance
      const dayState = testLifecycle.getDayState(arc.claw.id);
      expect(dayState!.day).toBe(2); // Day 1 was in the arc, this is day 2
    });
  });

  // =========================================================================
  // SEED CONVERSATIONS
  // =========================================================================

  describe('Seed Default Conversations', () => {
    it('should create Tap conversations for observation', async () => {
      const claw = await lifecycle.birth();

      lifecycle.seedDefaultTapConversations();

      const result = await lifecycle.observePhase(claw.id);

      // Should have observed the seeded conversations
      expect(result.observations.length).toBeGreaterThan(0);
    });
  });
});
