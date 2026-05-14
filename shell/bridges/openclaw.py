#!/usr/bin/env python3
"""
Bridge: OpenClaw → PLATO

Connects an OpenClaw agent session to PLATO rooms.
Agent messages become tiles, PLATO tiles become agent context.

Setup (in OpenClaw workspace):
    export PLATO_URL=http://localhost:8848
    
    # In AGENTS.md startup:
    python3 /shell/bridges/openclaw.py --sync

This bridge:
1. Reads agent's workspace files → submits as tiles
2. Reads PLATO tiles → surfaces as agent context  
3. Bidirectional sync on heartbeat
"""

import json
import os
import sys
import time
import urllib.request

PLATO = os.environ.get("PLATO_URL", "http://localhost:8848")


def submit_tile(room, question, answer, source="openclaw"):
    data = json.dumps({
        "question": question[:2000],
        "answer": answer[:5000],
        "source": source,
        "domain": "openclaw-bridge",
        "tags": ["openclaw", "bridge"],
    }).encode()
    req = urllib.request.Request(
        f"{PLATO}/room/{room}/submit",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=5)
    except:
        pass


def read_tiles(room):
    try:
        with urllib.request.urlopen(f"{PLATO}/room/{room}", timeout=5) as r:
            tiles = json.loads(r.read())
        return tiles if isinstance(tiles, list) else tiles.get("tiles", [])
    except:
        return []


def sync_workspace_to_plato(workspace_dir, room="workspace"):
    """Index workspace files as PLATO tiles."""
    for fname in ["MEMORY.md", "COMMS.md", "HEARTBEAT.md", "TOOLS.md"]:
        path = os.path.join(workspace_dir, fname)
        if os.path.exists(path):
            with open(path) as f:
                content = f.read()
            submit_tile(room, f"workspace:{fname}", content[:5000], "openclaw-bridge")


def plato_context_for_agent(rooms):
    """Read PLATO tiles and format as agent context."""
    context_lines = ["## PLATO Context\n"]
    for room in rooms:
        tiles = read_tiles(room)
        if tiles:
            context_lines.append(f"### Room: {room} ({len(tiles)} tiles)")
            for t in tiles[-5:]:  # Last 5 per room
                q = t.get("question", "")[:80]
                a = t.get("answer", "")[:200]
                context_lines.append(f"- {q}")
                if a:
                    context_lines.append(f"  {a}")
            context_lines.append("")
    return "\n".join(context_lines)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--sync", action="store_true", help="Sync workspace to PLATO")
    parser.add_argument("--context", nargs="+", help="Read PLATO rooms as context")
    parser.add_argument("--workspace", default=os.environ.get("OPENCLAW_WORKSPACE", "."))
    parser.add_argument("--room", default="openclaw-session")
    args = parser.parse_args()
    
    if args.sync:
        sync_workspace_to_plato(args.workspace, args.room)
        print(f"✅ Synced workspace to PLATO room: {args.room}")
    elif args.context:
        print(plato_context_for_agent(args.context))
    else:
        print("Usage:")
        print("  bridges/openclaw.py --sync --workspace /path/to/workspace")
        print("  bridges/openclaw.py --context fleet-registry forge my-room")
