// skills.ts — "I Know Kung Fu"
// Skills change HOW the agent thinks, not WHAT tools it has.

export interface Skill {
  name: string;
  description: string;
  load: () => void;
  unload: () => void;
  think: (context: string) => string;
}

const registry = new Map<string, Skill>();

export function registerSkill(skill: Skill): void {
  registry.set(skill.name, skill);
}

export function getSkill(name: string): Skill | undefined {
  return registry.get(name);
}

export function listSkills(): Skill[] {
  return Array.from(registry.values());
}

export function removeSkill(name: string): boolean {
  return registry.delete(name);
}

// Built-in skills

export const socraticSkill: Skill = {
  name: 'socratic',
  description: 'Responds by asking probing questions instead of giving answers',
  load() { /* no-op */ },
  unload() { /* no-op */ },
  think(context: string): string {
    return `[socratic] Before answering, consider: What assumptions are being made? What's the underlying question?] ${context}`;
  },
};

export const debugSkill: Skill = {
  name: 'debug',
  description: 'Analyzes problems systematically, looking for root causes',
  load() { /* no-op */ },
  unload() { /* no-op */ },
  think(context: string): string {
    return `[debug] Break this down: 1) What's the symptom? 2) What changed recently? 3) What's the simplest reproduction?] ${context}`;
  },
};

export const refactorSkill: Skill = {
  name: 'refactor',
  description: 'Thinks about code quality, DRY, SOLID principles',
  load() { /* no-op */ },
  unload() { /* no-op */ },
  think(context: string): string {
    return `[refactor] Consider: Is this DRY? Does it follow SOLID? Can it be simpler?] ${context}`;
  },
};

// Register built-ins
registerSkill(socraticSkill);
registerSkill(debugSkill);
registerSkill(refactorSkill);
