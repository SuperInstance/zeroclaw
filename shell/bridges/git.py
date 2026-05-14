#!/usr/bin/env python3
"""
Bridge: Generic Git → PLATO

Monitors a git repo and submits commits/changes as PLATO tiles.
Works with any git-based workflow.

Usage:
    python3 bridges/git.py --repo /path/to/repo --room my-project
    python3 bridges/git.py --repo . --room $(basename $(pwd)) --watch 60
"""

import json
import os
import subprocess
import sys
import time
import urllib.request

PLATO = os.environ.get("PLATO_URL", "http://localhost:8848")


def submit_tile(room, question, answer, source="git-bridge"):
    data = json.dumps({
        "question": question[:2000],
        "answer": answer[:5000],
        "source": source,
        "domain": "git-bridge",
        "tags": ["git", "bridge"],
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


def sync_commits(repo_path, room, since="1 hour ago"):
    """Submit recent commits as tiles."""
    result = subprocess.run(
        ["git", "log", f"--since={since}", "--format=%H|%s|%an|%at"],
        capture_output=True, text=True, cwd=repo_path, timeout=30,
    )
    
    count = 0
    for line in result.stdout.strip().split("\n"):
        if "|" not in line:
            continue
        sha, msg, author, ts = line.split("|", 3)
        submit_tile(room, f"commit:{sha[:12]}", f"{author}: {msg}", "git-bridge")
        count += 1
    return count


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=".")
    parser.add_argument("--room", default="git-activity")
    parser.add_argument("--since", default="1 hour ago")
    parser.add_argument("--watch", type=int, default=0, help="Watch interval (0=once)")
    args = parser.parse_args()
    
    if args.watch:
        print(f"Watching {args.repo} every {args.watch}s → PLATO room: {args.room}")
        while True:
            n = sync_commits(args.repo, args.room, args.since)
            if n:
                print(f"  {n} commits synced")
            time.sleep(args.watch)
    else:
        n = sync_commits(args.repo, args.room, args.since)
        print(f"✅ Synced {n} commits to PLATO room: {args.room}")
