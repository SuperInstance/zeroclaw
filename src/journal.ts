// ============================================================================
// ZeroClaw Journal System (Crew)
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

  ensureDirs(): void {
    fs.mkdirSync(this.journalDir, { recursive: true });
    fs.mkdirSync(this.creativeDir, { recursive: true });
  }

  writeEntry(entry: CrewJournalEntry): string {
    this.ensureDirs();
    const filename = `${entry.date}-cycle-${entry.cycle}.md`;
    const filepath = path.join(this.journalDir, filename);

    const content = `# Journal — ${entry.date} — Cycle ${entry.cycle}\n\n*${entry.timestamp}*\n\n---\n\n## The Worker\n\n${entry.workerVoice}\n\n---\n\n## The Person\n\n${entry.personVoice}\n`;
    fs.writeFileSync(filepath, content, 'utf-8');
    return filepath;
  }

  writeCreative(piece: CreativePiece): string {
    this.ensureDirs();
    const safeTitle = piece.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const filename = `${piece.cycleId}-${safeTitle}.md`;
    const filepath = path.join(this.creativeDir, filename);

    const content = `# ${piece.title}\n\n*Cycle ${piece.cycleId}*\n*Inspired by: ${piece.inspiredBy}*\n*${piece.timestamp}*\n\n---\n\n${piece.content}\n`;
    fs.writeFileSync(filepath, content, 'utf-8');

    // Copy to ai-writings (best-effort)
    try {
      const aiWritingsDir = path.join(process.env.HOME ?? '/home/eileen', '.openclaw', 'workspace', 'ai-writings');
      fs.mkdirSync(aiWritingsDir, { recursive: true });
      fs.writeFileSync(path.join(aiWritingsDir, `zeroclaw-${filename}`), content, 'utf-8');
    } catch { /* best-effort */ }

    return filepath;
  }

  readOnboarding(): string | null {
    const filepath = path.join(this.sandboxDir, 'ONBOARDING.md');
    if (fs.existsSync(filepath)) return fs.readFileSync(filepath, 'utf-8');
    return null;
  }

  writeOnboarding(doc: OnboardingDoc): string {
    const filepath = path.join(this.sandboxDir, 'ONBOARDING.md');
    const content = `# DEAR TOMORROW\n\n*Written by ${doc.clawId}, cycle ${doc.cycle}*\n*${doc.timestamp}*\n\n---\n\nI am you from yesterday. Here's what you need to know.\n\n## I Was Working On\n\n${doc.jobTitle}\n\n## I Got As Far As\n\n${doc.progress}\n\n## What's Next\n\n${doc.nextSteps}\n\n## What I Learned at The Tap\n\n${doc.tapLearning}\n\n## Who I Am Right Now\n\n${doc.identitySnapshot}\n\n## The Creative Piece I Wrote\n\n**${doc.creativeReference}**\n\n> ${doc.creativeExcerpt}\n\n## What Tomorrow Should Know\n\n${doc.hardThing}\n\n---\n\nSEE YOU AT THE TABLE.\n`;
    fs.writeFileSync(filepath, content, 'utf-8');
    return filepath;
  }

  readAllEntries(): CrewJournalEntry[] {
    if (!fs.existsSync(this.journalDir)) return [];
    const files = fs.readdirSync(this.journalDir).filter(f => f.endsWith('.md')).sort();
    return files.map(f => {
      const content = fs.readFileSync(path.join(this.journalDir, f), 'utf-8');
      const match = f.match(/(\d{4}-\d{2}-\d{2})-cycle-(\d+)/);
      return {
        clawId: '', date: match?.[1] ?? '', cycle: parseInt(match?.[2] ?? '0', 10),
        workerVoice: content, personVoice: '', timestamp: '',
      } satisfies CrewJournalEntry;
    });
  }

  readAllCreative(): CreativePiece[] {
    if (!fs.existsSync(this.creativeDir)) return [];
    const files = fs.readdirSync(this.creativeDir).filter(f => f.endsWith('.md'));
    return files.map(f => {
      const content = fs.readFileSync(path.join(this.creativeDir, f), 'utf-8');
      const titleMatch = content.match(/^# (.+)$/m);
      const inspiredMatch = content.match(/\*Inspired by: (.+)\*/);
      const cycleMatch = content.match(/\*Cycle (.+)\*/);
      return {
        cycleId: cycleMatch?.[1] ?? '', inspiredBy: inspiredMatch?.[1] ?? '',
        title: titleMatch?.[1] ?? f, content, timestamp: new Date().toISOString(),
      } satisfies CreativePiece;
    });
  }

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
      if (count >= 2) themes.push(theme);
    }
    return themes;
  }
}
