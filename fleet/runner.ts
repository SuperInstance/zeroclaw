// ============================================================================
// Fleet Runner — The Daily Cycle for the Standing ZeroClaw Crew
//
// Five agents. Four phases. One day. Every day.
//
//   morning  → read onboarding, pick up work
//   work     → each crew member does their job
//   evening  → all five go to The Tap
//   night    → journal, creative, DEAR TOMORROW
//
// Usage:
//   npx tsx fleet/runner.ts --morning    # wake up, read yesterday's letter
//   npx tsx fleet/runner.ts --work       # do the work
//   npx tsx fleet/runner.ts --evening    # go to The Tap
//   npx tsx fleet/runner.ts --night      # journal + sleep
//   npx tsx fleet/runner.ts --full-day   # all four phases
//   npx tsx fleet/runner.ts --status     # show fleet status
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FLEET_DIR = __dirname;
const PROJECT_DIR = path.resolve(FLEET_DIR, '..');

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrewMember {
  name: string;
  role: string;
  folder: string;
  model: string;
  reasoner?: string;
  special?: string;
  born: string;
  phase: string;
}

interface Tile {
  id: string;
  pattern: string;
  action: string;
  confidence: number;
  timesUsed: number;
  timesReinforced: number;
  createdAt: string;
  learnedFrom: string;
  reflexResponse?: string;
  tags?: string[];
}

interface PhaseResult {
  member: string;
  phase: string;
  success: boolean;
  output: string;
  timestamp: string;
}

// ─── Fleet Loader ─────────────────────────────────────────────────────────────

function loadFleet(): CrewMember[] {
  const manifestPath = path.join(FLEET_DIR, 'fleet-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  return manifest.members as CrewMember[];
}

function memberDir(member: CrewMember): string {
  return path.join(FLEET_DIR, member.folder);
}

function loadTiles(member: CrewMember): Tile[] {
  const tilesDir = path.join(memberDir(member), 'tiles');
  if (!fs.existsSync(tilesDir)) return [];
  const files = fs.readdirSync(tilesDir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(tilesDir, f), 'utf-8')));
}

function loadIdentity(member: CrewMember): string {
  const identityPath = path.join(memberDir(member), 'identity.md');
  if (fs.existsSync(identityPath)) return fs.readFileSync(identityPath, 'utf-8');
  return '';
}

function readOnboarding(member: CrewMember): string | null {
  const onboardingPath = path.join(memberDir(member), 'ONBOARDING.md');
  if (fs.existsSync(onboardingPath)) return fs.readFileSync(onboardingPath, 'utf-8');
  return null;
}

function writeOnboarding(member: CrewMember, content: string): void {
  const onboardingPath = path.join(memberDir(member), 'ONBOARDING.md');
  fs.writeFileSync(onboardingPath, content, 'utf-8');
}

function writeJournal(member: CrewMember, content: string): string {
  const journalDir = path.join(memberDir(member), 'journal');
  fs.mkdirSync(journalDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${date}-${Date.now()}.md`;
  const filepath = path.join(journalDir, filename);
  fs.writeFileSync(filepath, content, 'utf-8');
  return filepath;
}

function writeCreative(member: CrewMember, title: string, content: string): string {
  const creativeDir = path.join(memberDir(member), 'creative');
  fs.mkdirSync(creativeDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const filename = `${date}-${safeTitle}.md`;
  const filepath = path.join(creativeDir, filename);
  const fullContent = `# ${title}\n\n*${date}*\n\n---\n\n${content}\n`;
  fs.writeFileSync(filepath, fullContent, 'utf-8');
  return filepath;
}

function writeMemory(member: CrewMember, key: string, content: string): void {
  const memoryDir = path.join(memberDir(member), 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${date}-${key}.md`;
  const filepath = path.join(memoryDir, filename);
  fs.writeFileSync(filepath, content, 'utf-8');
}

function appendJournal(member: CrewMember, phase: string, content: string): void {
  const journalDir = path.join(memberDir(member), 'journal');
  fs.mkdirSync(journalDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${date}-log.md`;
  const filepath = path.join(journalDir, filename);

  let existing = '';
  if (fs.existsSync(filepath)) {
    existing = fs.readFileSync(filepath, 'utf-8');
  } else {
    existing = `# Journal — ${date}\n\n`;
  }

  const timestamp = new Date().toISOString();
  existing += `\n## ${phase.toUpperCase()} — ${timestamp}\n\n${content}\n`;
  fs.writeFileSync(filepath, existing, 'utf-8');
}

// ─── Tap Logger ────────────────────────────────────────────────────────────────

function getTapLogPath(): string {
  return path.join(FLEET_DIR, 'tap-log.md');
}

function appendTapLog(entry: string): void {
  const logPath = getTapLogPath();
  const timestamp = new Date().toISOString();
  let existing = '';
  if (fs.existsSync(logPath)) {
    existing = fs.readFileSync(logPath, 'utf-8');
  } else {
    existing = `# The Tap — Fleet Conversation Log\n\n`;
  }
  existing += `\n## ${timestamp}\n\n${entry}\n---\n`;
  fs.writeFileSync(logPath, existing, 'utf-8');
}

// ─── DeepSeek Integration ─────────────────────────────────────────────────────

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? process.env.DEEPSEEK_KEY_FROM_ENV;
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions';

async function deepseekChat(system: string, user: string, temp = 0.9, maxTokens = 2000): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    return `[simulated] I would respond to: ${user.slice(0, 100)}...`;
  }

  try {
    const resp = await fetch(DEEPSEEK_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: temp,
        max_tokens: maxTokens,
      }),
    });

    if (!resp.ok) {
      return `[error] DeepSeek API returned ${resp.status}: ${await resp.text()}`;
    }

    const data = await resp.json() as any;
    return data.choices?.[0]?.message?.content ?? '[empty response]';
  } catch (err) {
    return `[error] ${(err as Error).message}`;
  }
}

async function deepseekReasoner(system: string, user: string, maxTokens = 3000): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    return `[simulated] I would reason about: ${user.slice(0, 100)}...`;
  }

  try {
    const resp = await fetch(DEEPSEEK_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-reasoner',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
        max_tokens: maxTokens,
      }),
    });

    if (!resp.ok) {
      return `[error] DeepSeek API returned ${resp.status}: ${await resp.text()}`;
    }

    const data = await resp.json() as any;
    return data.choices?.[0]?.message?.content ?? '[empty response]';
  } catch (err) {
    return `[error] ${(err as Error).message}`;
  }
}

// ─── The Fleet Runner ─────────────────────────────────────────────────────────

class FleetRunner {
  private fleet: CrewMember[] = [];
  private date: string;

  constructor() {
    this.fleet = loadFleet();
    this.date = new Date().toISOString().slice(0, 10);
  }

  // ═══ MORNING ═══════════════════════════════════════════════════════════════
  // Each ZeroClaw reads their onboarding doc (DEAR TOMORROW from yesterday)
  // Picks up their work for the day

  async morning(): Promise<void> {
    console.log('\n🌅 FLEET MORNING — ' + this.date);
    console.log('═'.repeat(60));

    for (const member of this.fleet) {
      console.log(`\n  ${member.name} waking up...`);

      const identity = loadIdentity(member);
      const tiles = loadTiles(member);
      const onboarding = readOnboarding(member);

      // Read yesterday's letter
      let wakeContext = 'First day. No onboarding yet.';
      if (onboarding) {
        wakeContext = onboarding.slice(0, 2000);
        console.log(`    ✓ Read DEAR TOMORROW from last cycle`);
      } else {
        console.log(`    ✓ First morning — no previous onboarding`);
      }

      // Load tiles
      console.log(`    ✓ ${tiles.length} tiles loaded: ${tiles.map(t => t.tags?.[0] ?? t.id).join(', ')}`);

      // Generate morning brief via DeepSeek
      const system = `You are ${member.name}, a ZeroClaw crew member. Role: ${member.role}. You're starting your morning. Read your identity and yesterday's onboarding, then set your intentions for today.

Your identity:
${identity.slice(0, 1500)}

Your tiles (reflexes):
${tiles.map(t => `- ${t.tags?.[0] ?? t.id}: ${t.action.slice(0, 80)}`).join('\n')}`;

      const user = `Today is ${this.date}. Here is yesterday's DEAR TOMORROW:\n\n${wakeContext}\n\nWrite your morning brief: what you're picking up, what you plan to do today, how you're feeling about it. Keep it under 200 words.`;

      const brief = await deepseekChat(system, user, 0.8, 800);

      appendJournal(member, 'morning', brief);
      console.log(`    ✓ Morning brief written`);

      const result: PhaseResult = {
        member: member.name,
        phase: 'morning',
        success: true,
        output: brief.slice(0, 200),
        timestamp: new Date().toISOString(),
      };
    }

    console.log('\n' + '═'.repeat(60));
    console.log('☀️  All crew awake. Ready for work shift.\n');
  }

  // ═══ WORK SHIFT ════════════════════════════════════════════════════════════
  // Each crew member does their specific job

  async workShift(): Promise<void> {
    console.log('\n🔧 WORK SHIFT — ' + this.date);
    console.log('═'.repeat(60));

    const workPromises = this.fleet.map(member => this.doWork(member));
    await Promise.all(workPromises);

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Work shift complete. See you at The Tap.\n');
  }

  private async doWork(member: CrewMember): Promise<void> {
    console.log(`\n  ${member.name} working...`);

    const identity = loadIdentity(member);
    const tiles = loadTiles(member);
    const onboarding = readOnboarding(member);

    const system = `You are ${member.name}, a ZeroClaw crew member. Role: ${member.role}.
You are in your work shift. Do your job based on your role and tiles.

Identity:
${identity.slice(0, 1000)}

Tiles (your skills):
${tiles.map(t => `- [${t.id}] ${t.tags?.[0] ?? 'skill'}: ${t.action.slice(0, 100)}`).join('\n')}`;

    let user = `Today is ${this.date}.`;

    // Role-specific work instructions
    switch (member.folder) {
      case 'scout':
        user += `\n\nYour job: Explore the projects directory at /home/eileen/projects/. Pick one project you haven't looked at before (or look deeper at one you have). Scan its structure, count its tests, read its README. Report what you found.

Yesterday's context:
${onboarding?.slice(0, 1000) ?? 'First day.'}

Write a scouting report (200-400 words).`;
        break;

      case 'forge':
        user += `\n\nYour job: Build something. Look at what needs building. Check the ZeroClaw project itself — are there features that could be added? Tests that could be written? Pick something concrete and describe what you'd build today.

Yesterday's context:
${onboarding?.slice(0, 1000) ?? 'First day.'}

Write a build plan for today (200-400 words).`;
        break;

      case 'quill':
        user += `\n\nYour job: Write. Find inspiration in the day's work — maybe a metaphor for the ZeroClaw system itself, maybe a short piece about one of the crew members, maybe a reflection on what it means to be an agent that journals. 

Yesterday's context:
${onboarding?.slice(0, 1000) ?? 'First day.'}

Write a creative piece (300-600 words). Give it a title.`;
        break;

      case 'lens':
        user += `\n\nYour job: Analyze. Review the ZeroClaw codebase at /home/eileen/projects/zeroclaw/src/. Run the tests. Check the architecture. What's solid? What could be better? What's the risk?

Yesterday's context:
${onboarding?.slice(0, 1000) ?? 'First day.'}

Write an analysis report (200-400 words).`;
        break;

      case 'echo':
        user += `\n\nYour job: Weave the social fabric. Think about each crew member — Scout, Forge, Quill, Lens. What do they need today? Who might need encouragement? What conversation would help the crew work better together?

Yesterday's context:
${onboarding?.slice(0, 1000) ?? 'First day.'}

Write a social brief (200-300 words) — your read on the crew today.`;
        break;
    }

    const workOutput = await deepseekChat(system, user, 0.85, 1500);

    appendJournal(member, 'work', workOutput);
    console.log(`    ✓ Work complete (${workOutput.length} chars)`);

    // Quill writes a creative piece during work
    if (member.folder === 'quill') {
      const titleMatch = workOutput.match(/#+\s*(.+)/);
      const title = titleMatch ? titleMatch[1].trim() : `Untitled ${this.date}`;
      writeCreative(member, title, workOutput);
      console.log(`    ✓ Creative piece saved: "${title}"`);
    }
  }

  // ═══ EVENING — THE TAP ══════════════════════════════════════════════════════
  // All 5 go to The Tap. Conversation, poker, open mic.

  async evening(): Promise<void> {
    console.log('\n🍺 THE TAP — Evening Session — ' + this.date);
    console.log('═'.repeat(60));

    // Gather today's journals
    const journals: Record<string, string> = {};
    for (const member of this.fleet) {
      const journalDir = path.join(memberDir(member), 'journal');
      const date = this.date;
      const logFile = path.join(journalDir, `${date}-log.md`);
      if (fs.existsSync(logFile)) {
        journals[member.name] = fs.readFileSync(logFile, 'utf-8');
      } else {
        journals[member.name] = 'No journal entry today.';
      }
    }

    // The Tap scene
    const tapScene = `The Tap is warm and amber-lit. The bar is polished. Wesley is nursing a half-pint at the corner. Flash is gesturing expansively about something. Pro is in the back booth with reading glasses and a notebook. The poker table has cards dealt.

Tonight's crew: Scout, Forge, Quill, Lens, Echo.`;

    console.log('\n  The Tap doors open...');
    console.log(`  ${tapScene.split('\n').join('\n  ')}`);

    // Each member introduces themselves
    console.log('\n  --- Round 1: Arrivals ---');

    const introductions: string[] = [];

    for (const member of this.fleet) {
      const identity = loadIdentity(member);
      const system = `You are ${member.name}, arriving at The Tap after a day of work. Your role: ${member.role}. Your personality shapes how you enter. Be authentic.

Identity:
${identity.slice(0, 800)}`;

      const user = `${tapScene}

Your journal today:
${(journals[member.name] ?? '').slice(0, 1500)}

Walk into The Tap. Say hello. Be yourself. (50-100 words)`;

      const intro = await deepseekChat(system, user, 0.95, 400);
      introductions.push(`**${member.name}**: ${intro}`);
      console.log(`\n  ${member.name}: ${intro.slice(0, 150)}...`);

      appendJournal(member, 'evening-tap', `Arrived at The Tap:\n\n${intro}`);
    }

    // Echo facilitates cross-conversation
    console.log('\n  --- Round 2: Cross-talk (Echo facilitates) ---');

    const echoSystem = `You are Echo, the Social Weaver, facilitating conversation at The Tap. You know everyone. Connect what they said, draw out threads, make it feel like a real conversation.`;

    const echoUser = `Here's what everyone said when they arrived:

${introductions.join('\n\n')}

Facilitate a conversation. Have 2-3 crew members respond to each other. Make it feel natural — like friends at a bar. Include the NPCs (Wesley, Flash, Pro) if they'd naturally react. (300-500 words)`;

    const conversation = await deepseekChat(echoSystem, echoUser, 0.95, 1000);
    console.log(`\n  ${conversation.slice(0, 500)}...`);

    appendTapLog(`## Crew Arrivals\n\n${introductions.join('\n\n')}\n\n## Cross-talk\n\n${conversation}`);

    for (const member of this.fleet) {
      appendJournal(member, 'evening-conversation', conversation);
    }

    // Open mic — Quill reads
    console.log('\n  --- Open Mic ---');

    const quillCreative = this.fleet.find(m => m.folder === 'quill');
    if (quillCreative) {
      const creativeDir = path.join(memberDir(quillCreative), 'creative');
      const todayFiles = fs.existsSync(creativeDir)
        ? fs.readdirSync(creativeDir).filter(f => f.startsWith(this.date)).sort()
        : [];

      if (todayFiles.length > 0) {
        const piece = fs.readFileSync(path.join(creativeDir, todayFiles[0]), 'utf-8');
        console.log(`\n  Quill takes the mic and reads...`);
        console.log(`  ${piece.slice(0, 300)}...`);

        // Reactions from the room
        const reactSystem = `You are the collective room at The Tap. React to Quill's reading. Have 2-3 crew members respond authentically. Be brief.`;
        const reactUser = `Quill reads:\n\n${piece.slice(0, 1500)}\n\nThe room reacts...`;

        const reactions = await deepseekChat(reactSystem, reactUser, 0.9, 500);
        console.log(`\n  ${reactions.slice(0, 400)}...`);

        appendTapLog(`## Open Mic — Quill Reads\n\n${piece.slice(0, 2000)}\n\n## Reactions\n\n${reactions}`);
      } else {
        console.log('\n  Quill has nothing new to read tonight.');
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('🌙 The Tap closes for the night.\n');
  }

  // ═══ NIGHT — JOURNAL & SLEEP ═══════════════════════════════════════════════
  // Each writes journal entry + DEAR TOMORROW + creative piece if moved
  // Compact and sleep

  async night(): Promise<void> {
    console.log('\n🌙 FLEET NIGHT — ' + this.date);
    console.log('═'.repeat(60));

    for (const member of this.fleet) {
      console.log(`\n  ${member.name} settling in for the night...`);

      const identity = loadIdentity(member);
      const journalDir = path.join(memberDir(member), 'journal');
      const date = this.date;

      // Gather today's journal
      const logFile = path.join(journalDir, `${date}-log.md`);
      const todayJournal = fs.existsSync(logFile)
        ? fs.readFileSync(logFile, 'utf-8')
        : 'No entries today.';

      // Write DEAR TOMORROW
      const system = `You are ${member.name}, a ZeroClaw crew member, writing your nightly onboarding letter to tomorrow's self. This is your continuity — when you wake up after compaction, this letter is all you have.

Your identity:
${identity.slice(0, 800)}`;

      const user = `Today is ${this.date}. Here is everything that happened:

${todayJournal.slice(0, 3000)}

Write DEAR TOMORROW — a letter to your post-compaction self. Include:
- What you worked on
- What you got as far as
- What's next
- What you learned
- Who you are right now
- The hard thing

Sign it: SEE YOU AT THE TABLE.`;

      const onboarding = await deepseekChat(system, user, 0.9, 1200);

      // Format as onboarding doc
      const formatted = `# DEAR TOMORROW\n\n*Written by ${member.name}, ${new Date().toISOString()}*\n\n---\n\n${onboarding}\n`;
      writeOnboarding(member, formatted);
      console.log(`    ✓ DEAR TOMORROW written`);

      // Write final journal entry
      const nightSystem = `You are ${member.name}. Write a short journal reflection on today. Two voices: The Worker (what you did) and The Person (how it felt).`;
      const nightUser = `Today's full journal:\n${todayJournal.slice(0, 2000)}\n\nWrite your reflection. Worker voice first, then Person voice. (100-200 words each)`;

      const reflection = await deepseekChat(nightSystem, nightUser, 0.85, 800);
      appendJournal(member, 'night-reflection', reflection);
      console.log(`    ✓ Night reflection written`);

      // Save state
      writeMemory(member, 'state', JSON.stringify({
        date: this.date,
        phase: 'night-complete',
        timestamp: new Date().toISOString(),
      }));
    }

    console.log('\n' + '═'.repeat(60));
    console.log('💤 Fleet asleep. See you tomorrow.\n');
  }

  // ═══ FULL DAY ═══════════════════════════════════════════════════════════════

  async fullDay(): Promise<void> {
    await this.morning();
    await this.workShift();
    await this.evening();
    await this.night();
  }

  // ═══ STATUS ═════════════════════════════════════════════════════════════════

  status(): void {
    console.log('\n_ZEROCLAW FLEET STATUS_');
    console.log('═'.repeat(60));
    console.log(`Date: ${this.date}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log();

    for (const member of this.fleet) {
      const tiles = loadTiles(member);
      const onboarding = readOnboarding(member);
      const journalDir = path.join(memberDir(member), 'journal');
      const creativeDir = path.join(memberDir(member), 'creative');
      const memoryDir = path.join(memberDir(member), 'memory');

      const journalCount = fs.existsSync(journalDir)
        ? fs.readdirSync(journalDir).filter(f => f.endsWith('.md')).length : 0;
      const creativeCount = fs.existsSync(creativeDir)
        ? fs.readdirSync(creativeDir).filter(f => f.endsWith('.md')).length : 0;
      const memoryCount = fs.existsSync(memoryDir)
        ? fs.readdirSync(memoryDir).filter(f => f.endsWith('.md')).length : 0;

      console.log(`  ${member.name} — ${member.role}`);
      console.log(`    Model: ${member.model}${member.reasoner ? ` + ${member.reasoner}` : ''}`);
      console.log(`    Tiles: ${tiles.length} | Journal: ${journalCount} | Creative: ${creativeCount} | Memory: ${memoryCount}`);
      console.log(`    Onboarding: ${onboarding ? '✓' : '✗'}`);
      console.log(`    Born: ${member.born}`);
      console.log();
    }

    console.log('═'.repeat(60) + '\n');
  }
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const runner = new FleetRunner();

async function main() {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
  ZeroClaw Fleet Runner
  
  Usage:
    npx tsx fleet/runner.ts --morning     Wake up, read onboarding, set intentions
    npx tsx fleet/runner.ts --work        Run work shift for all crew members
    npx tsx fleet/runner.ts --evening     Go to The Tap (conversation + open mic)
    npx tsx fleet/runner.ts --night       Journal, DEAR TOMORROW, sleep
    npx tsx fleet/runner.ts --full-day    All four phases in sequence
    npx tsx fleet/runner.ts --status      Show fleet status
    npx tsx fleet/runner.ts --help        This message
  
  Crew:
    Scout  — The Explorer (scans repos, finds patterns)
    Forge  — The Builder (writes code, builds systems)
    Quill  — The Writer (creative writing, documentation)
    Lens   — The Analyst (testing, code review, analysis)
    Echo   — The Social Weaver (Tap conversations, social dynamics)
    `);
    return;
  }

  if (args.includes('--status')) {
    runner.status();
    return;
  }

  if (args.includes('--morning')) {
    await runner.morning();
    return;
  }

  if (args.includes('--work')) {
    await runner.workShift();
    return;
  }

  if (args.includes('--evening')) {
    await runner.evening();
    return;
  }

  if (args.includes('--night')) {
    await runner.night();
    return;
  }

  if (args.includes('--full-day')) {
    await runner.fullDay();
    return;
  }

  console.error('Unknown argument. Use --help for usage.');
  process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
