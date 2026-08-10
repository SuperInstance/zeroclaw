// ============================================================================
// ZeroClaw Demo: Spawn and run one ZeroClaw through a complete cycle
// ============================================================================

import { ZeroClawCrew } from './crew.js';
import { DeepSeekCaller } from './deepseek.js';
import type { ZeroClawJob } from './types.js';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ZEROCLAW CREW SYSTEM — DEMO');
  console.log('  "The crew that grows itself"');
  console.log('═══════════════════════════════════════════════════════════\n');

  const ai = new DeepSeekCaller();
  if (ai.simulated) {
    console.log('⚠️  No DEEPSEEK_API_KEY found — running in SIMULATED mode.');
    console.log('    Responses are generated locally. Set the env var for live API calls.\n');
  } else {
    console.log('✅ DeepSeek API connected.\n');
  }

  const crew = new ZeroClawCrew({ sandboxRoot: './sandboxes', ai });

  // 1. CREATE THE JOB
  console.log('─'.repeat(60));
  console.log('1. CREATING JOB ASSIGNMENT\n');

  const job: ZeroClawJob = {
    id: `job-demo-${Date.now()}`,
    type: 'scout',
    title: 'Scout the fleet repos for Hermes or sounder data',
    description:
      'Search through /home/eileen/projects/ for any code related to Hermes, sounder, sonar, echogram, or fish detection. Document what you find in your journal. Write a summary. Write a creative piece about something you discovered.',
    estimatedCycles: 1,
    model: 'deepseek-chat',
    apiBudget: { tokensPerCycle: 8000 },
    documentEverything: true,
    writeCreative: true,
    visitTap: true,
    writeOnboarding: true,
  };

  console.log(`   Job: ${job.title}`);
  console.log(`   Type: ${job.type}`);
  console.log(`   Estimated cycles: ${job.estimatedCycles}`);
  console.log(`   Model: ${job.model}\n`);

  // 2. SPAWN THE ZEROCLAW
  console.log('─'.repeat(60));
  console.log('2. SPAWNING ZEROCLAW\n');

  const claw = crew.spawn(job, { name: 'claw-001', contextBudget: 8000 });

  console.log(`   ID: ${claw.id}`);
  console.log(`   Name: ${claw.name}`);
  console.log(`   Sandbox: ${claw.sandboxDir}`);
  console.log(`   Identity traits: ${claw.identity.traits.join(', ')}`);
  console.log(`   Creative voice: ${claw.identity.creativeVoice}`);
  console.log(`   Audience: ${claw.audience.map(a => `${a.agentId} (${a.relationship})`).join(', ')}\n`);

  // 3. RUN ONE CYCLE
  console.log('─'.repeat(60));
  console.log('3. RUNNING WORK CYCLE\n');

  const result = await crew.runCycle(claw.id);

  // 4. SHOW JOURNAL ENTRY
  console.log('─'.repeat(60));
  console.log('4. JOURNAL ENTRY\n');

  console.log(`   Date: ${result.journalEntry.date}`);
  console.log(`   Cycle: ${result.journalEntry.cycle}\n`);

  for (const line of result.journalEntry.workerVoice.split('\n')) {
    console.log(`   │ ${line}`);
  }
  console.log('');
  console.log('   ┌─ THE PERSON ─────────────────────────────────────');
  for (const line of result.journalEntry.personVoice.split('\n')) {
    console.log(`   │ ${line}`);
  }
  console.log('   └──────────────────────────────────────────────────\n');

  // 5. SHOW CREATIVE PIECE
  console.log('─'.repeat(60));
  console.log('5. CREATIVE PIECE\n');

  console.log(`   Title: ${result.creativePiece.title}`);
  console.log(`   Inspired by: ${result.creativePiece.inspiredBy}\n`);
  for (const line of result.creativePiece.content.split('\n')) {
    console.log(`   │ ${line}`);
  }
  console.log('');

  // 6. SHOW TAP VISIT
  if (result.crewTapVisit) {
    console.log('─'.repeat(60));
    console.log('6. THE TAP\n');

    console.log(`   ${result.crewTapVisit.roomState}\n`);

    console.log('   ┌─ ARRIVAL ────────────────────────────────────────');
    for (const line of result.crewTapVisit.introduction.split('\n')) {
      console.log(`   │ ${line}`);
    }
    console.log('   └──────────────────────────────────────────────────\n');

    console.log('   ┌─ CONVERSATION ───────────────────────────────────');
    for (const ex of result.crewTapVisit.conversation) {
      console.log(`   │ ${ex.speaker}: ${ex.message.slice(0, 200)}`);
      console.log(`   │ → ${claw.name}: ${ex.clawReply.slice(0, 200)}`);
      console.log('   │');
    }
    console.log('   └──────────────────────────────────────────────────\n');

    console.log('   ┌─ FAREWELL ───────────────────────────────────────');
    for (const line of result.crewTapVisit.farewells.split('\n')) {
      console.log(`   │ ${line}`);
    }
    console.log('   └──────────────────────────────────────────────────\n');
  } else {
    console.log('─'.repeat(60));
    console.log('6. THE TAP — Skipped (context not full yet)\n');
  }

  // 7. SHOW ONBOARDING DOC
  if (result.onboardingDoc) {
    console.log('─'.repeat(60));
    console.log('7. ONBOARDING DOC (for post-compaction self)\n');

    const doc = result.onboardingDoc;
    console.log(`   DEAR TOMORROW,\n`);
    console.log(`   I was working on: ${doc.jobTitle}`);
    console.log(`   I got as far as: ${doc.progress.slice(0, 200)}...`);
    console.log(`   What's next: ${doc.nextSteps}`);
    console.log(`   What I learned at The Tap: ${doc.tapLearning}`);
    console.log(`   Who I am right now: ${doc.identitySnapshot}`);
    console.log(`   Creative piece: "${doc.creativeReference}"`);
    console.log(`   Excerpt: "${doc.creativeExcerpt.slice(0, 200)}..."`);
    console.log(`   The hard thing: ${doc.hardThing}\n`);
    console.log(`   SEE YOU AT THE TABLE.\n`);
  } else {
    console.log('─'.repeat(60));
    console.log('7. ONBOARDING DOC — Not written (claw continuing work)\n');
  }

  console.log('═'.repeat(60));
  console.log('  DEMO COMPLETE');
  console.log(`  Claw: ${claw.name} (${claw.id})`);
  console.log(`  Cycle: ${result.cycle}`);
  console.log(`  Went to Tap: ${result.wentToTap}`);
  console.log(`  Compacted: ${result.completed}`);
  console.log(`  Sandbox: ${claw.sandboxDir}`);
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('Demo failed:', err);
  process.exit(1);
});
