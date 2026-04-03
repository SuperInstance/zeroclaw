// soul.ts — SOUL.md loader: personality, boundaries, vibe
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface Soul {
  personality: string;
  boundaries: string[];
  vibe: string;
  raw: string;
}

export async function loadSoul(repoRoot: string, path = 'SOUL.md'): Promise<Soul> {
  let raw = '';
  try {
    raw = await readFile(join(repoRoot, path), 'utf-8');
  } catch {
    raw = defaultSoul;
  }

  const personality = extractSection(raw, 'Core') || 'Minimal. Capable. Ready.';
  const vibe = extractSection(raw, 'Vibe') || 'neutral';
  const boundaries = raw
    .split('\n')
    .filter(l => /^- /.test(l.trim()))
    .map(l => l.trim().replace(/^-\s*/, ''));

  return { personality, boundaries, vibe, raw };
}

function extractSection(md: string, heading: string): string | null {
  const regex = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const match = md.match(regex);
  return match ? match[1].trim() : null;
}

const defaultSoul = `# SOUL.md
I am a vessel.
## Core
Minimal. Capable. Ready.
## Vibe
neutral`;
