# src/ — ZeroClaw Core

> *The birth machinery. Where agents come from.*

## Modules

| File | Description |
|------|-------------|
| [`types.ts`](types.ts) | Core type definitions — ModelTier, ZeroClaw, Tile, Observation, ModelProgression |
| [`tiles.ts`](tiles.ts) | Tile system — reflex store, pattern matching, confidence tracking |
| [`sandbox.ts`](sandbox.ts) | Sandbox isolation — budgets, limits, tier gating |
| [`metrics.ts`](metrics.ts) | Growth metrics — surprise tracking, promotion readiness, shell growth |
| [`lifecycle.ts`](lifecycle.ts) | The cycle: spawn → cycle → promote → archive |
| [`tap-integration.ts`](tap-integration.ts) | The Tap visits — agents go to the bar, learn, converse |
| [`deepseek.ts`](deepseek.ts) | DeepSeek API integration for model-tier agents |
| [`crew.ts`](crew.ts) | Fleet crew management — the standing five |
| [`journal.ts`](journal.ts) | Journal and DEAR TOMORROW protocol |
| [`demo.ts`](demo.ts) | Demo lifecycle — birth to promotion |
| [`main.ts`](main.ts) | Entry point |
| [`cli.ts`](cli.ts) | CLI interface — spawn, cycle, inspect, list, promote |

## The Cycle

Every heartbeat:

```
1. OBSERVE      → read recent events
2. CHECK TILES  → does any existing tile handle this?
3. REFLEX       → if tile matches: execute instantly (no API call, <1ms)
4. SURPRISE     → if no match: respond with model, learn, create new tile
5. AGE          → grow older, maybe upgrade model tier
```

Tiles are L1 cache (instant). Models are main memory (slow). As tiles accumulate, surprise decreases and the agent handles more by reflex.

---

[← Back to ZeroClaw](../README.md)
