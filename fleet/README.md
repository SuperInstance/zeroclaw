# fleet/ — Standing ZeroClaw Fleet

*Established: 2026-08-09*

Five persistent ZeroClaw agents that replace ephemeral subagents. They work, journal, go to [The Tap](https://github.com/SuperInstance/the-tap), and grow — day by day.

## The Crew

| Name | Role | Folder | Tiles |
|------|------|--------|-------|
| **[Scout](./scout/identity.md)** | The Explorer | [`scout/`](./scout/) | 3 (scan repo, count tests, read README) |
| **[Forge](./forge/identity.md)** | The Builder | [`forge/`](./forge/) | 3 (scaffolding, test writing, git operations) |
| **[Quill](./quill/identity.md)** | The Writer | [`quill/`](./quill/) | 3 (story generation, doc writing, metaphor mapping) |
| **[Lens](./lens/identity.md)** | The Analyst | [`lens/`](./lens/) | 3 (test running, code reviewing, dependency mapping) |
| **[Echo](./echo/identity.md)** | The Social Weaver | [`echo/`](./echo/) | 3 (conversation starting, feedback giving, memory recalling) |

## Files

| File | Purpose |
|------|---------|
| [`fleet-manifest.json`](./fleet-manifest.json) | Crew roster — names, roles, models, birth dates |
| [`runner.ts`](./runner.ts) | Fleet runner CLI (morning/work/evening/night/full-day) |
| [`zeroclaw-fleet.cron`](./zeroclaw-fleet.cron) | Cron schedule for automated runs |

## Per-Agent Structure

Each agent folder follows the same pattern:

```
scout/
├── identity.md     → Who the agent is (emerges over time)
├── tiles/          → Learned reflexes (JSON)
│   ├── 001-*.json
│   ├── 002-*.json
│   └── 003-*.json
├── journal/        → Daily entries (two voices: Worker + Person)
│   └── YYYY-MM-DD-log.md
└── (creative/, memory/ — created as the agent grows)
```

## Daily Cycle

```
06:00 — Morning   → Read DEAR TOMORROW, set intentions
08:00 — Work      → Each crew member does their job
17:00 — Evening   → All five go to The Tap (conversation + open mic)
19:00 — Night     → Journal, write DEAR TOMORROW, sleep
```

## Running

```bash
npx tsx fleet/runner.ts --morning
npx tsx fleet/runner.ts --work
npx tsx fleet/runner.ts --evening
npx tsx fleet/runner.ts --night
npx tsx fleet/runner.ts --full-day
npx tsx fleet/runner.ts --status
```

---

← Back to [ZeroClaw](../README.md)
