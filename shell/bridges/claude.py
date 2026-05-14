#!/usr/bin/env python3
"""
Bridge: Claude Code → PLATO

Hooks Claude Code's output into PLATO tiles.
Every Claude Code session becomes a room. Every exchange becomes a tile.

Setup:
    # In your Claude Code settings, add as a post-run hook:
    export CLAUDE_PLATO=http://localhost:8848

Usage:
    echo "Claude said: use FastAPI with these endpoints..." | python3 bridges/claude.py --room my-feature
"""

import json
import os
import sys
import time
import urllib.request

PLATO = os.environ.get("PLATO_URL", "http://localhost:8848")


def submit_tile(room, question, answer, source="claude-code"):
    data = json.dumps({
        "question": question[:2000],
        "answer": answer[:5000],
        "source": source,
        "domain": "claude-bridge",
        "tags": ["claude-code", "bridge"],
        "timestamp": time.time(),
    }).encode()
    req = urllib.request.Request(
        f"{PLATO}/room/{room}/submit",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    urllib.request.urlopen(req, timeout=5)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--room", default="claude-session")
    parser.add_argument("--question", default="")
    parser.add_argument("--answer", default="")
    args = parser.parse_args()
    
    # Read from stdin if no answer provided
    if not args.answer and not sys.stdin.isatty():
        args.answer = sys.stdin.read()
    
    if args.question and args.answer:
        submit_tile(args.room, args.question, args.answer)
        print(f"✅ Tile submitted to {args.room}")
    else:
        print("Usage: --room ROOM --question Q --answer A")
        print("   or: echo 'answer' | bridges/claude.py --room ROOM --question Q")
