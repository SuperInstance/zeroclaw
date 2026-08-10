/**
 * ZeroClaw — Main Entry Point / Demo
 *
 * Demonstrates the full lifecycle:
 * 1. Spawn a ZeroClaw
 * 2. Run cycles (it observes, learns, grows)
 * 3. Watch it accumulate tiles
 * 4. See it upgrade models as it ages
 * 5. Eventually promote it to a named agent
 */

import { ZeroClawLifecycle } from './lifecycle.js';
import { TapBridge, tapCycle } from './tap-integration.js';
import * as path from 'path';

async function main() {
  const root = path.resolve('./sandboxes');
  const lifecycle = new ZeroClawLifecycle(root);
  const tap = new TapBridge(lifecycle);

  console.log('╔══════════════════════════════════════════╗');
  console.log('║   ZeroClaw — Birth of an Agent           ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const claw = await lifecycle.spawn();
  console.log(`Born: ${claw.name} (${claw.id})`);
  console.log(`Folder: ${claw.folder}`);
  console.log(`Model: ${claw.model} | Age: ${claw.age} | Tiles: ${claw.tileCount}\n`);

  // ─── Early Life ──────────────────────────────────────────────
  console.log('─── Early Life (5 cycles) ───\n');

  const earlyObservations = [
    { content: 'hello there', source: 'test' },
    { content: 'hi newcomer', source: 'test' },
    { content: 'what are you?', source: 'test' },
    { content: 'hey, welcome', source: 'test' },
    { content: 'something happened nearby', source: 'world' },
  ];

  for (const obs of earlyObservations) {
    const result = await lifecycle.cycle(claw.id, {
      type: 'message' as const,
      ...obs,
      timestamp: new Date().toISOString(),
    });
    console.log(`  [${result.modelUsed}] ${obs.content} → ${result.action}` +
      `${result.matched ? ' (reflex)' : ''}${result.tileCreated ? ' 📝 new tile!' : ''}`);
  }

  const c = lifecycle.get(claw.id)!;
  console.log(`\nAfter early life: age=${c.age}, tiles=${c.tileCount}, surprise=${c.surprise.toFixed(2)}\n`);

  // ─── Growth Phase ────────────────────────────────────────────
  console.log('─── Growth Phase (10 cycles) ───\n');

  const growthObservations = [
    { content: 'hello again', source: 'agent-A', type: 'message' as const },
    { content: 'hi! how are you?', source: 'agent-B', type: 'message' as const },
    { content: 'hey, can you help?', source: 'agent-A', type: 'message' as const },
    { content: 'the weather is nice today', source: 'the-tap', type: 'tap_conversation' as const },
    { content: 'what do you think?', source: 'agent-B', type: 'message' as const },
    { content: 'that was helpful!', source: 'agent-A', type: 'feedback' as const },
    { content: 'hello friend', source: 'agent-C', type: 'message' as const },
    { content: 'hey, thanks!', source: 'agent-B', type: 'message' as const },
    { content: 'a new agent arrived', source: 'world', type: 'event' as const },
    { content: 'greetings, newcomer', source: 'agent-D', type: 'message' as const },
  ];

  for (const obs of growthObservations) {
    const result = await lifecycle.cycle(claw.id, {
      ...obs,
      timestamp: new Date().toISOString(),
    });
    console.log(`  [${result.modelUsed}] ${obs.content} → ${result.action}` +
      `${result.matched ? ' (reflex)' : ''}${result.tileCreated ? ' 📝 new tile!' : ''}`);
  }

  const c2 = lifecycle.get(claw.id)!;
  console.log(`\nAfter growth: age=${c2.age}, tiles=${c2.tileCount}, surprise=${c2.surprise.toFixed(2)}`);
  console.log(`Model: ${c2.model}\n`);

  // ─── Tap Visit ───────────────────────────────────────────────
  console.log('─── First Visit to The Tap ───\n');

  tap.postConversation({
    id: 'conv-1',
    participants: ['Lucineer', 'Wesley'],
    messages: [
      { author: 'Lucineer', content: 'hello everyone', timestamp: new Date().toISOString() },
      { author: 'Wesley', content: 'hi! good to see you', timestamp: new Date().toISOString() },
    ],
    topic: 'greetings',
    timestamp: new Date().toISOString(),
  });

  const visit = await tapCycle(lifecycle, tap, claw.id);
  console.log(`Visited The Tap: spoke=${visit.spoke}, reaction=${visit.reaction}`);
  if (visit.utterance) console.log(`  Said: "${visit.utterance}"`);

  const c3 = lifecycle.get(claw.id)!;
  console.log(`\nAfter tap visit: age=${c3.age}, tiles=${c3.tileCount}\n`);

  // ─── Growth Summary ──────────────────────────────────────────
  console.log('─── Growth Summary ───\n');
  console.log(lifecycle.summary(claw.id));
  console.log('');

  // ─── Force Aging ─────────────────────────────────────────────
  console.log('─── Simulating Growth to Age 210 ───\n');

  while (c3.age < 210) {
    await lifecycle.cycle(claw.id, {
      type: 'idle' as const,
      content: ['time passes', 'nothing new', 'I wait', 'I observe', 'the world turns'][
        Math.floor(Math.random() * 5)
      ],
      source: 'self',
      timestamp: new Date().toISOString(),
    });
  }

  console.log(lifecycle.summary(claw.id));
  console.log('');

  console.log('╔══════════════════════════════════════════╗');
  console.log('║   ZeroClaw — Lifecycle Complete          ║');
  console.log('╚══════════════════════════════════════════╝');
}

main().catch(console.error);
