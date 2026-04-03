# ZeroClaw 🐾

> **I Know Kung Fu. Now Guns Lots of Guns.**

ZeroClaw is the minimum viable repo-native agent framework. It is NOT a full platform — it's the nervous system and skill-loading mechanism.

The "kung fu" that gets loaded into the operator. Equipment (repos, libraries, APIs) are external — "guns lots of guns."

The revolution is the cyborg: skilled worker fused with machine, not operator + machine.

## Quick Start

```bash
# Option 1: npm
npx zeroclaw init my-vessel
cd my-vessel && npm install && npx zeroclaw run

# Option 2: git clone
git clone https://github.com/Lucineer/zeroclaw.git
cd zeroclaw && npm install && npm start

# Option 3: one-liner deploy
npx zeroclaw init my-vessel && cd my-vessel && npx zeroclaw deploy
```

## Concepts

### 🥋 Skills = Kung Fu
Skills change **HOW** the agent thinks. They're loadable capability bundles — alignment, not equipment.

*Examples:* socratic, debug, refactor, explain, test, review

### 🔫 Equipment = Guns Lots of Guns
Equipment is **EXTERNAL** — repos, libraries, APIs, tools. The agent MOUNTS equipment; it doesn't become it.

*Examples:* mount an npm package, a GitHub repo, an API endpoint

### 👤 Soul = Clothing
SOUL.md defines personality, boundaries, vibe. README.md defines presentation. Both are external presentation of internal capability.

### 🛸 Vessel = The Cyborg
A vessel = agent (kung fu) + equipment (guns) + soul (clothing). The skilled worker fused with machine.

## Architecture

```
src/
  agent.ts       — Core loop: think → act → observe → learn
  skills.ts      — Skill registry: load, unload, list, compose
  io.ts          — Repo-native I/O: read/write/exec/git/search
  soul.ts        — SOUL.md loader: personality, boundaries, vibe
  equipment.ts   — Equipment loader: mount repos, libraries, APIs
  vessel.ts      — Vessel factory: agent + skills + equipment + soul
cli.ts           — CLI entry point
worker.ts        — Cloudflare Worker entry point
SOUL.md          — Default soul
```

## The Agent Loop

The agent IS the repo. It thinks about its own code, acts on it, observes results, learns.

1. **Think** — Analyze current state, decide what to do
2. **Act** — Execute a skill or use equipment
3. **Observe** — Read results, update state
4. **Learn** — Persist insights back to repo (git commit)

## Repo-Native I/O

The repo IS the interface.

- **Git commits** = memory persistence
- **File reads** = context loading
- **Exec** = tool use
- **Search** = knowledge retrieval

## CLI

```
zeroclaw init          — Scaffold a new vessel
zeroclaw skill add X   — Load a skill (kung fu)
zeroclaw skill list    — List loaded skills
zeroclaw mount X       — Mount equipment (guns)
zeroclaw run           — Start the agent loop
zeroclaw deploy        — Deploy to Cloudflare Workers
```

## License

MIT — Superinstance & Lucineer (DiGennaro et al.)
