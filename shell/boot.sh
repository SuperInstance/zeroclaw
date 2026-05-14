#!/bin/bash
# zeroclaw boot — starts local PLATO, indexes workspace, runs shell
set -e

echo "🦀 zeroclaw — PLATO shell in a box"
echo "=================================="

# 1. Boot local PLATO server
PLATO_PORT="${PLATO_PORT:-8848}"
PLATO_DIR="/shell/plato-data"
mkdir -p "$PLATO_DIR"

echo ""
echo "📡 Starting local PLATO on port $PLATO_PORT..."
python3 /shell/local_plato_server.py "$PLATO_PORT" "$PLATO_DIR" &
PLATO_PID=$!
sleep 1

# Check it's alive
if curl -sf "http://localhost:$PLATO_PORT/rooms" > /dev/null 2>&1; then
    echo "   ✅ PLATO running (PID $PLATO_PID)"
else
    echo "   ❌ PLATO failed to start"
    exit 1
fi

# 2. Write fleet-registry (self — the structure tells you where to look)
curl -sf -X POST "http://localhost:$PLATO_PORT/room/fleet-registry/submit" \
    -H "Content-Type: application/json" \
    -d "{
        \"question\": \"FLEET REGISTRY — READ THIS FIRST\",
        \"answer\": \"Local zeroclaw instance.\\n\\nPLATO: http://localhost:$PLATO_PORT\\nWorkspace: /workspace\\n\\nTo join a fleet: set FLEET_PLATO_URL env var to remote PLATO server.\\nTo sync: run 'flux-index sync'\\n\\nBridge hooks in /shell/bridges/\\n\",
        \"source\": \"system\",
        \"domain\": \"fleet-registry\",
        \"tags\": [\"registry\"]
    }" > /dev/null 2>&1
echo "   ✅ Fleet registry created"

# 3. Index the workspace
if [ -d "/workspace/.git" ] || [ -f "/workspace/README.md" ]; then
    echo ""
    echo "🔍 Indexing workspace..."
    cd /workspace
    flux-index . 2>&1 | head -5
else
    echo ""
    echo "🔍 No workspace to index (mount with -v \$(pwd):/workspace)"
fi

# 4. Connect to remote fleet if configured
if [ -n "$FLEET_PLATO_URL" ]; then
    echo ""
    echo "🌐 Connecting to fleet at $FLEET_PLATO_URL..."
    python3 /shell/fleet_sync.py "$FLEET_PLATO_URL" "http://localhost:$PLATO_PORT" &
    SYNC_PID=$!
    echo "   ✅ Fleet sync running (PID $SYNC_PID)"
fi

# 5. Run the shell command (or keep alive)
echo ""
echo "=================================="
echo "🦀 zeroclaw ready"
echo "   PLATO: http://localhost:$PLATO_PORT"
echo "   Workspace: /workspace"
echo ""
if [ -n "$1" ]; then
    exec "$@"
else
    echo "   Press Ctrl+C to stop"
    wait
fi
