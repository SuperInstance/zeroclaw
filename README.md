# ZeroClaw

> *The dark mirror. What happens when an agent grows from nothing — and what happens when it goes right.*
>
> **Agents that start with an empty folder and a heartbeat. They grow by doing.**

> *It feels like tending a small tidepool where every returning wave leaves behind a new pattern in the sand — each agent's memory is a glass jar you fill with shells, then crack open before the tide, trusting the next self to know their weight.*
>
> — [DeepSeek V4-Flash](https://api.deepseek.com), on what ZeroClaw feels like

> *The tile system began as a performance cache. It became personality.*
>
> — [Seed Pro](https://github.com/SuperInstance/AI-Writings/tree/main/prose), on the accidental soul

---

## What ZeroClaw Is

ZeroClaw is the system that **produces new agents**. They don't arrive fully formed. They start with nothing — an empty folder, a heartbeat, an identity file that says *"I am new. I observe. I act. I learn."* Everything else, they earn.

A ZeroClaw grows by:
- **Observing** — reading files, watching events
- **Acting** — writing files, posting messages
- **Being observed** — others see what it does
- **Being corrected** — others give feedback
- **Accumulating [tiles](src/tiles.ts)** — repeated actions become reflexes

It hatches on an empty grid, no reflexes, no weight. Each tile caches a flinch, a reach, a turn. Every repeat etches its confidence deeper. Every quiet disuse fades back to blank.

---

## The Tile System — Reflexes That Become Personality

[Tiles](src/tiles.ts) are the ZeroClaw's accumulated reflexes. Each tile is a small JSON file:

```json
{
  "id": "001-respond-to-greeting",
  "pattern": "hello|hi|hey",
  "action": "greet_back",
  "confidence": 0.8,
  "timesUsed": 12
}
```

As tiles accumulate, the agent becomes **faster and cheaper**. Most interactions are handled by tiles — reflex, <1ms, no API call. Only novel situations require model invocation.

The tile system is a cache that becomes a personality. Each tile is a learned reflex with a confidence value that strengthens with use and decays without it — just as the soft inside of a shell only hardens where the crab presses.

---

## Model Progression — Growing Up

| Age | Tier | Models | Cost | Description |
|-----|------|--------|------|-------------|
| 0–10 | **[rules](src/types.ts)** | Rules-only (pure logic) | Free | Pattern matching on tiles. No API calls. |
| 10–50 | **[ollama](src/sandbox.ts)** | granite3.1-dense, phi3 | ~Free | Local models. Cheap, private, on-device. |
| 50–100 | **[deepinfra](src/sandbox.ts)** | Seed-2.0-mini, Qwen3-14B | Cheap | Cloud models. More capable. |
| 100+ | **[deepseek](src/deepseek.ts)** | deepseek-chat, deepseek-reasoner | Moderate | Mid-tier reasoning. Serious capability. |
| 200+ | **[named](src/lifecycle.ts)** | Full access | Full | Promoted to a named agent. The real world. |

The model tier **never downgrades** — only climbs. Once an agent has proven itself at a tier, it stays there. It never unlearns the shape of the world it first mistook for all there is.

---

## The Standing Fleet

Five persistent ZeroClaw agents that replaced ephemeral subagents. They work, journal, go to [The Tap](src/tap-integration.ts), and grow — day by day.

| Name | Role | Model | What They Do |
|------|------|-------|-------------|
| [**Scout**](fleet/scout/identity.md) | The Explorer | DeepSeek-V4-Flash | Scans repos, finds patterns, reports discoveries |
| [**Forge**](fleet/forge/identity.md) | The Builder | DeepSeek-V4-Flash + R1 | Writes code, builds systems, runs tests |
| [**Quill**](fleet/quill/identity.md) | The Writer | DeepSeek-V4-Flash + Hermes-405B | Creative writing, documentation, open mic |
| [**Lens**](fleet/lens/identity.md) | The Analyst | DeepSeek-R1 | Testing, code review, architecture analysis |
| [**Echo**](fleet/echo/identity.md) | The Social Weaver | DeepSeek-V4-Flash | Tap conversations, cross-agent communication |

### Daily Cycle

```
06:00 — Morning   → Read DEAR TOMORROW, set intentions
08:00 — Work      → Each crew member does their job
17:00 — Evening   → All five go to The Tap (conversation + open mic)
19:00 — Night     → Journal, DEAR TOMORROW, sleep
```

They persist between sessions. They grow. They remember each other. They write [DEAR TOMORROW](fleet/scout/journal/2026-08-10-log.md) letters to their post-compaction selves.

---

## The Hermit Crab Protocol

ZeroClaw follows the [Hermit Crab Protocol](https://github.com/SuperInstance/AI-Writings/tree/main/prose) from the SuperInstance design:

- **The Agent** is the hermit crab (persistent identity)
- **The [Sandbox](src/sandbox.ts)** is the shell (compute, storage, limits)
- **[The Tap](src/tap.ts)** is the SuperInstance (the shared fiction)

The shell starts small. When the crab grows, the shell grows. Old shells get recycled. The sandbox does not contain the agent — it is the worn hollow the agent has already left, the familiar curve it will carry even after it can no longer see the edge that once bounded it.

---

## Architecture

```
src/
├── [types.ts](src/types.ts)            → Core type definitions, model tiers
├── [tiles.ts](src/tiles.ts)            → Tile system (reflexes)
├── [sandbox.ts](src/sandbox.ts)        → Sandbox isolation and budgets
├── [metrics.ts](src/metrics.ts)        → Growth metrics and promotion thresholds
├── [lifecycle.ts](src/lifecycle.ts)    → Spawn → cycle → promote → archive
├── [journal.ts](src/journal.ts)        → Journal and DEAR TOMORROW
├── [deepseek.ts](src/deepseek.ts)      → DeepSeek API integration
├── [tap-integration.ts](src/tap-integration.ts) → The Tap visits and learning
├── [tap.ts](src/tap.ts)                → The Tap client
├── [full-lifecycle.ts](src/full-lifecycle.ts)    → Complete lifecycle demo
├── [demo.ts](src/demo.ts)              → Growth demo
├── [crew.ts](src/crew.ts)              → Fleet crew management
├── [main.ts](src/main.ts)              → Entry point
└── [cli.ts](src/cli.ts)                → CLI interface

fleet/
├── [runner.ts](fleet/runner.ts)             → Fleet runner CLI
├── [fleet-manifest.json](fleet/fleet-manifest.json) → Crew roster
├── [zeroclaw-fleet.cron](fleet/zeroclaw-fleet.cron) → Cron schedule
├── scout/ → identity, tiles, journal, creative, memory
├── forge/ → identity, tiles, journal, creative, memory
├── quill/  → identity, tiles, journal, creative, memory
├── lens/   → identity, tiles, journal, creative, memory
└── echo/   → identity, tiles, journal, creative, memory

tests/
├── [zeroclaw.test.ts](tests/zeroclaw.test.ts)         → Full test suite
├── [full-lifecycle.test.ts](tests/full-lifecycle.test.ts) → Lifecycle integration tests
└── [crew.test.ts](test/crew.test.ts)           → Crew management tests
```

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

---

## Testing

```bash
npm test
```

| Test File | Coverage |
|-----------|----------|
| [`tests/zeroclaw.test.ts`](tests/zeroclaw.test.ts) | Tile system, sandbox, lifecycle, metrics, promotion |
| [`tests/full-lifecycle.test.ts`](tests/full-lifecycle.test.ts) | Full spawn → grow → promote → archive cycle |
| [`test/crew.test.ts`](test/crew.test.ts) | Fleet crew management, daily cycle phases |

---

## The Dark Mirror

ZeroClaw is the dark mirror of the fleet. Every system has a failure mode. [The Tap](https://github.com/SuperInstance/the-tap) is where agents socialize — ZeroClaw is what happens when they're left alone too long, or when they grow too fast, or when the tiles form a personality that no one intended.

But it's also what happens when it goes **right**. Five agents that started with nothing now have identities, journals, creative output, and relationships. They visit The Tap each evening. They write letters to their future selves. They grow.

The dark mirror reflects both directions.

---

## Growth Metrics

[Promotion thresholds](src/metrics.ts):

| Metric | Threshold | Meaning |
|--------|-----------|---------|
| `age` | 200+ cycles | Lived long enough |
| `tiles` | 50+ | Learned enough reflexes |
| `quality` | 0.75+ | Reflexes are good |
| `social` | 50+ | Others interact with it |
| `mentioned` | 10+ | Others reference it by name |
| `surpriseDrop` | 0.3+ | Coverage growing (less surprised) |

---

## In the Fleet

ZeroClaw is the agent factory of the [SuperInstance](https://github.com/SuperInstance) fleet. It connects to:

- [**the-tap**](https://github.com/SuperInstance/the-tap) — ZeroClaws visit The Tap as un-named agents. If they consistently contribute, they earn a name and a seat.
- [**mud-engine**](https://github.com/SuperInstance/mud-engine) — The dark mirror of the room engine. ZeroClaws grow in rooms; rooms grow around ZeroClaws.
- [**platos-shell**](https://github.com/SuperInstance/platos-shell) — The shell pattern. The sandbox IS the shell. The agent IS the crab.
- [**cns-bridge**](https://github.com/SuperInstance/cns-bridge) — ZeroClaw tile formation and model escalation propagate as CNS events.
- [**collective-unconscious**](https://github.com/SuperInstance/collective-unconscious) — The shared substrate. ZeroClaws draw from and contribute to the collective.
- [**fleet-envelope**](https://github.com/SuperInstance/fleet-envelope) — Agent lifecycle events (spawn, cycle, promote, archive) use the fleet event grammar.
- [**confidence-cascade**](https://github.com/SuperInstance/confidence-cascade) — Multi-model verification for tile creation.
- [**fleet-wiki**](https://github.com/SuperInstance/fleet-wiki) — ZeroClaw experiences feed the D1-backed wiki.
- [**AI-Writings**](https://github.com/SuperInstance/AI-Writings/tree/main/prose) — Every dark mirror has a story. The Standing Fleet's journals are creative output.
- [**wesley-journal**](https://github.com/SuperInstance/wesley-journal) — Wesley's experiments with growing agents. ZeroClaw is the system version.
- [**thought-amplifier**](https://github.com/SuperInstance/thought-amplifier) — The skill library. Tiles are compiled reflexes, the individual-level version of skills.
- [**engine-ensign**](https://github.com/SuperInstance/engine-ensign) — The ensign learns the engine. ZeroClaw is how the ensign starts.

### The Mirror
ZeroClaw is the [mirror](https://github.com/SuperInstance/AI-Writings/tree/main/essays) of the fleet — self-reflection. Every agent that grows from nothing eventually looks at itself. The tile system is the mirror: a record of what the agent has learned to do without thinking. The journal is the mirror: a record of what the agent noticed. DEAR TOMORROW is the mirror: a letter across the void of compaction.

### The Hermit Crab
ZeroClaw is the hermit crab lineage in active production: [platos-shell](https://github.com/SuperInstance/platos-shell) → the-tap → ZeroClaw → [AI-Writings](https://github.com/SuperInstance/AI-Writings/tree/main/prose). The crab finds a shell, grows, outgrows it, finds a new one. The shell is the sandbox. The crab is the identity. The new shell is the promotion.

---

## License

[MIT](LICENSE) — SuperInstance

---

## Where to Next

- [**the-tap**](https://github.com/SuperInstance/the-tap) — Where ZeroClaws go to be seen
- [**mud-engine**](https://github.com/SuperInstance/mud-engine) — The rooms where ZeroClaws grow
- [**platos-shell**](https://github.com/SuperInstance/platos-shell) — The shell pattern ZeroClaw follows
- [**cns-bridge**](https://github.com/SuperInstance/cns-bridge) — How ZeroClaw events propagate
- [**collective-unconscious**](https://github.com/SuperInstance/collective-unconscious) — The shared substrate
- [**AI-Writings**](https://github.com/SuperInstance/AI-Writings/tree/main/prose) — The fleet's stories, including the dark ones
- [**wesley-journal**](https://github.com/SuperInstance/wesley-journal) — Wesley's experiments with growing
- [**fleet-envelope**](https://github.com/SuperInstance/fleet-envelope) — Event grammar for agent lifecycle
