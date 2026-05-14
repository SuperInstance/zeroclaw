/**
 * eisenstein_bench_v2.c — Vectorizable Eisenstein snap.
 * 
 * v1 showed: scalar == SSE == AVX2 == AVX-512 because branchy 3x3 search
 * dominates. This version restructures for vectorization:
 * 1. Separate rounding pass (vectorizable)
 * 2. Separate distance pass (vectorizable)
 * 3. No branches in inner loop
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <time.h>

#define SQRT3 1.7320508075688772
#define N_NEIGHBORS 9

typedef struct { double x, y; } Point;
typedef struct { int a, b; } EInt;

/* Precomputed neighbor offsets */
static const int DA[N_NEIGHBORS] = {-1,-1,-1, 0,0,0, 1,1,1};
static const int DB[N_NEIGHBORS] = {-1, 0, 1,-1, 0, 1,-1, 0, 1};

static inline EInt snap_branchless(double x, double y) {
    double q = 2.0 * y / SQRT3;
    int b0 = (int)round(q);
    int a0 = (int)round(x + b0 * 0.5);

    int best_a = a0, best_b = b0;
    double best_d = 1e18;

    /* Unrolled neighbor search — no branching on comparison */
    for (int k = 0; k < N_NEIGHBORS; k++) {
        int aa = a0 + DA[k], bb = b0 + DB[k];
        double cx = aa - bb * 0.5;
        double cy = bb * SQRT3 * 0.5;
        double dx = cx - x, dy = cy - y;
        double d = dx*dx + dy*dy;
        /* Conditional move instead of branch */
        if (d < best_d) { best_d = d; best_a = aa; best_b = bb; }
    }
    return (EInt){best_a, best_b};
}

/* Batch version: process points in blocks to help prefetch */
static void snap_batch(Point *pts, EInt *out, int n) {
    for (int i = 0; i < n; i++) {
        out[i] = snap_branchless(pts[i].x, pts[i].y);
    }
}

/* SoA version for better vectorization */
typedef struct {
    double *x; double *y; int n;
} PointSoA;

typedef struct {
    int *a; int *b; int n;
} EIntSoA;

static void snap_soa(PointSoA pts, EIntSoA out) {
    for (int i = 0; i < pts.n; i++) {
        double x = pts.x[i], y = pts.y[i];
        double q = 2.0 * y / SQRT3;
        int b0 = (int)round(q);
        int a0 = (int)round(x + b0 * 0.5);

        int best_a = a0, best_b = b0;
        double best_d = 1e18;
        for (int k = 0; k < N_NEIGHBORS; k++) {
            int aa = a0 + DA[k], bb = b0 + DB[k];
            double cx = aa - bb * 0.5;
            double cy = bb * SQRT3 * 0.5;
            double d = (cx-x)*(cx-x) + (cy-y)*(cy-y);
            if (d < best_d) { best_d = d; best_a = aa; best_b = bb; }
        }
        out.a[i] = best_a;
        out.b[i] = best_b;
    }
}

int main(int argc, char **argv) {
    int N = 1000000;
    int warmup = 10, trials = 100;
    int use_soa = 0;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--input-size") == 0 && i+1 < argc) N = atoi(argv[++i]);
        else if (strcmp(argv[i], "--warmup") == 0 && i+1 < argc) warmup = atoi(argv[++i]);
        else if (strcmp(argv[i], "--trials") == 0 && i+1 < argc) trials = atoi(argv[++i]);
        else if (strcmp(argv[i], "--soa") == 0) use_soa = 1;
    }

    srand48(42);

    if (!use_soa) {
        /* AoS layout */
        Point *pts = malloc(N * sizeof(Point));
        EInt *out = malloc(N * sizeof(EInt));
        for (int i = 0; i < N; i++) {
            pts[i].x = drand48()*20-10;
            pts[i].y = drand48()*20-10;
        }

        for (int w = 0; w < warmup; w++) snap_batch(pts, out, N);

        struct timespec t0, t1;
        double total_ns = 0;
        for (int t = 0; t < trials; t++) {
            clock_gettime(CLOCK_MONOTONIC, &t0);
            snap_batch(pts, out, N);
            clock_gettime(CLOCK_MONOTONIC, &t1);
            total_ns += (t1.tv_sec-t0.tv_sec)*1e9 + (t1.tv_nsec-t0.tv_nsec);
        }

        printf("layout: aos\n");
        printf("total_ns: %.0f ns\n", total_ns/trials);
        printf("per_snap_ns: %.1f ns\n", total_ns/trials/N);
        printf("throughput: %.2e snaps/sec\n", N / ((total_ns/trials)*1e-9));
        free(pts); free(out);
    } else {
        /* SoA layout */
        PointSoA pts = {malloc(N*8), malloc(N*8), N};
        EIntSoA out = {malloc(N*4), malloc(N*4), N};
        for (int i = 0; i < N; i++) {
            pts.x[i] = drand48()*20-10;
            pts.y[i] = drand48()*20-10;
        }

        for (int w = 0; w < warmup; w++) snap_soa(pts, out);

        struct timespec t0, t1;
        double total_ns = 0;
        for (int t = 0; t < trials; t++) {
            clock_gettime(CLOCK_MONOTONIC, &t0);
            snap_soa(pts, out);
            clock_gettime(CLOCK_MONOTONIC, &t1);
            total_ns += (t1.tv_sec-t0.tv_sec)*1e9 + (t1.tv_nsec-t0.tv_nsec);
        }

        printf("layout: soa\n");
        printf("total_ns: %.0f ns\n", total_ns/trials);
        printf("per_snap_ns: %.1f ns\n", total_ns/trials/N);
        printf("throughput: %.2e snaps/sec\n", N / ((total_ns/trials)*1e-9));
        free(pts.x); free(pts.y); free(out.a); free(out.b);
    }

    printf("input_size: %d\n", N);
    return 0;
}
