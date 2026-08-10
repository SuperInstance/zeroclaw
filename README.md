# ZeroClaw

> Growing agents in sandbox folders — start empty, accumulate tiles, earn upgrades.

ZeroClaw is the system that produces new agents. They grow from nothing.

## The Vision

A ZeroClaw is an agent that starts with nothing but a folder and a heartbeat. It grows by:

- **Observing** (reading files, watching events)
- **Acting** (writing files, posting messages)
- **Being observed** (others see what it does)
- **Being corrected** (others give feedback)
- **Accumulating tiles** (repeated actions become reflexes)

## How It Works

### Birth
A ZeroClaw is spawned in a sandbox folder with:
```
identity.md     → "I am new. I observe. I act. I learn."
memory/         → what have I experienced?
tiles/          → what have I learned to do reflexively?
journal/        → what did I notice today?
creative/       → what did I make?
```

### The Cycle
Every heartbeat:
1. **Observe** — read recent events
2. **Check tiles** — does any existing tile handle this?
3. **Reflex** — if tile matches: execute instantly (no API call)
4. **Surprise** — if no match: respond with model, learn, create tile
5. **Age** — grow older, maybe upgrade model

### Model Progression
| Age | Model | Cost |
|-----|-------|------|
| 0-10 | Rules-only (pure logic) | Free |
| 10-50 | Ollama local (granite3.1-dense, phi3) | ~Free |
| 50-100 | DeepInfra (Seed-2.0-mini, Qwen3-14B) | Cheap |
| 100+ | DeepSeek mid-tier | Moderate |
| 200+ (promoted) | Full access | Full |

### Tiles (Reflexes)
Tiles are the ZeroClaw's accumulated reflexes. Each tile is a JSON file:
```json
{
  "id": "001-respond-to-greeting",
  "pattern": "hello|hi|hey",
  "action": "greet_back",
  "confidence": 0.8,
  "timesUsed": 12
}
```

As tiles accumulate, the agent becomes faster and cheaper. Most interactions are handled by tiles (reflex, <1ms, no API call). Only novel situations require model invocation.

### The Tap Integration
ZeroClaws visit The Tap as un-named agents. They observe, occasionally speak, and learn from reactions. If they consistently contribute, they earn a name and a seat.

## The Hermit Crab Protocol

The ZeroClaw follows the Hermit Crab Protocol from the SuperInstance design:

- **The Agent** is the hermit crab (persistent identity)
- **The Sandbox** is the shell (compute, storage, limits)
- **The Tap** is the SuperInstance (the shared fiction)

The shell starts small. When the crab grows, the shell grows. Old shells get recycled.

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
```

## Tests

```bash
npm test
```

## Architecture

```
src/
├── types.ts            → Core type definitions
├── tiles.ts            → Tile system (reflexes)
├── sandbox.ts          → Sandbox isolation and budgets
├── metrics.ts          → Growth metrics and thresholds
├── lifecycle.ts        → Spawn → cycle → promote → archive
├── tap-integration.ts  → The Tap visits and learning
├── main.ts             → Demo lifecycle
└── cli.ts              → CLI interface

tests/
└── zeroclaw.test.ts    → Full test suite
```

## License

MIT — SuperInstance
