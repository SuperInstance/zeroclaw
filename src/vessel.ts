// vessel.ts — Vessel factory: agent + skills + equipment + soul = vessel
import { Agent } from './agent.js';
import { Soul, loadSoul } from './soul.js';
import { IO } from './io.js';
import { Skill, listSkills as listAvailableSkills } from './skills.js';
import { Equipment, listEquipment as listAvailableEquipment } from './equipment.js';

export interface VesselConfig {
  repoRoot: string;
  soulPath?: string;
  skills?: string[];
  equipment?: string[];
}

export interface Vessel {
  agent: Agent;
  soul: Soul;
  io: IO;
  start: () => void;
  run: (input: string) => Promise<string>;
  info: () => { skills: string[]; equipment: string[]; soul: string };
}

export async function createVessel(config: VesselConfig): Promise<Vessel> {
  const io = new IO(config.repoRoot);
  const soul = await loadSoul(config.repoRoot, config.soulPath);
  const agent = new Agent(soul, io);

  // Load requested skills
  const available = listAvailableSkills();
  const loadedSkills: string[] = [];
  for (const name of config.skills ?? []) {
    const skill = available.find(s => s.name === name);
    if (skill) { agent.addSkill(skill); loadedSkills.push(name); }
  }

  // Mount requested equipment
  const availableEq = listAvailableEquipment();
  const mountedEq: string[] = [];
  for (const name of config.equipment ?? []) {
    const eq = availableEq.find(e => e.name === name);
    if (eq) { await eq.mount(); agent.addEquipment(eq); mountedEq.push(name); }
  }

  return {
    agent,
    soul,
    io,
    start: () => agent.startREPL(),
    run: (input: string) => agent.run(input),
    info: () => ({
      skills: loadedSkills,
      equipment: mountedEq,
      soul: soul.vibe,
    }),
  };
}
