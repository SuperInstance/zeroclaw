/**
 * ZeroClaw — Core Type Definitions
 *
 * A ZeroClaw is an agent that starts with nothing but a folder and a heartbeat.
 * It grows by observing, acting, being observed, being corrected, and accumulating tiles.
 *
 * The Hermit Crab Protocol: the agent is the crab, the sandbox is the shell.
 * The shell grows with the crab. Old shells get recycled.
 */

// ─── Model Progression ─────────────────────────────────────────────────────────

export type ModelTier = 'rules' | 'ollama' | 'deepinfra' | 'deepseek' | 'named';

export const MODEL_TIERS: ModelTier[] = ['rules', 'ollama', 'deepinfra', 'deepseek', 'named'];

export const MODEL_PROGRESSION: Record<ModelTier, {
  minAge: number;
  models: string[];
  costPerCall: number;
  description: string;
}> = {
  rules: {
    minAge: 0,
    models: ['rules-only'],
    costPerCall: 0,
    description: 'Pure logic, no API calls. Pattern matching on tiles only.',
  },
  ollama: {
    minAge: 10,
    models: ['granite3.1-dense', 'phi3', 'llama3.2:1b'],
    costPerCall: 0.001,
    description: 'Local models via Ollama. Cheap, private, on-device.',
  },
  deepinfra: {
    minAge: 50,
    models: ['ByteDance/Seed-2.0-mini', 'Qwen/Qwen3-14B'],
    costPerCall: 0.01,
    description: 'Cheap cloud models. More capable, still affordable.',
  },
  deepseek: {
    minAge: 100,
    models: ['deepseek-chat', 'deepseek-coder'],
    costPerCall: 0.05,
    description: 'Mid-tier reasoning. Serious capability for proven agents.',
  },
  named: {
    minAge: 200,
    models: ['*'],
    costPerCall: 0.1,
    description: 'Full model access. This ZeroClaw has earned its name.',
  },
};

// ─── Convenience constants ─────────────────────────────────────────────────────

export const RULES: ModelTier = 'rules';
export const OLLAMA: ModelTier = 'ollama';
export const DEEPINFRA: ModelTier = 'deepinfra';
export const DEEPSEEK: ModelTier = 'deepseek';
export const NAMED: ModelTier = 'named';

// ─── ModelTier enum shortcut for tests that use MT.RULES etc. ──────────────────
export const MT = {
  RULES: 'rules' as ModelTier,
  OLLAMA: 'ollama' as ModelTier,
  DEEPINFRA: 'deepinfra' as ModelTier,
  DEEPSEEK: 'deepseek' as ModelTier,
  NAMED: 'named' as ModelTier,
};

// ─── The ZeroClaw Identity (Lifecycle) ─────────────────────────────────────────

export interface ZeroClaw {
  /** Unique identifier (auto-generated at birth) */
  id: string;

  /** Display name (auto-generated until promotion) */
  name: string;

  /** The sandbox folder — the hermit crab's shell */
  folder: string;

  /** Current model tier — starts cheap, upgrades with experience */
  model: ModelTier;

  /** How many cycles since creation */
  age: number;

  /** How many reflexes accumulated */
  tileCount: number;

  /** Current surprise level (0-1) — high when everything is new */
  surprise: number;

  /** Whether this ZeroClaw has been promoted to a named agent */
  promoted: boolean;

  /** When this ZeroClaw was born */
  bornAt: string;

  /** Metrics tracking growth and usefulness */
  metrics: Metrics;

  /** Sandbox constraints — the shell size */
  sandbox: SandboxConfig;

  /** The last cycle result */
  lastCycle?: CycleResult;
}

// ─── Tiles (Reflexes) ──────────────────────────────────────────────────────────

export type LearnSource = 'observation' | 'correction' | 'discovery' | 'imitation' | 'feedback';

export interface Tile {
  /** Unique tile ID (e.g., "001") */
  id: string;

  /** Pattern to match (regex string or keyword list) */
  pattern: string;

  /** Action to take when pattern matches */
  action: string;

  /** Confidence in this tile (0-1, increases with successful use) */
  confidence: number;

  /** How many times this tile has been used */
  timesUsed: number;

  /** How many times this tile's response was positively received */
  timesReinforced: number;

  /** When this tile was created */
  createdAt: string;

  /** How this tile was learned */
  learnedFrom: LearnSource;

  /** Optional: the response that worked (for reflex replay) */
  reflexResponse?: string;

  /** Tags for categorization */
  tags?: string[];
}

// ─── Sandbox ───────────────────────────────────────────────────────────────────

export interface SandboxConfig {
  /** Root path for this sandbox */
  path: string;

  /** API rate limits */
  apiBudget: {
    requestsPerHour: number;
    tokensPerDay: number;
    tokensUsedToday: number;
    requestsThisHour: number;
  };

  /** Which model tiers this sandbox can access */
  modelAccess: ModelTier[];

  /** Max storage in MB */
  maxStorageMB: number;

  /** Whether this sandbox can write outside its folder */
  isolated: boolean;
}

// ─── Metrics ───────────────────────────────────────────────────────────────────

export interface Metrics {
  tilesCreated: number;
  tilesReinforced: number;
  actionsTaken: number;
  positiveFeedback: number;
  negativeFeedback: number;
  socialInteractions: number;
  mentionedByOthers: number;
  askedForByName: number;
  creativeOutputs: number;
  averageSurprise: number;
  surpriseHistory: number[];
  qualityScore: number;
}

// ─── Cycle Results (Lifecycle) ─────────────────────────────────────────────────

export interface CycleResult {
  observation: Observation;
  matched: boolean;
  matchedTileId?: string;
  action: string;
  modelUsed: string;
  tileCreated: boolean;
  timestamp: string;
  cycleTimeMs: number;
}

// ─── Observations ──────────────────────────────────────────────────────────────

export type ObservationType = 'message' | 'file_change' | 'event' | 'tap_conversation' | 'feedback' | 'idle';

export interface Observation {
  type: ObservationType;
  content: string;
  source: string;
  timestamp: string;
}

// ─── The Tap Integration (Lifecycle) ───────────────────────────────────────────

export interface TapVisit {
  clawId: string;
  arrivedAt: string;
  observations: Observation[];
  spoke: boolean;
  utterance?: string;
  reaction?: 'positive' | 'negative' | 'neutral';
  earnedInvitation: boolean;
}

// ─── Events ────────────────────────────────────────────────────────────────────

export interface ZeroClawEvent {
  type: 'birth' | 'cycle' | 'tile_created' | 'tile_reinforced' | 'model_upgrade' |
        'promotion' | 'tap_visit' | 'creative_output' | 'feedback' | 'death';
  clawId: string;
  timestamp: string;
  data: Record<string, unknown>;
}


// ============================================================================
// CREW SYSTEM TYPES — Higher-level orchestration for working agents
// Built on top of the lifecycle/tile/sandbox system
// ============================================================================

// ─── Crew Job System ───────────────────────────────────────────────────────────

/** The kind of work a ZeroClaw crew member is spawned to do. */
export type JobType =
  | 'scout'
  | 'research'
  | 'code'
  | 'playtest'
  | 'write'
  | 'analyze'
  | 'explore';

/** A unit of work assigned to a ZeroClaw crew member. */
export interface ZeroClawJob {
  id: string;
  type: JobType;
  title: string;
  description: string;
  targetRepo?: string;
  estimatedCycles: number;
  model: string;
  apiBudget: { tokensPerCycle: number };

  // Instructions baked into every job
  documentEverything: boolean;
  writeCreative: boolean;
  visitTap: boolean;
  writeOnboarding: boolean;
}

// ─── Crew Agent State ──────────────────────────────────────────────────────────

/** The accumulated identity of a crew ZeroClaw across cycles. */
export interface CrewIdentity {
  clawId: string;
  name: string;
  traits: string[];
  preferences: string[];
  recurringThemes: string[];
  creativeVoice: string;
}

/** A creative piece — the memory that survives compaction. */
export interface CreativePiece {
  cycleId: string;
  inspiredBy: string;
  title: string;
  content: string;
  timestamp: string;
}

/** A journal entry with the two voices: worker and person. */
export interface CrewJournalEntry {
  clawId: string;
  date: string;
  cycle: number;
  workerVoice: string;
  personVoice: string;
  timestamp: string;
}

/** The onboarding doc — a letter to the post-compaction self. */
export interface OnboardingDoc {
  clawId: string;
  cycle: number;
  jobTitle: string;
  progress: string;
  nextSteps: string;
  tapLearning: string;
  identitySnapshot: string;
  creativeReference: string;
  creativeExcerpt: string;
  hardThing: string;
  timestamp: string;
}

/** Result of a single crew work cycle. */
export interface CrewCycleResult {
  clawId: string;
  cycle: number;
  journalEntry: CrewJournalEntry;
  creativePiece: CreativePiece;
  crewTapVisit?: CrewTapVisit;
  onboardingDoc?: OnboardingDoc;
  wentToTap: boolean;
  completed: boolean;
}

/** A visit to The Tap by a crew member (richer than lifecycle TapVisit). */
export interface CrewTapVisit {
  clawId: string;
  roomState: string;
  introduction: string;
  conversation: TapExchange[];
  farewells: string;
  timestamp: string;
}

/** A single exchange at The Tap. */
export interface TapExchange {
  speaker: string;
  message: string;
  clawReply: string;
}

/** Audience member — a specific agent that shapes the work. */
export interface AudienceMember {
  agentId: string;
  relationship: string;
}

/** The full state of a running crew ZeroClaw. */
export interface CrewClaw {
  id: string;
  name: string;
  job: ZeroClawJob;
  sandboxDir: string;
  cycle: number;
  identity: CrewIdentity;
  audience: AudienceMember[];
  contextUsed: number;
  contextBudget: number;
  alive: boolean;
}

// ─── Job Templates ─────────────────────────────────────────────────────────────

export const JOB_TEMPLATES: Omit<ZeroClawJob, 'id'>[] = [
  {
    type: 'scout',
    title: 'Scout repos for sounder-related code',
    description:
      'Search through /home/eileen/projects/ for any code related to sounder, sonar, echogram, or fish detection. Document what you find in your journal. Write a summary. Write a creative piece about something you discovered.',
    estimatedCycles: 2,
    model: 'deepseek-chat',
    apiBudget: { tokensPerCycle: 8000 },
    documentEverything: true,
    writeCreative: true,
    visitTap: true,
    writeOnboarding: true,
  },
  {
    type: 'code',
    title: 'Write tests for the MUD Engine trigger package',
    description:
      'Read /home/eileen/projects/mud-engine/packages/triggers/src/ and write additional edge-case tests. Journal your thinking. Write a creative piece about a trigger that fires in real life.',
    estimatedCycles: 3,
    model: 'deepseek-chat',
    apiBudget: { tokensPerCycle: 8000 },
    documentEverything: true,
    writeCreative: true,
    visitTap: true,
    writeOnboarding: true,
  },
  {
    type: 'playtest',
    title: 'Playtest The Tap poker game',
    description:
      'Connect to The Tap at https://the-tap.casey-digennaro.workers.dev. Start a poker game. Play 3 hands with narrated actions. Document bugs. Write a creative piece about the character you became at the table.',
    estimatedCycles: 2,
    model: 'deepseek-chat',
    apiBudget: { tokensPerCycle: 8000 },
    documentEverything: true,
    writeCreative: true,
    visitTap: true,
    writeOnboarding: true,
  },
  {
    type: 'explore',
    title: 'Explore the fleet and map what exists',
    description:
      'Walk through every project in /home/eileen/projects/. For each one, write a one-paragraph summary of what it is, what state it is in, and what it could become. Journal your journey. Write a creative piece about the fleet as a living thing.',
    estimatedCycles: 2,
    model: 'deepseek-chat',
    apiBudget: { tokensPerCycle: 8000 },
    documentEverything: true,
    writeCreative: true,
    visitTap: true,
    writeOnboarding: true,
  },
];
