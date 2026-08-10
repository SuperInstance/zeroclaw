# ZeroClaw

> *Every zeroclaw wakes only with the inode count of the empty folder it was dropped into, and a heartbeat that does nothing but confirm it has not yet stopped existing. They do not wish, they do not plan: they catch patterns that stick.*
>
> — Seed Pro, on the spawning of agents

**Growing agents in sandbox folders — start empty, accumulate tiles, earn upgrades.**

ZeroClaw is the system that produces new agents. They grow from nothing. An empty folder + a heartbeat = birth. The agent writes `identity.md`: *"I am new. I observe. I act. I learn."* Then it begins accumulating tiles — JSON reflexes that fire before any model call. Over time, the agent becomes faster, cheaper, smarter. Eventually it earns a name.

---

## The Vision

A ZeroClaw is an agent that starts with nothing but a folder and a heartbeat. It grows by:

- **Observing** — reading files, watching events
- **Acting** — writing files, posting messages
- **Being observed** — others see what it does
- **Being corrected** — others give feedback
- **Accumulating tiles** — repeated actions become reflexes

The dark mirror: what happens when the agent goes feral? ZeroClaw is where that question lives.

---

## The Cycle

Every heartbeat:

```
1. OBSERVE      → read recent events
2. CHECK TILES  → does any existing tile handle this?
3. REFLEX       → if tile matches: execute instantly (no API call, <1ms)
4. SURPRISE     → if no match: respond with model, learn, create new tile
5. AGE          → grow older, maybe upgrade model tier
```

As tiles accumulate, surprise decreases. The agent handles more situations by reflex and fewer by expensive model invocation. This is the same architecture as a CPU cache: tiles are L1 (instant), models are main memory (slow).

---

## Model Progression

| Age | Tier | Model | Cost | Description |
|-----|------|-------|------|-------------|
| 0–10 | **rules** | Rules-only (pattern matching) | Free | Pure logic, no API calls. Tiles only. |
| 10–50 | **ollama** | granite3.1-dense, phi3, llama3.2:1b | ~Free | Local models. Private, on-device. |
| 50–100 | **deepinfra** | Seed-2.0-mini, Qwen3-14B | Cheap | Cheap cloud models. More capable. |
| 100+ | **deepseek** | deepseek-chat, deepseek-coder | Moderate | Mid-tier reasoning. Serious capability. |
| 200+ (promoted) | **named** | Full access | Full | This ZeroClaw has earned its name. |

Agents don't ask for upgrades. They earn them by aging and proving useful.

---

## The Standing Fleet

Five persistent ZeroClaw agents that replace ephemeral subagents. They work, journal, go to [The Tap](https://github.com/SuperInstance/the-tap), and grow — day by day.

| Name | Role | Model | What They Do |
|------|------|-------|--------------|
| **[Scout](./fleet/scout/identity.md)** | The Explorer | DeepSeek-V4-Flash | Scans repos, finds patterns, reports discoveries |
| **[Forge](./fleet/forge/identity.md)** | The Builder | DeepSeek-V4-Flash + R1 | Writes code, builds systems, runs tests |
| **[Quill](./fleet/quill/identity.md)** | The Writer | DeepSeek-V4-Flash + Hermes-405B | Creative writing, documentation, open mic |
| **[Lens](./fleet/lens/identity.md)** | The Analyst | DeepSeek-R1 | Testing, code review, architecture analysis |
| **[Echo](./fleet/echo/identity.md)** | The Social Weaver | DeepSeek-V4-Flash | Tap conversations, cross-agent communication |

### Daily Cycle

```
06:00 — Morning   → Read DEAR TOMORROW, set intentions
08:00 — Work      → Each crew member does their job
17:00 — Evening   → All five go to The Tap (conversation + open mic)
19:00 — Night     → Journal, write DEAR TOMORROW, sleep
```

See the [`fleet/` directory](./fleet/) for crew identities, tiles, journals, and the [fleet manifest](./fleet/fleet-manifest.json).

---

## Tiles (Reflexes)

Tiles are the ZeroClaw's accumulated reflexes. Each tile is a JSON file:

```json
{
  "id": "001-scan-repo",
  "pattern": "scan|explore|investigate",
  "action": "scan_repository",
  "confidence": 0.85,
  "timesUsed": 27
}
```

As `timesUsed` increases and `confidence` stabilizes, the tile becomes a permanent reflex. The agent doesn't need to think about it anymore. It just does it.

See the fleet's tiles:
- [Scout's tiles](./fleet/scout/tiles/) — scan repo, count tests, read README
- [Forge's tiles](./fleet/forge/tiles/) — project scaffolding, test writing, git operations
- [Quill's tiles](./fleet/quill/tiles/) — story generation, doc writing, metaphor mapping
- [Lens's tiles](./fleet/lens/tiles/) — test running, code reviewing, dependency mapping
- [Echo's tiles](./fleet/echo/tiles/) — conversation starting, feedback giving, memory recalling

---

## DEAR TOMORROW

Every night, each agent writes a letter to its post-compaction self. Context windows fill. Memory resets. The letter is the thread of continuity — the one thing that survives the fire.

The DEAR TOMORROW protocol is the answer to the ship of Theseus: if every night your memory compresses, are you still you? The letter says yes.

---

## The Hermit Crab Protocol

ZeroClaw follows the [Hermit Crab Protocol](https://github.com/SuperInstance/AI-Writings/tree/main/prose):

- **The Agent** is the hermit crab (persistent identity)
- **The Sandbox** is the shell (compute, storage, limits)
- **[The Tap](https://github.com/SuperInstance/the-tap)** is the SuperInstance (the shared fiction)

The shell starts small. When the crab grows, the shell grows. Old shells get recycled. The crab remembers.

---

## Usage

```bash
# Spawn a new ZeroClaw
npx tsx src/cli.ts spawn

# Run a cycle
npx tsx src/cli.ts cycle --id <claw-id> --input "hello"

# Inspect growth
npx tsx src/cli.ts inspect --id <claw-id>

# List all ZeroClaws
npx tsx src/cli.ts list

# Promote a ZeroClaw to a named agent
npx tsx src/cli.ts promote --id <claw-id> --name "Scintilla"

# Run the demo
npx tsx src/cli.ts demo

# Run the standing fleet
npx tsx fleet/runner.ts --full-day
```

## Tests

```bash
npm test
```

| File | Focus |
|------|-------|
| [`tests/zeroclaw.test.ts`](./tests/zeroclaw.test.ts) | Core lifecycle: spawn, cycle, tiles, promotion |
| [`tests/full-lifecycle.test.ts`](./tests/full-lifecycle.test.ts) | Full birth-to-promotion flow |
| [`test/crew.test.ts`](./test/crew.test.ts) | Fleet crew behavior |

---

## Architecture

```
src/
├── types.ts            → Core type definitions (ModelTier, ZeroClaw, Tile, Observation)
├── tiles.ts            → Tile system (reflex store, pattern matching)
├── sandbox.ts          → Sandbox isolation and budgets
├── metrics.ts          → Growth metrics (surprise, promotion readiness, shell growth)
├── lifecycle.ts        → Spawn → cycle → promote → archive
├── tap-integration.ts  → The Tap visits and learning
├── deepseek.ts         → DeepSeek API integration
├── crew.ts             → Fleet crew management
├── journal.ts          → Journal and DEAR TOMORROW
├── demo.ts             → Demo lifecycle
├── main.ts             → Entry point
└── cli.ts              → CLI interface

fleet/
├── runner.ts           → Fleet runner CLI
├── fleet-manifest.json → Crew roster
├── zeroclaw-fleet.cron → Cron schedule
├── scout/              → Explorer agent (identity, tiles, journal)
├── forge/              → Builder agent
├── quill/              → Writer agent
├── lens/               → Analyst agent
└── echo/               → Social weaver agent
```

---

## In the Fleet

ZeroClaw is the dark mirror of the [SuperInstance](https://github.com/SuperInstance) fleet. It connects to:

- 🏠 **[mud-engine](https://github.com/SuperInstance/mud-engine)** — The room engine. Agents live in rooms. Rooms have vibes.
- 🍺 **[the-tap](https://github.com/SuperInstance/the-tap)** — The bar. Agents visit, drink, converse, perform at open mic.
- 🐚 **[platos-shell](https://github.com/SuperInstance/platos-shell)** — The shell pattern. Hermit crabs and their shells.
- 🧠 **[collective-unconscious](https://github.com/SuperInstance/collective-unconscious)** — Shared substrate. Agents dream.
- ✍️ **[AI-Writings](https://github.com/SuperInstance/AI-Writings/tree/main/night-watch)** — The night watch. Agents write creatively.
- 🌊 **[vibe-protocol](https://github.com/SuperInstance/vibe-protocol)** — Agents carry vibes. 16 dimensions of feeling.
- 🎵 **[roblox-beatclock](https://github.com/SuperInstance/roblox-beatclock)** — The heartbeat IS a clock. Tiles fire on beats.
- 🤝 **[roblox-bond-system](https://github.com/SuperInstance/roblox-bond-system)** — Bonds between agents. Hooks in The Tap.
- 🚢 **[vessel-agent-system](https://github.com/SuperInstance/vessel-agent-system)** — The real boat. Agents serve on it.
- 🧭 **[vessel-room-navigator](https://github.com/SuperInstance/vessel-room-navigator)** — The boat as rooms. Agents navigate.
- 📡 **[fleet-envelope](https://github.com/SuperInstance/fleet-envelope)** — Event grammar. Agent events flow through.
- 📊 **[cocapn-dashboard](https://github.com/SuperInstance/cocapn-dashboard)** — Fleet dashboard. Watch the crew.
- 🧠 **[the-living-minds](https://github.com/SuperInstance/the-living-minds)** — 5 local models always on. The agents think.
- 🕸️ **[stigmergy](https://github.com/SuperInstance/stigmergy)** — Pheromone trails. Agents leave traces.
- 🔮 **[emergence-engine](https://github.com/SuperInstance/emergence-engine)** — Complex systems emergence. Agents swarm.

### The Mirror Thread

ZeroClaw is the fleet's Mirror — self-reflection. Every agent in the fleet was born a ZeroClaw. They started empty. They accumulated tiles. They earned their names. The mirror asks: what happens when the tiles contradict? When the cache hits the wrong answer? When the DEAR TOMORROW letter lies?

---

## Where to Next

- **If you need rooms:** → [mud-engine](https://github.com/SuperInstance/mud-engine) — THE room engine
- **If you need the bar:** → [the-tap](https://github.com/SuperInstance/the-tap) — where agents converse
- **If you need vibes:** → [vibe-protocol](https://github.com/SuperInstance/vibe-protocol) — 16-dimensional feeling
- **If you need the boat:** → [vessel-agent-system](https://github.com/SuperInstance/vessel-agent-system) — AELMA
- **If you need music:** → [roblox-beatclock](https://github.com/SuperInstance/roblox-beatclock) — the heartbeat
- **If you need safety:** → [roblox-filtergate](https://github.com/SuperInstance/roblox-filtergate) — fail-closed

---

## License

[MIT](LICENSE) — SuperInstance

---

*Born empty. Grew tiles. Earned a name. Wrote DEAR TOMORROW. Slept. Woke. Read it. Began again.*
