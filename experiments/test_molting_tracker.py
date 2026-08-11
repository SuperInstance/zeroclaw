"""
Tests for the ZeroClaw Molting Tracker.

Tests cover:
1. Basic event recording
2. γ (crystallized) and η (liquid) computation
3. γ/η ratio behavior
4. Molt detection
5. Trajectory analysis
6. Save/load round-trip
7. Fleet tracking
"""

import json
import time
import numpy as np
import pytest
from pathlib import Path

from experiments.molting_tracker import (
    MoltingTracker,
    MoltingEvent,
    MoltingReport,
    FleetMoltingTracker,
)


class TestBasicRecording:
    """Test basic event recording."""

    def test_empty_tracker(self):
        tracker = MoltingTracker("test-agent")
        assert len(tracker.events) == 0
        report = tracker.report()
        assert report.window_size == 0
        assert report.gamma == 0.0
        assert report.eta == 0.0

    def test_record_single_hit(self):
        tracker = MoltingTracker("test")
        tracker.record_cycle(tile_hit=True, response_time_ms=0.5, tile_id="t1")
        assert len(tracker.events) == 1
        assert tracker.events[0].tile_hit is True
        assert tracker.events[0].tile_id == "t1"

    def test_record_single_miss(self):
        tracker = MoltingTracker("test")
        tracker.record_cycle(tile_hit=False, response_time_ms=1500)
        assert tracker.events[0].tile_hit is False
        assert tracker.events[0].tile_id is None

    def test_record_with_all_fields(self):
        tracker = MoltingTracker("test")
        tracker.record_cycle(
            tile_hit=True,
            response_time_ms=0.3,
            tile_id="tile-001",
            quality_score=0.92,
            surprised=False,
        )
        ev = tracker.events[0]
        assert ev.quality_score == 0.92
        assert ev.surprised is False

    def test_custom_timestamp(self):
        tracker = MoltingTracker("test")
        tracker.record_cycle(
            tile_hit=True, response_time_ms=1.0, timestamp=1000.0
        )
        assert tracker.events[0].timestamp == 1000.0


class TestGammaEta:
    """Test γ (crystallized) and η (liquid) calculations."""

    def test_all_tile_hits(self):
        tracker = MoltingTracker("test")
        for _ in range(10):
            tracker.record_cycle(tile_hit=True, response_time_ms=0.5)
        assert tracker.gamma() == pytest.approx(1.0)
        assert tracker.eta() == pytest.approx(0.0)

    def test_all_cortex_calls(self):
        tracker = MoltingTracker("test")
        for _ in range(10):
            tracker.record_cycle(tile_hit=False, response_time_ms=2000)
        assert tracker.gamma() == pytest.approx(0.0)
        assert tracker.eta() == pytest.approx(1.0)

    def test_half_and_half(self):
        tracker = MoltingTracker("test")
        for i in range(10):
            tracker.record_cycle(tile_hit=(i % 2 == 0), response_time_ms=1.0)
        assert tracker.gamma() == pytest.approx(0.5)
        assert tracker.eta() == pytest.approx(0.5)

    def test_gamma_plus_eta_is_one(self):
        """The fundamental conservation: γ + η = 1.0."""
        tracker = MoltingTracker("test")
        rng = np.random.default_rng(42)
        for _ in range(100):
            tracker.record_cycle(
                tile_hit=bool(rng.random() < 0.7),
                response_time_ms=float(rng.uniform(0.1, 3000)),
            )
        g = tracker.gamma()
        e = tracker.eta()
        assert g + e == pytest.approx(1.0)

    def test_windowed_gamma(self):
        tracker = MoltingTracker("test")
        # First 10: all hits
        for _ in range(10):
            tracker.record_cycle(tile_hit=True, response_time_ms=0.5)
        # Next 10: all misses
        for _ in range(10):
            tracker.record_cycle(tile_hit=False, response_time_ms=2000)

        # Full window: γ = 0.5
        assert tracker.gamma() == pytest.approx(0.5)
        # Last 10: γ = 0.0
        assert tracker.gamma(window=10) == pytest.approx(0.0)

    def test_ratio_fully_crystallized(self):
        tracker = MoltingTracker("test")
        for _ in range(20):
            tracker.record_cycle(tile_hit=True, response_time_ms=0.3)
        assert tracker.gamma_eta_ratio() == float("inf")

    def test_ratio_balanced(self):
        tracker = MoltingTracker("test")
        for i in range(20):
            tracker.record_cycle(tile_hit=(i % 2 == 0), response_time_ms=1.0)
        # γ = 0.5, η = 0.5, ratio = 1.0
        assert tracker.gamma_eta_ratio() == pytest.approx(1.0)


class TestMoltDetection:
    """Test molt event detection."""

    def test_no_molt_with_steady_hits(self):
        tracker = MoltingTracker("test", molt_detection_window=5)
        for _ in range(20):
            tracker.record_cycle(tile_hit=True, response_time_ms=0.5)
        assert len(tracker.detected_molts) == 0

    def test_molt_detected(self):
        tracker = MoltingTracker("test", molt_detection_window=5)
        # First: some hits to establish baseline
        for _ in range(5):
            tracker.record_cycle(tile_hit=True, response_time_ms=0.5)
        # Then: 5 consecutive misses → molt
        for _ in range(5):
            tracker.record_cycle(tile_hit=False, response_time_ms=3000)
        assert len(tracker.detected_molts) == 1

    def test_no_duplicate_molts_overlapping(self):
        tracker = MoltingTracker("test", molt_detection_window=3)
        for _ in range(3):
            tracker.record_cycle(tile_hit=True, response_time_ms=0.5)
        # 5 consecutive misses (should be 1 molt, not 3)
        for _ in range(5):
            tracker.record_cycle(tile_hit=False, response_time_ms=3000)
        assert len(tracker.detected_molts) == 1

    def test_multiple_separate_molts(self):
        tracker = MoltingTracker("test", molt_detection_window=3)
        # Molt 1
        for _ in range(3):
            tracker.record_cycle(tile_hit=False, response_time_ms=3000)
        # Recovery
        for _ in range(5):
            tracker.record_cycle(tile_hit=True, response_time_ms=0.5)
        # Molt 2
        for _ in range(3):
            tracker.record_cycle(tile_hit=False, response_time_ms=3000)
        assert len(tracker.detected_molts) == 2


class TestTrajectory:
    """Test trajectory analysis over time."""

    def test_trajectory_returns_reports(self):
        tracker = MoltingTracker("test")
        # Simulate growth: tile hit rate increases over time
        rng = np.random.default_rng(42)
        for i in range(100):
            prob = min(0.95, 0.05 + i * 0.01)
            tracker.record_cycle(
                tile_hit=bool(rng.random() < prob),
                response_time_ms=float(rng.uniform(0.1, 2000)),
            )

        trajectory = tracker.trajectory(window_size=20, step=10)
        assert len(trajectory) > 0
        assert all(isinstance(r, MoltingReport) for r in trajectory)

    def test_trajectory_gamma_increases_over_time(self):
        """As agent learns, γ should trend upward."""
        tracker = MoltingTracker("test")
        rng = np.random.default_rng(42)
        for i in range(100):
            prob = min(0.95, 0.05 + i * 0.012)
            tracker.record_cycle(
                tile_hit=bool(rng.random() < prob),
                response_time_ms=float(rng.uniform(0.1, 2000)),
            )

        trajectory = tracker.trajectory(window_size=20, step=10)
        gammas = [r.gamma for r in trajectory]
        # Later windows should generally have higher γ
        assert gammas[-1] > gammas[0]


class TestSaveLoad:
    """Test JSON serialization round-trip."""

    def test_save_load_roundtrip(self, tmp_path):
        tracker = MoltingTracker("test-agent", molt_detection_window=5)
        tracker.record_cycle(tile_hit=True, response_time_ms=0.5, tile_id="t1")
        tracker.record_cycle(tile_hit=False, response_time_ms=1500)
        tracker.record_cycle(
            tile_hit=True, response_time_ms=0.3, tile_id="t2", quality_score=0.9
        )

        save_path = tmp_path / "tracker.json"
        tracker.save(save_path)

        loaded = MoltingTracker.load(save_path)
        assert loaded.agent_id == "test-agent"
        assert len(loaded.events) == 3
        assert loaded.events[0].tile_hit is True
        assert loaded.events[1].tile_hit is False
        assert loaded.events[2].quality_score == 0.9

    def test_save_load_preserves_molts(self, tmp_path):
        tracker = MoltingTracker("test", molt_detection_window=3)
        for _ in range(3):
            tracker.record_cycle(tile_hit=False, response_time_ms=3000)

        save_path = tmp_path / "tracker.json"
        tracker.save(save_path)

        loaded = MoltingTracker.load(save_path)
        assert len(loaded.detected_molts) == len(tracker.detected_molts)


class TestFleetTracker:
    """Test fleet-level tracking."""

    def test_fleet_default_agents(self):
        fleet = FleetMoltingTracker()
        assert set(fleet.trackers.keys()) == {"scout", "forge", "quill", "lens", "echo"}

    def test_fleet_custom_agents(self):
        fleet = FleetMoltingTracker(["alpha", "beta"])
        assert set(fleet.trackers.keys()) == {"alpha", "beta"}

    def test_fleet_record(self):
        fleet = FleetMoltingTracker(["scout", "forge"])
        fleet.record("scout", tile_hit=True, response_time_ms=0.5, tile_id="t1")
        fleet.record("forge", tile_hit=False, response_time_ms=2000)
        assert len(fleet.trackers["scout"].events) == 1
        assert len(fleet.trackers["forge"].events) == 1

    def test_fleet_auto_creates_agent(self):
        fleet = FleetMoltingTracker()
        fleet.record("newcomer", tile_hit=True, response_time_ms=0.3)
        assert "newcomer" in fleet.trackers

    def test_fleet_summary(self):
        fleet = FleetMoltingTracker(["scout", "forge"])
        # Scout: mostly crystallized
        for _ in range(20):
            fleet.record("scout", tile_hit=True, response_time_ms=0.5)
        # Forge: mostly liquid
        for _ in range(20):
            fleet.record("forge", tile_hit=False, response_time_ms=2000)

        summary = fleet.fleet_gamma_eta_summary()
        assert summary["most_crystallized"] == "scout"
        assert summary["most_liquid"] == "forge"
        assert summary["mean_gamma"] == pytest.approx(0.5)


class TestConservationLaw:
    """Test the γ + η conservation hypothesis."""

    def test_basic_conservation(self):
        """γ + η should always sum to 1.0 by definition."""
        tracker = MoltingTracker("test")
        rng = np.random.default_rng(99)
        for _ in range(200):
            tracker.record_cycle(
                tile_hit=bool(rng.random() < 0.6),
                response_time_ms=float(rng.uniform(0.1, 2000)),
            )
        report = tracker.report()
        assert report.gamma_plus_eta == pytest.approx(1.0)

    def test_quality_weighted_conservation(self):
        """Effective conservation: quality is redistributed, not lost."""
        tracker = MoltingTracker("test")
        rng = np.random.default_rng(42)
        for _ in range(100):
            tile_hit = bool(rng.random() < 0.7)
            if tile_hit:
                quality = float(rng.uniform(0.7, 1.0))
            else:
                quality = float(rng.uniform(0.4, 0.9))

            tracker.record_cycle(
                tile_hit=tile_hit,
                response_time_ms=float(rng.uniform(0.1, 2000)),
                quality_score=quality,
            )

        c = tracker.conservation_residual()
        # C should be roughly in [0.5, 1.5] for meaningful quality scores
        assert 0.5 < c < 1.5

    def test_response_time_bimodal(self):
        """Tile hits should be dramatically faster than cortex calls."""
        tracker = MoltingTracker("test")
        rng = np.random.default_rng(7)
        for _ in range(100):
            hit = bool(rng.random() < 0.6)
            tracker.record_cycle(
                tile_hit=hit,
                response_time_ms=(
                    float(rng.uniform(0.1, 3.0)) if hit
                    else float(rng.uniform(500, 5000))
                ),
            )

        report = tracker.report()
        assert report.tile_hit_response_time_ms < 5.0  # < 5ms
        assert report.cortex_response_time_ms > 500  # > 500ms
