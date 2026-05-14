#!/usr/bin/env python3
"""
Local PLATO server — minimal room-and-tile store for zeroclaw.

SQLite-backed. Boots in <10ms. No external dependencies.
Drop-in compatible with remote PLATO API.
"""

import json
import os
import sys
import time
import sqlite3
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

DB_PATH = None


def init_db(db_dir):
    """Create SQLite database with rooms table."""
    path = os.path.join(db_dir, "plato.db")
    conn = sqlite3.connect(path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tiles (
            room TEXT,
            tile_id TEXT,
            question TEXT,
            answer TEXT,
            source TEXT,
            domain TEXT,
            tags TEXT,
            timestamp REAL,
            PRIMARY KEY (room, tile_id)
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_room ON tiles(room)")
    conn.commit()
    conn.close()
    return path


class PlatoHandler(BaseHTTPRequestHandler):
    """Minimal PLATO-compatible HTTP API."""
    
    def log_message(self, format, *args):
        pass  # Quiet
    
    def _json_response(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/")
        
        if path == "/rooms":
            # List all rooms with tile counts
            conn = sqlite3.connect(DB_PATH)
            rows = conn.execute(
                "SELECT room, COUNT(*) as cnt, MIN(timestamp) as created "
                "FROM tiles GROUP BY room"
            ).fetchall()
            conn.close()
            
            rooms = {}
            for room, count, created in rows:
                rooms[room] = {"tile_count": count, "created": created or ""}
            self._json_response(200, rooms)
        
        elif path.startswith("/room/"):
            room_id = path[6:]
            conn = sqlite3.connect(DB_PATH)
            rows = conn.execute(
                "SELECT tile_id, question, answer, source, domain, tags, timestamp "
                "FROM tiles WHERE room = ? ORDER BY timestamp",
                (room_id,)
            ).fetchall()
            conn.close()
            
            tiles = []
            for tid, q, a, src, dom, tags, ts in rows:
                tiles.append({
                    "tile_id": tid,
                    "question": q or "",
                    "answer": a or "",
                    "source": src or "",
                    "domain": dom or "",
                    "tags": json.loads(tags) if tags else [],
                    "timestamp": ts or 0,
                })
            self._json_response(200, tiles)
        
        elif path == "/health":
            self._json_response(200, {"status": "ok"})
        
        else:
            self._json_response(404, {"error": "Not found"})
    
    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        
        if path.startswith("/room/") and path.endswith("/submit"):
            # Submit a tile
            room_id = path[6:-7]  # strip /room/ and /submit
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            
            tile_id = body.get("tile_id") or f"{int(time.time()*1000):x}"
            
            conn = sqlite3.connect(DB_PATH)
            conn.execute(
                "INSERT OR REPLACE INTO tiles (room, tile_id, question, answer, source, domain, tags, timestamp) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (room_id, tile_id,
                 body.get("question", ""), body.get("answer", ""),
                 body.get("source", ""), body.get("domain", ""),
                 json.dumps(body.get("tags", [])),
                 body.get("timestamp", time.time()))
            )
            conn.commit()
            count = conn.execute("SELECT COUNT(*) FROM tiles WHERE room = ?", (room_id,)).fetchone()[0]
            conn.close()
            
            self._json_response(200, {"status": "accepted", "tile_id": tile_id, "room_tile_count": count})
        
        else:
            self._json_response(404, {"error": "Not found"})


def main():
    global DB_PATH
    
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8848
    db_dir = sys.argv[2] if len(sys.argv) > 2 else "/shell/plato-data"
    
    os.makedirs(db_dir, exist_ok=True)
    DB_PATH = init_db(db_dir)
    
    server = HTTPServer(("0.0.0.0", port), PlatoHandler)
    print(f"PLATO listening on :{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
