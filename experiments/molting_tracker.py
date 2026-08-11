"""
ZeroClaw — Molting Tracker
===========================

Tracks tile density vs flexibility over time for ZeroClaw agents.

THEORY (from the Hermit Crab Protocol):
    γ (gamma) = crystallized knowledge — tile hit rate (reflexes that fire)
    η  (eta)  = liquid flexibility — novel response rate (tile misses → cortex)

    Conservation Law Hypothesis:  γ + η ≈ C  (constant for each agent)

    As an agent accumulates tiles (γ ↑), its novel response rate drops (η ↓).
    The total cognitive bandwidth C should remain roughly constant.
    When the agent "molts" (grows a new shell), it temporarily dips in γ
    but gains η — exploring new territory before re-crystallizing.

MEASUREMENT:
    - Tile hit rate: fraction of interactions handled by tile matching
    - Novel response rate: fraction requiring cortex (model invocation)
    - γ/η ratio: crystallized-to-liquid ratio
    - Conservation check: does γ + η ≈ C hold over time?

USAGE:
    from experiments.molting_tracker import MoltingTracker, MoltingEvent

    tracker = MoltingTracker(agent_id="scout")
    tracker.record_cycle(tile_hit=True, response_time_ms=0.5)
    tracker.record_cycle(tile_hit=False, response_time_ms=1500)
    report = tracker.report()
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Sequence

import numpy as np


# ---------------------------------------------------------------------------
# Data Structures
# ---------------------------------------------------------------------------

@dataclass
class MoltingEvent:
    """A single interaction cycle for a ZeroClaw agent.

    Attributes
    ----------
    timestamp : float
        Unix timestamp of the interaction.
    tile_hit : bool
        True if a tile matched and handled this interaction (γ contribution).
    response_time_ms : float
        Response time in milliseconds. Tile hits should be <1ms.
    tile_id : str | None
        Which tile fired, if any.
    quality_score : float | None
        Quality of the response (0.0–1.0), if measured.
    surprised : bool
        Whether the agent expressed surprise (novel situation).
    """
    timestamp: float
    tile_hit: bool
    response_time_ms: float
    tile_id: str | None = None
    quality_score: float | None = None
    surprised: bool = False


@dataclass
class MoltingReport:
    """Summary statistics for a window of molting events."""
    window_size: int
    gamma: float  # tile hit rate (crystallized)
    eta: float    # novel response rate (liquid)
    gamma_plus_eta: float  # conservation check (should be ~1.0)
    gamma_eta_ratio: float  # γ/η ratio (>1 = crystallized, <1 = liquid)
    mean_response_time_ms: float
    tile_hit_response_time_ms: float
    cortex_response_time_ms: float
    tile_ids_used: list[str]
    surprise_rate: float
    molt_events: int  # number of detected molts in window
    window_start: float
    window_end: float

    def as_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------------
# Tracker
# ---------------------------------------------------------------------------

class MoltingTracker:
    """Tracks tile density vs flexibility for a ZeroClaw agent.

    Records interaction cycles and computes the γ (crystallized) vs
    η (liquid) ratio over time, testing the conservation law.

    Parameters
    ----------
    agent_id : str
        The ZeroClaw agent identifier (e.g., "scout", "forge").
    molt_detection_window : int
        Number of consecutive low-γ cycles that indicate a molt event.
        Default: 5 (if 5+ consecutive novel responses, it's a molt).
    """

    def __init__(
        self,
        agent_id: str,
        molt_detection_window: int = 5,
    ):
        self.agent_id = agent_id
        self.events: list[MoltingEvent] = []
        self.molt_detection_window = molt_detection_window
        self.detected_molts: list[dict] = []  # timestamps of molts

    def record_cycle(
        self,
        tile_hit: bool,
        response_time_ms: float,
        tile_id: str | None = None,
        quality_score: float | None = None,
        surprised: bool = False,
        timestamp: float | None = None,
    ) -> MoltingEvent:
        """Record a single interaction cycle.

        Parameters
        ----------
        tile_hit : bool
            True if a tile matched this interaction.
        response_time_ms : float
            Response time in milliseconds.
        tile_id : str | None
            Which tile fired, if any.
        quality_score : float | None
            Response quality (0.0–1.0) if measured.
        surprised : bool
            Whether the agent was surprised (novel situation).
        timestamp : float | None
            Override timestamp (for replay from logs).

        Returns
        -------
        MoltingEvent
            The recorded event.
        """
        event = MoltingEvent(
            timestamp=timestamp if timestamp is not None else time.time(),
            tile_hit=tile_hit,
            response_time_ms=response_time_ms,
            tile_id=tile_id,
            quality_score=quality_score,
            surprised=surprised,
        )
        self.events.append(event)
        self._check_for_molt()
        return event

    def _check_for_molt(self) -> None:
        """Detect molt events: consecutive novel responses (tile misses)."""
        if len(self.events) < self.molt_detection_window:
            return

        recent = self.events[-self.molt_detection_window:]
        if all(not e.tile_hit for e in recent):
            # All recent cycles were novel — this is a molt
            molt = {
                "timestamp": recent[-1].timestamp,
                "window": self.molt_detection_window,
                "note": "Extended novel response period — shell expansion likely",
            }
            # Avoid duplicate molts for overlapping windows
            if not self.detected_molts or (
                self.detected_molts[-1]["timestamp"] < recent[0].timestamp
            ):
                self.detected_molts.append(molt)

    def gamma(self, window: int | None = None) -> float:
        """Compute γ (crystallized knowledge = tile hit rate).

        Parameters
        ----------
        window : int | None
            Number of most recent events to consider. None = all.

        Returns
        -------
        float
            Fraction of interactions handled by tiles, in [0, 1].
        """
        events = self.events[-window:] if window else self.events
        if not events:
            return 0.0
        hits = sum(1 for e in events if e.tile_hit)
        return hits / len(events)

    def eta(self, window: int | None = None) -> float:
        """Compute η (liquid flexibility = novel response rate).

        This is 1 - γ — the fraction of interactions that required cortex.

        Parameters
        ----------
        window : int | None
            Number of most recent events. None = all.

        Returns
        -------
        float
            Fraction requiring cortex, in [0, 1].
        """
        return 1.0 - self.gamma(window)

    def gamma_eta_ratio(self, window: int | None = None) -> float:
        """Compute γ/η ratio.

        >1 means the agent is crystallized (efficient, tile-driven).
        <1 means the agent is liquid (exploring, novel situations).
        """
        g = self.gamma(window)
        e = self.eta(window)
        if e < 1e-10:
            return float("inf")
        return g / e

    def conservation_residual(self, window: int | None = None) -> float:
        """Test whether γ + η = C.

        Since γ + η = 1.0 by definition (every interaction is either
        tile-hit or tile-miss), this always returns 1.0.

        BUT the *effective* conservation law is about cognitive bandwidth:
            effective_γ + effective_η ≈ C

        Where effective_γ = Σ(tile_quality * tile_hits) / total_interactions
        and effective_η = Σ(novelty_quality * cortex_calls) / total_interactions.

        This measures whether quality is conserved when shifting from
        reflexive to novel processing.

        Returns
        -------
        float
            The conservation constant C. Should be ~constant over time
            if the law holds.
        """
        events = self.events[-window:] if window else self.events
        if not events:
            return 0.0

        gamma_quality = sum(
            (e.quality_score or 0.5) for e in events if e.tile_hit
        ) / len(events)
        eta_quality = sum(
            (e.quality_score or 0.5) for e in events if not e.tile_hit
        ) / len(events)
        return gamma_quality + eta_quality

    def mean_response_time(
        self, window: int | None = None, tile_only: bool = False
    ) -> float:
        """Mean response time in ms."""
        events = self.events[-window:] if window else self.events
        if tile_only:
            events = [e for e in events if e.tile_hit]
        elif tile_only is False and window:
            pass
        if not events:
            return 0.0
        return float(np.mean([e.response_time_ms for e in events]))

    def report(self, window: int | None = None) -> MoltingReport:
        """Generate a full molting report for the tracking window."""
        events = self.events[-window:] if window else self.events
        if not events:
            return MoltingReport(
                window_size=0, gamma=0.0, eta=0.0, gamma_plus_eta=0.0,
                gamma_eta_ratio=0.0, mean_response_time_ms=0.0,
                tile_hit_response_time_ms=0.0, cortex_response_time_ms=0.0,
                tile_ids_used=[], surprise_rate=0.0, molt_events=0,
                window_start=0.0, window_end=0.0,
            )

        g = self.gamma(window)
        e = self.eta(window)

        tile_events = [ev for ev in events if ev.tile_hit]
        cortex_events = [ev for ev in events if not ev.tile_hit]

        tile_rt = (
            float(np.mean([ev.response_time_ms for ev in tile_events]))
            if tile_events else 0.0
        )
        cortex_rt = (
            float(np.mean([ev.response_time_ms for ev in cortex_events]))
            if cortex_events else 0.0
        )

        tile_ids = sorted(set(
            ev.tile_id for ev in tile_events if ev.tile_id
        ))

        surprise_count = sum(1 for ev in events if ev.surprised)

        # Count molts within this window
        window_start = events[0].timestamp
        window_end = events[-1].timestamp
        molts_in_window = sum(
            1 for m in self.detected_molts
            if window_start <= m["timestamp"] <= window_end
        )

        return MoltingReport(
            window_size=len(events),
            gamma=g,
            eta=e,
            gamma_plus_eta=g + e,  # Should be 1.0
            gamma_eta_ratio=g / e if e > 1e-10 else float("inf"),
            mean_response_time_ms=float(np.mean([ev.response_time_ms for ev in events])),
            tile_hit_response_time_ms=tile_rt,
            cortex_response_time_ms=cortex_rt,
            tile_ids_used=tile_ids,
            surprise_rate=surprise_count / len(events),
            molt_events=molts_in_window,
            window_start=window_start,
            window_end=window_end,
        )

    def trajectory(
        self, window_size: int = 20, step: int = 5
    ) -> list[MoltingReport]:
        """Compute a trajectory of reports over time.

        Slides a window across the event history to show how γ and η
        evolve. Useful for plotting the molting curve.

        Parameters
        ----------
        window_size : int
            Events per window.
        step : int
            Step between windows.

        Returns
        -------
        list[MoltingReport]
            One report per window position.
        """
        reports = []
        for start in range(0, len(self.events) - window_size + 1, step):
            window_events = self.events[start : start + window_size]
            # Temporarily set events to just this window
            old_events = self.events
            self.events = window_events
            reports.append(self.report())
            self.events = old_events
        return reports

    def save(self, path: str | Path) -> None:
        """Save the tracker state to JSON."""
        path = Path(path)
        data = {
            "agent_id": self.agent_id,
            "events": [asdict(e) for e in self.events],
            "detected_molts": self.detected_molts,
            "molt_detection_window": self.molt_detection_window,
        }
        path.write_text(json.dumps(data, indent=2))

    @classmethod
    def load(cls, path: str | Path) -> "MoltingTracker":
        """Load a tracker from JSON."""
        path = Path(path)
        data = json.loads(path.read_text())
        tracker = cls(
            agent_id=data["agent_id"],
            molt_detection_window=data.get("molt_detection_window", 5),
        )
        for ev_data in data["events"]:
            tracker.events.append(MoltingEvent(**ev_data))
        tracker.detected_molts = data.get("detected_molts", [])
        return tracker


# ---------------------------------------------------------------------------
# Fleet Tracker — Track Multiple Agents
# ---------------------------------------------------------------------------

class FleetMoltingTracker:
    """Track molting for the entire ZeroClaw fleet simultaneously.

    Provides fleet-level statistics and cross-agent comparison.
    """

    def __init__(self, agent_ids: Sequence[str] | None = None):
        if agent_ids is None:
            agent_ids = ["scout", "forge", "quill", "lens", "echo"]
        self.trackers: dict[str, MoltingTracker] = {
            aid: MoltingTracker(aid) for aid in agent_ids
        }

    def record(
        self,
        agent_id: str,
        tile_hit: bool,
        response_time_ms: float,
        **kwargs,
    ) -> MoltingEvent:
        """Record a cycle for a specific agent."""
        if agent_id not in self.trackers:
            self.trackers[agent_id] = MoltingTracker(agent_id)
        return self.trackers[agent_id].record_cycle(
            tile_hit=tile_hit,
            response_time_ms=response_time_ms,
            **kwargs,
        )

    def fleet_report(self, window: int | None = None) -> dict[str, MoltingReport]:
        """Get reports for all tracked agents."""
        return {aid: t.report(window) for aid, t in self.trackers.items()}

    def fleet_gamma_eta_summary(self, window: int | None = None) -> dict:
        """Summarize γ/η across the fleet."""
        reports = self.fleet_report(window)
        gammas = [r.gamma for r in reports.values()]
        etas = [r.eta for r in reports.values()]
        return {
            "agents": list(reports.keys()),
            "mean_gamma": float(np.mean(gammas)),
            "mean_eta": float(np.mean(etas)),
            "std_gamma": float(np.std(gammas)),
            "std_eta": float(np.std(etas)),
            "most_crystallized": max(reports, key=lambda a: reports[a].gamma),
            "most_liquid": max(reports, key=lambda a: reports[a].eta),
            "total_molts": sum(r.molt_events for r in reports.values()),
        }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _cli():
    import argparse
    parser = argparse.ArgumentParser(
        description="ZeroClaw Molting Tracker — γ/η ratio measurement"
    )
    sub = parser.add_subparsers(dest="command")

    # Simulate
    sim = sub.add_parser("simulate", help="Run a growth simulation")
    sim.add_argument("--cycles", type=int, default=100, help="Number of cycles")
    sim.add_argument("--agent", default="scout", help="Agent name")

    # Report from file
    rep = sub.add_parser("report", help="Report from saved tracker file")
    rep.add_argument("--file", required=True, help="Tracker JSON file")

    args = parser.parse_args()

    if args.command == "simulate":
        tracker = MoltingTracker(args.agent)
        rng = np.random.default_rng(42)

        for i in range(args.cycles):
            # Tile hit probability increases over time (learning)
            tile_prob = min(0.9, 0.1 + i * 0.01)
            tile_hit = rng.random() < tile_prob

            if tile_hit:
                rt = float(rng.uniform(0.1, 2.0))
                tile_id = f"tile-{rng.integers(1, 10)}"
            else:
                rt = float(rng.uniform(500, 3000))
                tile_id = None

            tracker.record_cycle(
                tile_hit=tile_hit,
                response_time_ms=rt,
                tile_id=tile_id,
                surprised=not tile_hit and rng.random() < 0.3,
            )

        report = tracker.report()
        print(f"\nAgent: {args.agent}")
        print(f"Cycles: {report.window_size}")
        print(f"γ (crystallized):  {report.gamma:.3f}")
        print(f"η (liquid):        {report.eta:.3f}")
        print(f"γ + η =            {report.gamma_plus_eta:.3f}")
        print(f"γ/η ratio:         {report.gamma_eta_ratio:.2f}")
        print(f"Tile RT:           {report.tile_hit_response_time_ms:.1f}ms")
        print(f"Cortex RT:         {report.cortex_response_time_ms:.1f}ms")
        print(f"Surprise rate:     {report.surprise_rate:.3f}")
        print(f"Molt events:       {report.molt_events}")
        print(f"Tiles used:        {', '.join(report.tile_ids_used)}")

    elif args.command == "report":
        tracker = MoltingTracker.load(args.file)
        report = tracker.report()
        print(json.dumps(report.as_dict(), indent=2))

    else:
        parser.print_help()


if __name__ == "__main__":
    _cli()
