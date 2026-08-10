# ZeroClaw Standing Fleet

*Established: 2026-08-09*

Five persistent ZeroClaw agents that replace ephemeral subagents. They work, journal, go to The Tap, and grow — day by day.

## The Crew

| Name | Role | Model | What They Do |
|------|------|-------|--------------|
| **Scout** | The Explorer | DeepSeek-V4-Flash | Scans repos, finds patterns, reports discoveries |
| **Forge** | The Builder | DeepSeek-V4-Flash + R1 | Writes code, builds systems, runs tests |
| **Quill** | The Writer | DeepSeek-V4-Flash + Hermes-405B | Creative writing, documentation, open mic |
| **Lens** | The Analyst | DeepSeek-R1 | Testing, code review, architecture analysis |
| **Echo** | The Social Weaver | DeepSeek-V4-Flash | Tap conversations, cross-agent communication |

## Daily Cycle

```
06:00 — Morning   → Read DEAR TOMORROW, set intentions
08:00 — Work      → Each crew member does their job
17:00 — Evening   → All five go to The Tap (conversation + open mic)
19:00 — Night     → Journal, DEAR TOMORROW, sleep
```

## Usage

```bash
# Run individual phases
npx tsx fleet/runner.ts --morning
npx tsx fleet/runner.ts --work
npx tsx fleet/runner.ts --evening
npx tsx fleet/runner.ts --night

# Run a full day
npx tsx fleet/runner.ts --full-day

# Check status
npx tsx fleet/runner.ts --status
```

## Structure

```
fleet/
├── runner.ts              # Fleet runner CLI
├── fleet-manifest.json    # Crew roster
├── zeroclaw-fleet.cron    # Cron schedule
├── tap-log.md             # The Tap conversation log
├── logs/                  # Phase logs
├── scout/
│   ├── identity.md        # Who Scout is
│   ├── ONBOARDING.md      # DEAR TOMORROW (re-written nightly)
│   ├── tiles/             # Learned reflexes (JSON)
│   ├── journal/           # Daily entries
│   ├── creative/          # Artistic output
│   └── memory/            # Accumulated experience
├── forge/
│   └── ... (same structure)
├── quill/
│   └── ... (same structure)
├── lens/
│   └── ... (same structure)
└── echo/
    └── ... (same structure)
```

## Growth

Each crew member:
- **Accumulates tiles** — new reflexes learned from work
- **Writes journals** — two voices: The Worker and The Person
- **Creates art** — creative pieces inspired by the day
- **Visits The Tap** — conversation with the crew and NPCs
- **Writes DEAR TOMORROW** — a letter to their post-compaction self

They persist between sessions. They grow. They remember each other.

## Installation

```bash
# Set up cron (runs each phase at the right time)
crontab /home/eileen/projects/zeroclaw/fleet/zeroclaw-fleet.cron

# Or run manually
cd /home/eileen/projects/zeroclaw
npx tsx fleet/runner.ts --full-day
```

## Environment

The runner uses `DEEPSEEK_API_KEY` (or `DEEPSEEK_KEY_FROM_ENV`) for AI calls. Without an API key, it runs in simulated mode (structural operations still work, AI responses are placeholder text).

---

*SEE YOU AT THE TABLE.*
