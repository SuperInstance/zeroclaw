# ┌─────────────────────────────────────────────────┐
# │  zeroclaw — a PLATO shell in a Docker box       │
# │  download, run, connect any tool to PLATO       │
# └─────────────────────────────────────────────────┘
#
# Usage:
#   docker build -t zeroclaw .
#   docker run -v $(pwd):/workspace zeroclaw
#
# Or one-liner:
#   docker run -v $(pwd):/workspace ghcr.io/superinstance/zeroclaw
#
# What you get:
#   - Local PLATO server (SQLite, instant boot)
#   - flux-index (semantic code search)
#   - fleet-registry (discover other agents)
#   - CRDT sync (merge with other zeroclaws)
#   - Bridge hooks (connect to Claude Code, OpenClaw, etc.)

FROM python:3.11-slim

LABEL org.opencontainers.image.title="zeroclaw"
LABEL org.opencontainers.image.description="PLATO shell — connect any tool to a fleet-aware agent environment"
LABEL org.opencontainers.image.source="https://github.com/SuperInstance/zeroclaw"

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install flux-index
RUN pip install --no-cache-dir git+https://github.com/SuperInstance/flux-index.git

# Install PLATO server
RUN pip install --no-cache-dir git+https://github.com/SuperInstance/plato-vessel-core.git || true

# Copy shell files
WORKDIR /shell
COPY shell/ .

# Workspace mount point
RUN mkdir -p /workspace
WORKDIR /workspace

# Health check — PLATO server responds
HEALTHCHECK --interval=30s --timeout=3s \
    CMD curl -f http://localhost:8848/rooms || exit 1

# Entrypoint: boot local PLATO, index workspace, start shell
ENTRYPOINT ["/shell/boot.sh"]
