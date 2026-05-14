/**
 * eisenstein_bench.c — Eisenstein snap benchmark with tunable parameters.
 *
 * Measures throughput of Eisenstein lattice snap across different:
 * - Vector widths (scalar, SSE, AVX2, AVX-512)
 * - Batch sizes
 * - Memory layouts
 *
 * Output: key=value pairs for run_sweep.py to parse.
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <time.h>

#ifdef USE_SSE
#include <immintrin.h>
#endif

#define SQRT3 1.7320508075688772
#define INV_SQRT3 0.5773502691896258

typedef struct { double x, y; } Point;
typedef struct { int a, b; } Eisenstein;

/* Correct Eisenstein snap: (x,y) cartesian -> (a,b) Eisenstein integer */
static inline Eisenstein snap_scalar(double x, double y) {
    double q = 2.0 * y / SQRT3;
    int b = (int)round(q);
    int a = (int)round(x + b * 0.5);

    Eisenstein best = {a, b};
    double best_d = 1e18;

    for (int da = -1; da <= 1; da++) {
        for (int db = -1; db <= 1; db++) {
            int aa = a + da, bb = b + db;
            double cx = aa - bb * 0.5;
            double cy = bb * SQRT3 * 0.5;
            double d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
            if (d < best_d) {
                best_d = d;
                best.a = aa;
                best.b = bb;
            }
        }
    }
    return best;
}

int main(int argc, char **argv) {
    int N = 1000000;
    int warmup = 10;
    int trials = 100;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--input-size") == 0 && i+1 < argc)
            N = atoi(argv[++i]);
        else if (strcmp(argv[i], "--warmup") == 0 && i+1 < argc)
            warmup = atoi(argv[++i]);
        else if (strcmp(argv[i], "--trials") == 0 && i+1 < argc)
            trials = atoi(argv[++i]);
    }

    /* Generate input data */
    Point *points = malloc(N * sizeof(Point));
    Eisenstein *results = malloc(N * sizeof(Eisenstein));

    srand48(42);
    for (int i = 0; i < N; i++) {
        points[i].x = drand48() * 20.0 - 10.0;
        points[i].y = drand48() * 20.0 - 10.0;
    }

    /* Warmup */
    for (int w = 0; w < warmup; w++) {
        for (int i = 0; i < N; i++) {
            results[i] = snap_scalar(points[i].x, points[i].y);
        }
    }

    /* Benchmark */
    struct timespec t0, t1;
    double total_ns = 0;

    for (int t = 0; t < trials; t++) {
        clock_gettime(CLOCK_MONOTONIC, &t0);
        for (int i = 0; i < N; i++) {
            results[i] = snap_scalar(points[i].x, points[i].y);
        }
        clock_gettime(CLOCK_MONOTONIC, &t1);
        double elapsed = (t1.tv_sec - t0.tv_sec) * 1e9 + (t1.tv_nsec - t0.tv_nsec);
        total_ns += elapsed;
    }

    double avg_ns = total_ns / trials;
    double per_snap_ns = avg_ns / N;
    double throughput = N / (avg_ns * 1e-9);  /* snaps/sec */

    /* Verify correctness on first 100 */
    int failures = 0;
    double max_d = 0;
    for (int i = 0; i < (N < 100 ? N : 100); i++) {
        double x = points[i].x, y = points[i].y;
        int a = results[i].a, b = results[i].b;
        double cx = a - b * 0.5;
        double cy = b * SQRT3 * 0.5;
        double d = sqrt((cx-x)*(cx-x) + (cy-y)*(cy-y));
        if (d > max_d) max_d = d;

        /* Check idempotence */
        Eisenstein s2 = snap_scalar(cx, cy);
        if (s2.a != a || s2.b != b) failures++;
    }

    /* Output metrics for run_sweep.py */
    printf("total_ns: %.0f ns\n", avg_ns);
    printf("per_snap_ns: %.1f ns\n", per_snap_ns);
    printf("throughput: %.2e snaps/sec\n", throughput);
    printf("max_snap_distance: %.6f\n", max_d);
    printf("covering_radius_bound: %.6f\n", 1.0/sqrt(3.0));
    printf("idempotence_failures: %d\n", failures);
    printf("input_size: %d\n", N);
    printf("trials: %d\n", trials);

    free(points);
    free(results);
    return 0;
}
