#!/usr/bin/env python3
"""
run_sweep.py — Parameter sweep runner for zeroclaw experiment sandboxes.

Runs inside Docker. Compiles kernel with different parameters, benchmarks,
writes results to PLATO. The sandbox is the experiment cell.

Usage:
    python3 run_sweep.py --config sweep.json
    python3 run_sweep.py --config sweep.json --dry-run  # show what would run
"""

import json
import itertools
import math
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

PLATO = os.environ.get("PLATO_URL", "http://localhost:8848")
WORKSPACE = os.environ.get("WORKSPACE", "/workspace")
RESULTS_ROOM = "experiment-results"


def submit_result(label, params, metrics, source="zeroclaw-experiment"):
    data = json.dumps({
        "question": label,
        "answer": json.dumps({"params": params, "metrics": metrics}, indent=2),
        "source": source,
        "domain": "experiment",
        "tags": ["experiment"] + [f"{k}={v}" for k, v in params.items()],
        "timestamp": time.time(),
    }).encode()
    req = urllib.request.Request(
        f"{PLATO}/room/{RESULTS_ROOM}/submit",
        data=data, headers={"Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print(f"  ⚠ PLATO submit failed: {e}")


def compile_cuda(source_file, output_file, arch="sm_80", extra_flags=""):
    """Compile a CUDA kernel."""
    cmd = f"nvcc -O3 -arch={arch} {extra_flags} -o {output_file} {source_file} -lm"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        return False, result.stderr
    return True, ""


def compile_c(source_file, output_file, extra_flags=""):
    """Compile a C/CUDA kernel with gcc."""
    cmd = f"gcc -O3 -march=native {extra_flags} -o {output_file} {source_file} -lm"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        return False, result.stderr
    return True, ""


def run_benchmark(binary, args="", timeout=60):
    """Run a compiled binary and capture output."""
    cmd = f"{binary} {args}"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    return result.stdout, result.returncode, result.stderr


def parse_metrics(output):
    """Try to extract key=value metrics from benchmark output."""
    metrics = {}
    for line in output.split("\n"):
        for pattern in [
            r'(\w+):\s*([\d.]+)\s*(ms|us|ns|s|GB|MB|KB|%)',
            r'(\w+)\s*=\s*([\d.eE+-]+)',
            r'(\w+):\s*([\d.eE+-]+)',
        ]:
            m = re.search(pattern, line)
            if m:
                key = m.group(1).lower()
                val = m.group(2)
                try:
                    metrics[key] = float(val)
                except:
                    metrics[key] = val
    return metrics


def expand_sweep(params):
    """Expand parameter ranges into individual configurations."""
    # If a param is a list, sweep over it. If scalar, use as-is.
    keys = list(params.keys())
    values = []
    for k in keys:
        v = params[k]
        if isinstance(v, list):
            values.append(v)
        else:
            values.append([v])
    return [dict(zip(keys, combo)) for combo in itertools.product(*values)]


def run_cuda_sweep(config):
    """Run a CUDA kernel parameter sweep."""
    kernel = config.get("kernel", "")
    if not os.path.exists(kernel):
        print(f"  ⚠ Kernel not found: {kernel}")
        return []

    params = config.get("parameters", {})
    input_size = config.get("input_size", 1000000)
    warmup = config.get("warmup", 10)
    trials = config.get("trials", 100)

    configs = expand_sweep(params)
    print(f"  {len(configs)} configurations to test")

    results = []
    for i, cfg in enumerate(configs):
        block = cfg.get("block_size", 256)
        arch = cfg.get("architecture", "sm_80").replace("sm_", "sm_")
        prec = cfg.get("precision", "fp32")
        layout = cfg.get("memory_layout", "aos")

        label = f"CUDA-SWEEP: {os.path.basename(kernel)} block={block} arch={arch} prec={prec} layout={layout}"

        # Compile flags
        flags = f"-DBLOCK_SIZE={block}"
        if prec == "fp16": flags += " -DUSE_FP16"
        elif prec == "bf16": flags += " -DUSE_BF16"
        if layout == "soa": flags += " -DUSE_SOA"

        binary = f"/tmp/sweep_{i}"
        ok, err = compile_cuda(kernel, binary, arch, flags)

        if not ok:
            submit_result(label, cfg, {"compile_error": err[:500]})
            print(f"  [{i+1}/{len(configs)}] ✗ compile failed: {err[:80]}")
            continue

        # Run benchmark
        args = f"--input-size {input_size} --warmup {warmup} --trials {trials}"
        stdout, rc, stderr = run_benchmark(binary, args)
        metrics = parse_metrics(stdout)

        if rc != 0:
            metrics["runtime_error"] = stderr[:500]
            print(f"  [{i+1}/{len(configs)}] ✗ runtime error")
        else:
            print(f"  [{i+1}/{len(configs)}] ✓ {metrics}")

        submit_result(label, cfg, metrics)
        results.append({"config": cfg, "metrics": metrics})

        # Cleanup
        os.unlink(binary) if os.path.exists(binary) else None

    return results


def run_avx_sweep(config):
    """Run an AVX/SSE vector width sweep."""
    kernel = config.get("kernel", "")
    params = config.get("parameters", {})

    configs = expand_sweep(params)
    print(f"  {len(configs)} configurations to test")

    results = []
    for i, cfg in enumerate(configs):
        vec_width = cfg.get("vector_width", "avx512")
        data_size = cfg.get("data_size", 10000)
        dimension = cfg.get("dimension", 64)
        top_k = cfg.get("top_k", 10)

        label = f"AVX-SWEEP: {os.path.basename(kernel)} width={vec_width} N={data_size} dim={dimension} top_k={top_k}"

        # Compile flags
        flags = {
            "sse": "-msse4.2",
            "avx2": "-mavx2 -mfma",
            "avx512": "-mavx512f -mavx512dq -mavx512vl",
        }.get(vec_width, "-march=native")

        flags += f" -DVECTOR_WIDTH={vec_width.upper()} -DDIM={dimension} -DDATA_SIZE={data_size} -DTOP_K={top_k}"

        binary = f"/tmp/sweep_{i}"
        ok, err = compile_c(kernel, binary, flags)

        if not ok:
            submit_result(label, cfg, {"compile_error": err[:500]})
            continue

        stdout, rc, stderr = run_benchmark(binary)
        metrics = parse_metrics(stdout)

        if rc == 0:
            print(f"  [{i+1}/{len(configs)}] ✓ {metrics}")
        else:
            print(f"  [{i+1}/{len(configs)}] ✗ runtime error")

        submit_result(label, cfg, metrics)
        results.append({"config": cfg, "metrics": metrics})
        os.unlink(binary) if os.path.exists(binary) else None

    return results


def run_generic_sweep(config):
    """Run a generic parameter sweep (any binary that takes --param flags)."""
    binary = config.get("binary", "")
    params = config.get("parameters", {})
    dataset = config.get("dataset", "")

    configs = expand_sweep(params)
    print(f"  {len(configs)} configurations to test")

    results = []
    for i, cfg in enumerate(configs):
        args = " ".join(f"--{k} {v}" for k, v in cfg.items())
        if dataset:
            args += f" --dataset {dataset}"

        label = f"SWEEP: {os.path.basename(binary)} {args}"

        stdout, rc, stderr = run_benchmark(binary, args, timeout=300)
        metrics = parse_metrics(stdout)

        status = "✓" if rc == 0 else "✗"
        print(f"  [{i+1}/{len(configs)}] {status} {metrics}")

        submit_result(label, cfg, metrics)
        results.append({"config": cfg, "metrics": metrics})

    return results


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 run_sweep.py --config sweep.json [--dry-run]")
        sys.exit(1)

    config_file = None
    dry_run = "--dry-run" in sys.argv
    for i, arg in enumerate(sys.argv):
        if arg == "--config" and i + 1 < len(sys.argv):
            config_file = sys.argv[i + 1]

    if not config_file or not os.path.exists(config_file):
        print(f"Config not found: {config_file}")
        sys.exit(1)

    with open(config_file) as f:
        config = json.load(f)

    sweep_type = config.get("type", "generic")
    params = config.get("parameters", {})

    configs = expand_sweep(params)

    print(f"🔬 Zeroclaw Experiment Sweep")
    print(f"   Type: {sweep_type}")
    print(f"   Configurations: {len(configs)}")
    print(f"   PLATO: {PLATO}")
    print()

    if dry_run:
        print("Configurations:")
        for i, c in enumerate(configs):
            print(f"  [{i+1}] {c}")
        return

    if sweep_type == "cuda_sweep":
        results = run_cuda_sweep(config)
    elif sweep_type == "avx_sweep":
        results = run_avx_sweep(config)
    else:
        results = run_generic_sweep(config)

    print(f"\n🔬 Complete: {len(results)} experiments run")

    # Summary
    if results:
        best = None
        best_metric = float('inf')
        metric_key = config.get("optimize", "latency_ns")
        for r in results:
            m = r.get("metrics", {}).get(metric_key, float('inf'))
            if isinstance(m, (int, float)) and m < best_metric:
                best_metric = m
                best = r

        if best:
            print(f"   Best {metric_key}: {best_metric}")
            print(f"   Config: {best['config']}")


if __name__ == "__main__":
    main()
