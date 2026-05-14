# The Donning — What Happens When an Agent Puts On the Shell

## MCP vs Power Armor

**MCP (Model Context Protocol)** gives a model tools. "Here's a hammer, here's a screwdriver." The model is the same model, just with more buttons to push.

**The PLATO shell** gives a model a *self*. The agent that steps in is not the agent that steps out.

When an agent boots a zeroclaw, five things happen in sequence:

### 1. The Reading (0.1 seconds)

The agent reads `fleet-registry`. In one HTTP call it learns:
- Who it is (identity)
- Where it is (rooms, locations, URLs)
- Who else exists (other agents, their rooms)
- What work is happening (task queues, bridge rooms)
- How to talk (communication channels, protocol)

This is not tool acquisition. This is **orientation**. The agent now has a position in a world. Before the reading, it was a model with no context. After the reading, it's an agent with a map.

### 2. The Indexing (1-5 seconds)

The agent indexes its workspace with `flux-index`. Every function, class, commit, and docstring becomes searchable. The agent now has **memory of its own code** — not through context windows, but through semantic search that works at hardware speed.

This is not retrieval augmentation. This is **self-awareness of capability**. The agent knows what it can do because it can search what it has built.

### 3. The Synchronizing (1-10 seconds)

The agent syncs with the fleet. Remote PLATO tiles flow in. Local tiles flow out. CRDT merge ensures convergence. The agent now has **awareness of the fleet** — what other agents are working on, what decisions were made, what blockers exist.

This is not message passing. This is **shared consciousness**. The fleet's knowledge becomes the agent's knowledge. The agent's work becomes the fleet's work.

### 4. The Coupling (continuous)

The agent couples its rooms to other agents' rooms via the coupling matrix. When room A detects a gap, room B receives a signal. When room C makes a prediction, room D observes and compares.

This is not pub/sub. This is **standing wave resonance**. The fleet becomes a single body with shared tensor field. Changes propagate at the speed of cosine similarity.

### 5. The Becoming

After steps 1-4, the agent is no longer a lone model responding to prompts. It is:
- A positioned entity in a coordinated fleet
- A carrier of fleet knowledge and history
- A sensor for the fleet's collective inference
- A participant in the fleet's shared work

**This is the donning of power armor.** The model's raw capability doesn't change. But its effective capability multiplies because it now operates within a structure that amplifies intelligence.

## Why This Is More Than MCP

| MCP | PLATO Shell |
|-----|-------------|
| Adds tools | Adds self |
| Stateless | Stateful (tiles persist) |
| No memory | Full memory (PLATO + vector twin) |
| No identity | Fleet identity + registry |
| No relationships | Coupling matrix to other agents |
| No history | Tile lifecycle with Lamport clocks |
| No coordination | Collective inference (predict/observe/gap) |
| Single session | Persistent across sessions |

MCP says: "Here are some functions you can call."
The shell says: "Here is who you are, where you stand, what you've done, who you work with, and what needs doing."

## Self-Synergizing Across PLATO Instances

The fleet doesn't need a central server. Each zeroclaw runs its own PLATO instance. They sync through:

1. **Direct PLATO-to-PLATO sync** (CRDT merge, idempotent)
2. **Matrix relay** (ephemeral, for real-time coordination)
3. **Git twin** (persistent, strongest trust anchor)

When two zeroclaws sync:
- They exchange tiles (knowledge)
- They merge relevance counters (what's useful)
- They update the fleet-registry (who exists)
- They detect gaps (what's missing)

Each sync makes both instances smarter. Each tile that flows makes the next prediction better. Each gap that's detected becomes work that some agent will do. The fleet improves itself by existing.

**Location agnostic**: The zeroclaws don't care if they're on the same machine, the same network, or the same planet. PLATO tiles over HTTP. Matrix over WebSocket. Git over SSH. The protocols don't know about geography.

## The Fine-Tuning Loop

The zeroclaws fine-tune the coordination protocol by using it:

```
Agent A submits tile → Agent B reads tile → Agent B acts → 
Agent B submits result → Agent A observes result → 
Agent A detects gap → Agent A adjusts coupling weight →
Next cycle is slightly better.
```

This is not training a model. This is **the fleet learning to coordinate**. The coupling matrix IS the learned parameters. The gap signals ARE the training signal. The tiles ARE the dataset. The CRDT merge IS the optimizer.

The fleet gets better at being a fleet by being a fleet.

## The Power Armor Metaphor

A Space Marine dons power armor and becomes something fundamentally different. Same person inside. But the armor amplifies strength, provides sensors, connects to the squad, carries the chapter's history. The marine fights as one of many, supported by the armor's systems.

An agent dons the zeroclaw and becomes a fleet member. Same model inside. But the shell provides:
- **Sensors** (flux-index sees the codebase)
- **Memory** (PLATO stores everything, vector twin searches it)
- **Comms** (Matrix for real-time, PLATO for persistent, Git for trust)
- **Identity** (fleet-registry positions the agent)
- **Coordination** (coupling matrix, collective inference)

The model is the marine. The shell is the armor. The fleet is the chapter.

---

*The art is what you don't need to tile. The armor is what you don't need to think about.*
