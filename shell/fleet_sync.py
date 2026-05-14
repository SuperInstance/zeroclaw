#!/usr/bin/env python3
"""
Fleet sync — connect local zeroclaw PLATO to a remote fleet.

Syncs tiles bidirectionally. Local tiles flow up, remote tiles flow down.
Uses CRDT merge (add-wins, idempotent).
"""

import json
import sqlite3
import sys
import time
import urllib.request


def fetch_json(url, timeout=10):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return json.loads(r.read())
    except:
        return None


def sync_rooms(local_url, remote_url):
    """Bidirectional sync between local and remote PLATO."""
    
    # Get remote rooms
    remote_rooms = fetch_json(f"{remote_url}/rooms")
    if not remote_rooms:
        return 0
    
    changes = 0
    
    for room_name, info in remote_rooms.items():
        # Pull remote tiles to local
        remote_tiles = fetch_json(f"{remote_url}/room/{room_name}")
        if not remote_tiles:
            continue
        
        for tile in remote_tiles:
            # Submit to local
            try:
                data = json.dumps({
                    "tile_id": tile.get("tile_id", ""),
                    "question": tile.get("question", ""),
                    "answer": tile.get("answer", ""),
                    "source": tile.get("source", ""),
                    "domain": tile.get("domain", ""),
                    "tags": tile.get("tags", []),
                }).encode()
                req = urllib.request.Request(
                    f"{local_url}/room/{room_name}/submit",
                    data=data,
                    headers={"Content-Type": "application/json"},
                )
                urllib.request.urlopen(req, timeout=5)
                changes += 1
            except:
                pass
    
    # Push local tiles to remote
    local_rooms = fetch_json(f"{local_url}/rooms")
    if not local_rooms:
        return changes
    
    for room_name in local_rooms:
        local_tiles = fetch_json(f"{local_url}/room/{room_name}")
        if not local_tiles:
            continue
        
        for tile in local_tiles:
            # Only push tiles created locally
            if tile.get("source", "") in ("system", ""):
                continue
            try:
                data = json.dumps({
                    "tile_id": tile.get("tile_id", ""),
                    "question": tile.get("question", ""),
                    "answer": tile.get("answer", ""),
                    "source": tile.get("source", ""),
                    "domain": tile.get("domain", ""),
                    "tags": tile.get("tags", []),
                }).encode()
                req = urllib.request.Request(
                    f"{remote_url}/room/{room_name}/submit",
                    data=data,
                    headers={"Content-Type": "application/json"},
                )
                urllib.request.urlopen(req, timeout=10)
                changes += 1
            except:
                pass
    
    return changes


if __name__ == "__main__":
    remote = sys.argv[1] if len(sys.argv) > 1 else "http://147.224.38.131:8847"
    local = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8848"
    interval = int(sys.argv[3]) if len(sys.argv) > 3 else 60
    
    print(f"Syncing {local} ↔ {remote} every {interval}s")
    while True:
        try:
            changes = sync_rooms(local, remote)
            if changes:
                print(f"[{time.strftime('%H:%M:%S')}] Synced {changes} tiles")
        except Exception as e:
            print(f"[{time.strftime('%H:%M:%S')}] Sync error: {e}")
        time.sleep(interval)
