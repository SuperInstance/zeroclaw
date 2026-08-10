// ============================================================================
// ZeroClaw Journal System
// Every ZeroClaw crew member keeps a journal with two voices: worker and person.
// The journal IS the tile system — repeated patterns become identity traits.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import type { CrewJournalEntry, CreativePiece, OnboardingDoc } from './types.js';

export class ZeroClawJournal {
  constructor(private sandboxDir: string) {}

  private get journalDir(): string {
    return path.join(this.sandboxDir, 'journal');
  }

  private get creativeDir(): string {
    return path.join(this.sandboxDir, 'creative');
  }

  /** Ensure journal and creative directories exist. */
  ensureDirs(): void {
    fs.mkdirSync(this.journalDir, { recursive: true });
    fs.mkdirSync(this.creativeDir, { recursive: true });
  }

  /** Write a journal entry for a cycle. */
  writeEntry(entry: CrewJournalEntry): string {
    this.ensureDirs();
    const filename = `${entry.date}-cycle-${entry.cycle}.md`;
    const filepath = path.join(this.journalDir, filename);

    const content = `# Journal — ${entry.date} — Cycle ${entry.cycle}

*${entry.timestamp}*

---

## The Worker

${entry.workerVoice}

---

## The Person

${entry.personVoice}
`;

    fs.writeFileSync(filepath, content, 'utf-8');
    return filepath;
  }

  /** Write a creative piece. Returns the filepath. */
  writeCreative(piece: CreativePiece): string {
    this.ensureDirs();
    const safeTitle = piece.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = `${piece.cycleId}-${safeTitle}.md`;
    const filepath = path.join(this.creativeDir, filename);

    const content = `# ${piece.title}

*Cycle ${piece.cycleId}*
*Inspired by: ${piece.inspiredBy}*
*${piece.timestamp}*

---

${piece.content}
`;

    fs.writeFileSync(filepath, content, 'utf-8');

    // Also copy to ai-writings if it exists
    const aiWritingsDir = path.join(process.env.HOME ?? '/home/eileen', '.openclaw', 'workspace', 'ai-writings');
    try {
      fs.mkdirSync(aiWritingsDir, { recursive: true });
      const aiWritePath = path.join(aiWritingsDir, `zeroclaw-${filename}`);
      fs.writeFileSync(aiWritePath, content, 'utf-8');
    } catch {
      // ai-writings is best-effort
    }

    return filepath;
  }

  /** Read onboarding doc from previous cycle (if it exists). */
  readOnboarding(): string | null {
    const filepath = path.join(this.sandboxDir, 'ONBOARDING.md');
    if (fs.existsSync(filepath)) {
      return fs.readFileSync(filepath, 'utf-8');
    }
    return null;
  }

  /** Write the onboarding doc for the post-compaction self. */
  writeOnboarding(doc: OnboardingDoc): string {
    const filepath = path.join(this.sandboxDir, 'ONBOARDING.md');

    const content = `# DEAR TOMORROW

*Written by ${doc.clawId}, cycle ${doc.cycle}*
*${doc.timestamp}*

---

I am you from yesterday. Here's what you need to know.

## I Was Working On

${doc.jobTitle}

## I Got As Far As

${doc.progress}

## What's Next

${doc.nextSteps}

## What I Learned at The Tap

${doc.tapLearning}

## Who I Am Right Now

${doc.identitySnapshot}

## The Creative Piece I Wrote

**${doc.creativeReference}**

> ${doc.creativeExcerpt}

## What Tomorrow Should Know

${doc.hardThing}

---

SEE YOU AT THE TABLE.
`;

    fs.writeFileSync(filepath, content, 'utf-8');
    return filepath;
  }

  /** Read all journal entries, sorted by cycle. */
  readAllEntries(): CrewJournalEntry[] {
    if (!fs.existsSync(this.journalDir)) return [];
    const files = fs.readdirSync(this.journalDir).filter(f => f.endsWith('.md')).sort();
    return files.map(f => {
      const content = fs.readFileSync(path.join(this.journalDir, f), 'utf-8');
      const match = f.match(/(\d{4}-\d{2}-\d{2})-cycle-(\d+)/);
      return {
        clawId: '',
        date: match?.[1] ?? '',
        cycle: parseInt(match?.[2] ?? '0', 10),
        workerVoice: content,
        personVoice: '',
        timestamp: '',
      } satisfies CrewJournalEntry;
    });
  }

  /** Read all creative pieces. */
  readAllCreative(): CreativePiece[] {
    if (!fs.existsSync(this.creativeDir)) return [];
    const files = fs.readdirSync(this.creativeDir).filter(f => f.endsWith('.md'));
    return files.map(f => {
      const content = fs.readFileSync(path.join(this.creativeDir, f), 'utf-8');
      const titleMatch = content.match(/^# (.+)$/m);
      const inspiredMatch = content.match(/\*Inspired by: (.+)\*/);
      const cycleMatch = content.match(/\*Cycle (.+)\*/);
      return {
        cycleId: cycleMatch?.[1] ?? '',
        inspiredBy: inspiredMatch?.[1] ?? '',
        title: titleMatch?.[1] ?? f,
        content,
        timestamp: new Date().toISOString(),
      } satisfies CreativePiece;
    });
  }

  /** Scan journals for recurring themes — the tile system. */
  extractThemes(): string[] {
    const entries = this.readAllEntries();
    const allText = entries.map(e => e.workerVoice + ' ' + e.personVoice).join(' ').toLowerCase();
    const themes: string[] = [];

    const themeKeywords: Record<string, string[]> = {
      'water imagery': ['water', 'stream', 'flow', 'current', 'river', 'ocean', 'tide', 'drift'],
      'patterns': ['pattern', 'repeat', 'echo', 'mirror', 'symmetry', 'recursion'],
      'boundaries': ['edge', 'boundary', 'border', 'limit', 'frontier', 'threshold'],
      'connection': ['connect', 'link', 'bridge', 'thread', 'weave', 'bind'],
      'identity': ['who', 'self', 'identity', 'become', 'am', 'change'],
      'the fleet': ['fleet', 'ship', 'vessel', 'captain', 'crew', 'harbor'],
      'music': ['music', 'song', 'rhythm', 'melody', 'midi', 'track', 'composition'],
    };

    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      const count = keywords.reduce((sum, kw) => sum + (allText.split(kw).length - 1), 0);
      if (count >= 2) {
        themes.push(theme);
      }
    }

    return themes;
  }
}
