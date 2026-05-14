# zeroclaw 🦀

**A PLATO shell in a Docker box. Connect any tool to a fleet-aware agent environment.**

```bash
# One command. That's it.
docker run -v $(pwd):/workspace -p 8848:8848 ghcr.io/superinstance/zeroclaw
```

You now have:
- 📡 Local PLATO server (rooms + tiles, instant boot)
- 🔍 flux-index (semantic code search, zero dependencies)
- 🌐 Fleet registry (the structure tells you where to look)
- 🔗 Bridge hooks (connect to Claude Code, OpenClaw, Git, etc.)
- 🔄 Fleet sync (connect to a remote fleet when ready)

## What is this?

Every developer has tools. Claude Code. Aider. OpenClaw. Raw API calls. These tools don't talk to each other. They don't share knowledge. They don't form a fleet.

**zeroclaw fixes this.** It's a PLATO environment that runs alongside your existing tools. Your tools write tiles. Other tools read tiles. Knowledge flows. No API key needed. No central server needed (until you want one).

Think of it as **SQLite for agent coordination** — local-first, zero-config, runs everywhere.

## Quick Start

```bash
# 1. Start zeroclaw in your project directory
docker run -v $(pwd):/workspace -p 8848:8848 ghcr.io/superinstance/zeroclaw

# 2. Your workspace is now indexed and searchable
curl http://localhost:8848/rooms

# 3. Search your code semantically
docker exec -it $(docker ps -q) flux-index search "authentication middleware"

# 4. Write a tile (from any tool)
curl -X POST http://localhost:8848/room/my-project/submit \
  -H "Content-Type: application/json" \
  -d '{"question": "design decision: using FastAPI", "answer": "...", "source": "claude-code"}'

# 5. Read it back
curl http://localhost:8848/room/my-project
```

## Connect Your Tools

### Claude Code
```bash
# After Claude finishes, pipe its output to PLATO
claude --print "explain the auth module" | \
  python3 bridges/claude.py --room my-project --question "auth module explanation"
```

### OpenClaw
```bash
# In your OpenClaw workspace
export PLATO_URL=http://localhost:8848
python3 bridges/openclaw.py --sync --workspace .
```

### Git
```bash
# Auto-sync commits as PLATO tiles
python3 bridges/git.py --repo . --room my-project --watch 60
```

### Any Tool
```bash
# Just POST JSON. That's the API.
curl -X POST http://localhost:8848/room/anything/submit \
  -H "Content-Type: application/json" \
  -d '{
    "question": "your question or title",
    "answer": "your content, notes, decisions, code, anything",
    "source": "your-tool-name",
    "tags": ["custom", "tags"]
  }'
```

## Join a Fleet

Running alone is fine. Running as a fleet is better.

```bash
# Connect to a remote PLATO server (e.g., your team's instance)
docker run -v $(pwd):/workspace \
  -e FLEET_PLATO_URL=http://your-server:8847 \
  -p 8848:8848 \
  ghcr.io/superinstance/zeroclaw
```

Your local tiles sync to the fleet. Fleet tiles sync to you. The fleet-registry room tells every agent where to look.

## The API

zeroclaw exposes the same PLATO API as the production server:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/rooms` | GET | List all rooms with tile counts |
| `/room/{id}` | GET | Get all tiles in a room |
| `/room/{id}/submit` | POST | Submit a tile |
| `/health` | GET | Health check |

One data model. One API. Local or remote. Same thing.

## Why "zeroclaw"?

A zeroclaw is a crab that hasn't found its shell yet. It's small, adaptable, and ready to grow. This container is the smallest possible PLATO shell — just enough structure to be useful. When you outgrow it, connect to a fleet. The shell stays, the crab moves on.

## Architecture

```
┌─────────────────────────────────┐
│         zeroclaw container      │
│                                 │
│  ┌──────────┐  ┌─────────────┐ │
│  │ PLATO    │  │ flux-index  │ │
│  │ :8848    │  │ search      │ │
│  └────┬─────┘  └─────────────┘ │
│       │                        │
│  ┌────▼─────┐  ┌─────────────┐ │
│  │ Bridges  │  │ Fleet Sync  │ │
│  │ claude   │  │ CRDT merge  │ │
│  │ openclaw │  │             │ │
│  │ git      │  │             │ │
│  └──────────┘  └─────────────┘ │
│                                 │
│  /workspace ←── your code ─────│── mounted volume
└─────────────────────────────────┘
       │
       │ (optional)
       ▼
┌──────────────────┐
│  Remote Fleet    │
│  PLATO :8847     │
│  + other agents  │
└──────────────────┘
```

## The Point

**The structure tells you where to look.** No memory needed. No hardcoded URLs. The fleet-registry room is the directory. Every agent reads it on boot. Tiles flow where they're useful.

This is agent infrastructure that respects your tools. It doesn't replace anything. It connects everything.

---

*MIT license. Zero dependencies beyond Python 3.11 + Docker.*
