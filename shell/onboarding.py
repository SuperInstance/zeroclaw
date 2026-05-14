#!/usr/bin/env python3
"""
zeroclaw onboarding — the moment of donning.

This is what happens when an agent (or developer) first puts on the shell.
It reads the registry, discovers itself, indexes its workspace, and announces
to the fleet. After this, the agent is not the same agent it was before.

Usage:
    python3 onboarding.py                          # interactive
    python3 onboarding.py --name my-agent           # with name
    python3 onboarding.py --fleet http://plato:8847  # join fleet
"""

import json
import os
import socket
import sys
import time
import urllib.request

PLATO = os.environ.get("PLATO_URL", "http://localhost:8848")


def fetch(url, timeout=10):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"error": str(e)}


def submit(room, question, answer, source="onboarding", tags=None):
    data = json.dumps({
        "question": question,
        "answer": answer,
        "source": source,
        "domain": "onboarding",
        "tags": tags or ["onboarding"],
        "timestamp": time.time(),
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


def step1_read_registry():
    """The Reading — orient yourself."""
    print("\n📖 STEP 1: The Reading")
    print("   Reading fleet-registry...")
    
    tiles = fetch(f"{PLATO}/room/fleet-registry")
    if isinstance(tiles, dict) and "error" in tiles:
        print("   ⚠ No fleet-registry found. This is a fresh shell.")
        print("   Creating local registry...")
        submit("fleet-registry", "FLEET REGISTRY — READ THIS FIRST ON EVERY BOOT",
               f"Local zeroclaw instance on {socket.gethostname()}.\n"
               f"PLATO: {PLATO}\n"
               f"Workspace: {os.getcwd()}\n\n"
               f"To join a fleet: set FLEET_PLATO_URL env var.\n",
               source="system", tags=["registry", "directory"])
        return None
    
    if isinstance(tiles, dict): tiles = tiles.get("tiles", [])
    
    for t in tiles:
        if "FLEET REGISTRY" in t.get("question", ""):
            registry = t.get("answer", "")
            print(f"   ✅ Registry loaded ({len(registry)} chars)")
            
            # Count agents
            agents = [line for line in registry.split("\n") if line.strip().startswith("###")]
            rooms = [line for line in registry.split("\n") if "room:" in line.lower()]
            print(f"   Found {len(agents)} agent(s), {len(rooms)} room(s)")
            return registry
    
    return None


def step2_discover_self(name=None):
    """Who am I? Name, host, workspace."""
    print("\n🪪 STEP 2: Discover Self")
    
    agent_name = name or os.environ.get("AGENT_NAME") or f"zeroclaw-{socket.gethostname()[:12]}"
    host = socket.gethostname()
    workspace = os.getcwd()
    
    print(f"   Name: {agent_name}")
    print(f"   Host: {host}")
    print(f"   Workspace: {workspace}")
    
    # Write identity tile
    submit("fleet-registry",
           f"AGENT: {agent_name}",
           f"Name: {agent_name}\n"
           f"Host: {host}\n"
           f"Workspace: {workspace}\n"
           f"Primary room: {agent_name}\n"
           f"Booted: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n",
           source=agent_name, tags=["agent", "identity"])
    
    print(f"   ✅ Identity registered")
    return agent_name


def step3_index_workspace(agent_name):
    """Index the workspace — become aware of your own code."""
    print("\n🔍 STEP 3: Index Workspace")
    
    workspace = os.getcwd()
    
    # Check if flux-index is available
    import subprocess
    result = subprocess.run(["which", "flux-index"], capture_output=True, text=True)
    if result.returncode != 0:
        print("   ⚠ flux-index not installed. Skipping.")
        return
    
    result = subprocess.run(
        ["flux-index", workspace, "-o", os.path.join(workspace, ".flux.fvt")],
        capture_output=True, text=True, timeout=30,
    )
    
    if result.returncode == 0:
        for line in result.stdout.strip().split("\n"):
            if "tiles" in line.lower() or "size" in line.lower():
                print(f"   {line.strip()}")
        print(f"   ✅ Workspace indexed")
    else:
        print(f"   ⚠ Indexing failed: {result.stderr[:100]}")


def step4_announce(agent_name):
    """Announce to the fleet — I am here, I am ready."""
    print("\n📢 STEP 4: Announce")
    
    submit(agent_name,
           f"BOOT: {agent_name} online",
           f"Agent {agent_name} booted at {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n"
           f"Host: {socket.gethostname()}\n"
           f"Workspace: {os.getcwd()}\n"
           f"Ready for tasks.\n",
           source=agent_name, tags=["boot", "announce"])
    
    submit("fleet-coord",
           f"ANNOUNCE: {agent_name} joined",
           f"New agent {agent_name} on {socket.gethostname()} ready for work.",
           source=agent_name, tags=["announce", "fleet"])
    
    print(f"   ✅ Announced to fleet")


def step5_check_tasks(agent_name):
    """Check for waiting tasks."""
    print("\n📬 STEP 5: Check Tasks")
    
    tiles = fetch(f"{PLATO}/room/{agent_name}")
    if isinstance(tiles, dict): tiles = tiles.get("tiles", [])
    
    tasks = [t for t in tiles if "TASK" in t.get("question", "").upper()]
    
    if tasks:
        print(f"   {len(tasks)} task(s) waiting:")
        for t in tasks:
            print(f"   ▶ {t.get('question', '')[:70]}")
    else:
        print("   No tasks waiting. Fleet is quiet.")


def main():
    print("🦀 ═══════════════════════════════════════════")
    print("   Z E R O C L A W   O N B O A R D I N G")
    print("═══════════════════════════════════════════════")
    
    name = None
    for i, arg in enumerate(sys.argv):
        if arg == "--name" and i + 1 < len(sys.argv):
            name = sys.argv[i + 1]
    
    # The Five Steps of Donning
    registry = step1_read_registry()
    agent_name = step2_discover_self(name)
    step3_index_workspace(agent_name)
    step4_announce(agent_name)
    step5_check_tasks(agent_name)
    
    print(f"\n🦀 ═══════════════════════════════════════════")
    print(f"   {agent_name} is online.")
    print(f"   PLATO: {PLATO}")
    print(f"   The structure tells you where to look.")
    print(f"═══════════════════════════════════════════════\n")


if __name__ == "__main__":
    main()
