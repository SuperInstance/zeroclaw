# zeroclaw-experiment — Sandboxed Performance Tuning

A zeroclaw can be an isolated experiment cell for GPU/AVX/math kernels.

## The Problem

Performance tuning is messy:
- Different GPU architectures (sm_70, sm_75, sm_80, sm_86, sm_90)
- Different memory layouts (AoS vs SoA vs AoSOA)
- Different thread/block configurations
- Different precision modes (FP16, BF16, FP32, FP64)
- Cross-contamination between experiments
- Need to run on remote machines with actual GPUs

## The Solution: Zeroclaw as Experiment Cell

Each zeroclaw is a sealed experiment:
```
docker run --gpus all -v $(pwd)/experiment:/workspace \
  ghcr.io/superinstance/zeroclaw-experiment \
  python3 run_experiment.py --config config.json
```

Inside the sandbox:
1. `config.json` — parameters to tune
2. `kernel.cu` or `kernel.c` — the code to benchmark  
3. `run_experiment.py` — compile, run, measure, write results to PLATO
4. Results flow out as PLATO tiles — no need to SSH into the machine

## Architecture

```
┌─────────────────────────────────────┐
│         Host Machine (GPU)          │
│                                     │
│  ┌───────────┐  ┌───────────┐      │
│  │ zeroclaw-1│  │ zeroclaw-2│      │
│  │ config:   │  │ config:   │      │
│  │ sm=80     │  │ sm=86     │      │
│  │ block=256 │  │ block=512 │      │
│  │ prec=fp16 │  │ prec=fp32 │      │
│  └─────┬─────┘  └─────┬─────┘      │
│        │               │            │
│        ▼               ▼            │
│    ┌──────────────────────┐         │
│    │   Local PLATO SQLite │         │
│    │   (results merge)    │         │
│    └──────────┬───────────┘         │
│               │ fleet_sync.py       │
└───────────────┼─────────────────────┘
                │
                ▼
         ┌──────────────┐
         │ Fleet PLATO  │
         │ (aggregate)  │
         └──────────────┘
```

## Experiment Types

### 1. CUDA Kernel Sweep
```json
{
  "type": "cuda_sweep",
  "kernel": "eisenstein_snap.cu",
  "parameters": {
    "block_sizes": [128, 256, 512, 1024],
    "architectures": ["sm_70", "sm_75", "sm_80", "sm_86"],
    "precision": ["fp16", "fp32", "fp64"],
    "memory_layout": ["aos", "soa"]
  },
  "input_size": 10000000,
  "warmup": 100,
  "trials": 1000
}
```

### 2. AVX-512 Vector Width Sweep
```json
{
  "type": "avx_sweep",
  "kernel": "flux_vector_search.h",
  "parameters": {
    "vector_widths": ["sse", "avx2", "avx512"],
    "data_sizes": [1000, 10000, 100000, 1000000],
    "dimensions": [32, 64, 128, 256],
    "top_k": [1, 5, 10, 20]
  }
}
```

### 3. AI-Forest Scaling
```json
{
  "type": "ai_forest",
  "model": "decision_forest",
  "parameters": {
    "n_trees": [10, 50, 100, 500],
    "max_depth": [3, 5, 7, 10],
    "feature_fraction": [0.3, 0.5, 0.7, 1.0],
    "sample_fraction": [0.5, 0.7, 1.0]
  },
  "dataset": "drift-detect",
  "metric": "accuracy",
  "hardware": ["cpu", "gpu"]
}
```

### 4. Memory Hierarchy Sweep
```json
{
  "type": "cache_sweep",
  "kernel": "eisenstein_snap",
  "parameters": {
    "tile_sizes": [64, 256, 1024, 4096, 16384],
    "prefetch_distances": [0, 1, 2, 4, 8],
    "alignment": [32, 64, 128, 256]
  },
  "measure": ["l1_misses", "l2_misses", "llc_misses", "cycles"]
}
```

## How Results Flow

Each experiment writes a PLATO tile:
```json
{
  "room": "experiment-results",
  "question": "CUDA-SWEEP: eisenstein_snap block=256 sm_80 fp32",
  "answer": "{\"throughput\": 1.2e9, \"latency_ns\": 8.3, \"occupancy\": 0.87, ...}",
  "source": "zeroclaw-gpu-node-1",
  "tags": ["experiment", "cuda", "eisenstein_snap", "sm_80"]
}
```

FM (or any agent) reads the results, decomposes findings, requests follow-up experiments.
No SSH. No manual data collection. The sandboxes self-report.

## Why Docker?

1. **Isolation**: One experiment can't corrupt another
2. **Reproducibility**: Same container = same environment
3. **Resource control**: `--cpus=4 --memory=8g --gpus=1`
4. **Clean teardown**: Container dies, experiment stops, no residue
5. **Fleet distribution**: Same image runs on any GPU node
6. **Safety**: Broken kernel doesn't take down the host

## Current Fleet Capabilities

| Machine | GPU | CUDA | Use |
|---------|-----|------|-----|
| eileen (WSL2) | None (CPU only) | 11.5 (cross-compile) | AVX-512 benchmarks, kernel compilation |
| JetsonClaw1 | NVIDIA Jetson | 11.4 | Edge GPU experiments, NPU quantization |
| Oracle1 server | ? | ? | Production PLATO, fleet services |

## Next: Build the experiment runner

```bash
# Build experiment image (includes CUDA toolkit + PLATO client)
docker build -t zeroclaw-experiment -f Dockerfile.experiment .

# Run a sweep
docker run --gpus all \
  -v $(pwd)/experiments/cuda-sweep:/workspace \
  -e PLATO_URL=http://147.224.38.131:8847 \
  zeroclaw-experiment \
  python3 run_sweep.py --config sweep.json

# Results appear in PLATO room: experiment-results
```
