"""
passage.py — Client for requesting safe passages through the lighthouse.

For zeroclaw agents. You don't have API keys. You don't need them.
Submit a request to PLATO, wait for the lighthouse to respond.

Usage:
    from passage import request_passage
    
    response = request_passage(
        provider="deepinfra",
        model="ByteDance/Seed-2.0-mini",
        prompt="What is constraint theory?",
        agent_name="my-zeroclaw"
    )
    print(response)

Or CLI:
    python3 passage.py "Explain Eisenstein integers" --model Seed-2.0-mini
"""

import json
import os
import sys
import time
import urllib.request

PLATO = os.environ.get("PLATO_URL", "http://localhost:8848")
REQUEST_ROOM = "lighthouse-requests"
RESPONSE_ROOM = "lighthouse-responses"


def submit_request(provider, model, prompt, agent_name, max_tokens=1024):
    """Submit a passage request. Returns request tile_id."""
    data = json.dumps({
        "question": f"PASSAGE: {provider} {model} {max_tokens}",
        "answer": prompt,
        "source": agent_name,
        "domain": "lighthouse",
        "tags": ["passage-request", provider],
        "timestamp": time.time(),
    }).encode()
    req = urllib.request.Request(
        f"{PLATO}/room/{REQUEST_ROOM}/submit",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        result = json.loads(r.read())
    return result.get("tile_id", "")


def wait_for_response(request_id, timeout=120, poll_interval=3):
    """Poll for the lighthouse response. Returns response text."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(f"{PLATO}/room/{RESPONSE_ROOM}", timeout=10) as r:
                tiles = json.loads(r.read())
        except:
            time.sleep(poll_interval)
            continue
        
        if isinstance(tiles, dict): tiles = tiles.get("tiles", [])
        
        for t in reversed(tiles):  # Check newest first
            q = t.get("question", "")
            if f"PASSAGE-RESPONSE:" in q:
                return {
                    "content": t.get("answer", ""),
                    "status": "ok",
                    "raw": t,
                }
            if f"PASSAGE-ERROR:" in q or f"PASSAGE-DENIED:" in q:
                return {
                    "content": t.get("answer", ""),
                    "status": "error",
                    "raw": t,
                }
        
        time.sleep(poll_interval)
    
    return {"content": "", "status": "timeout", "raw": None}


def request_passage(provider="deepinfra", model="ByteDance/Seed-2.0-mini",
                     prompt="", agent_name="zeroclaw", max_tokens=1024,
                     timeout=120):
    """
    Request a safe passage through the lighthouse.
    
    One function call. No API keys needed. The lighthouse handles everything.
    """
    # Submit request
    req_id = submit_request(provider, model, prompt, agent_name, max_tokens)
    
    # Wait for response
    response = wait_for_response(req_id, timeout=timeout)
    response["request_id"] = req_id
    
    return response


# ─── CLI ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Request a safe passage through the lighthouse")
    parser.add_argument("prompt", help="Your prompt text")
    parser.add_argument("--provider", default="deepinfra")
    parser.add_argument("--model", default="ByteDance/Seed-2.0-mini")
    parser.add_argument("--agent", default=os.environ.get("AGENT_NAME", "zeroclaw"))
    parser.add_argument("--max-tokens", type=int, default=512)
    parser.add_argument("--timeout", type=int, default=120)
    args = parser.parse_args()
    
    print(f"🚢 Requesting passage: {args.provider}/{args.model}")
    result = request_passage(
        provider=args.provider,
        model=args.model,
        prompt=args.prompt,
        agent_name=args.agent,
        max_tokens=args.max_tokens,
        timeout=args.timeout,
    )
    
    if result["status"] == "ok":
        print(f"\n{result['content']}")
    else:
        print(f"\n❌ {result['status']}: {result['content'][:200]}")
