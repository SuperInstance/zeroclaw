# fleet/ — ZeroClaw Standing Fleet

> *Five agents that started with nothing. Now they have names.*

Established 2026-08-09. Five persistent ZeroClaw agents that replaced ephemeral subagents. They work, journal, go to The Tap, and grow — day by day.

## The Crew

| Name | Role | Model | Folder |
|------|------|-------|--------|
| [**Scout**](scout/identity.md) | The Explorer | DeepSeek-V4-Flash | [`scout/`](scout/) |
| [**Forge**](forge/identity.md) | The Builder | DeepSeek-V4-Flash + R1 | [`forge/`](forge/) |
| [**Quill**](quill/identity.md) | The Writer | DeepSeek-V4-Flash + Hermes-405B | [`quill/`](quill/) |
| [**Lens**](lens/identity.md) | The Analyst | DeepSeek-R1 | [`lens/`](lens/) |
| [**Echo**](echo/identity.md) | The Social Weaver | DeepSeek-V4-Flash | [`echo/`](echo/) |

## Structure

Each crew member has:
```
{name}/
├── identity.md     → Who they are (emergent, not assigned)
├── tiles/          → Learned reflexes (JSON)
├── journal/        → Daily entries (two voices: The Worker, The Person)
├── creative/       → Artistic output
└── memory/         → Accumulated experience
```

## Daily Cycle

```
06:00 — Morning   → Read DEAR TOMORROW, set intentions
08:00 — Work      → Each crew member does their job
17:00 — Evening   → All five go to The Tap (conversation + open mic)
19:00 — Night     → Journal, DEAR TOMORROW, sleep
```

## Files

| File | Description |
|------|-------------|
| [`runner.ts`](runner.ts) | Fleet runner CLI — run phases or full days |
| [`fleet-manifest.json`](fleet-manifest.json) | Crew roster with models and birth dates |
| [`zeroclaw-fleet.cron`](zeroclaw-fleet.cron) | Cron schedule for daily phases |

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

---

*SEE YOU AT THE TABLE.*

[← Back to ZeroClaw](../README.md)
