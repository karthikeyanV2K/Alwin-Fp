"""
temporal_validator.py — Sliding-Window Prediction Stabilizer
=============================================================
This module prevents the system from reacting to a single-frame
false positive. A prediction is only "confirmed" when a consistent
label appears in at least `agree_ratio` of a rolling window of frames,
all above the `confidence_threshold`.
"""
from __future__ import annotations
from collections import deque
from typing import Optional, Tuple


class TemporalValidator:
    """
    Sliding-window temporal validator.

    Args:
        window_size:          Number of frames in the rolling window (default: 10)
        agree_ratio:          Fraction of window frames that must agree (default: 0.70)
        confidence_threshold: Minimum per-frame confidence to count (default: 0.72)
        cooldown_frames:      Frames to ignore after a confirmation fires (default: 30)
    """

    def __init__(
        self,
        window_size: int = 10,
        agree_ratio: float = 0.70,
        confidence_threshold: float = 0.72,
        cooldown_frames: int = 30,
    ):
        self.window_size  = window_size
        self.agree_ratio  = agree_ratio
        self.conf_thresh  = confidence_threshold
        self.cooldown     = cooldown_frames

        self._window: deque[Tuple[str, float]] = deque(maxlen=window_size)
        self._cooldown_counter: int = 0
        self._last_confirmed: Optional[str] = None

    def update(self, label: str, confidence: float) -> Optional[str]:
        """
        Feed one inference result.

        Returns the confirmed appliance label if the validation
        condition is satisfied — otherwise returns None.

        Args:
            label:      Predicted class name (e.g. "TV")
            confidence: Softmax probability [0, 1]
        """
        # Always add to window (even low-confidence frames shift history)
        self._window.append((label, confidence))

        # Handle cooldown after a confirmation
        if self._cooldown_counter > 0:
            self._cooldown_counter -= 1
            return None

        # Need a full window before deciding
        if len(self._window) < self.window_size:
            return None

        # Count qualifying frames per label
        counts: dict[str, int] = {}
        for lbl, conf in self._window:
            if lbl == "Other" or conf < self.conf_thresh:
                continue
            counts[lbl] = counts.get(lbl, 0) + 1

        if not counts:
            return None

        best_label = max(counts, key=counts.__getitem__)
        best_count = counts[best_label]
        required   = int(self.window_size * self.agree_ratio)

        if best_count >= required:
            self._cooldown_counter = self.cooldown
            self._last_confirmed   = best_label
            self._window.clear()   # reset window after confirmation
            return best_label

        return None

    def reset(self):
        """Manually reset state (e.g. after user confirms / rejects)."""
        self._window.clear()
        self._cooldown_counter = 0
        self._last_confirmed   = None

    @property
    def buffer(self) -> list[Tuple[str, float]]:
        return list(self._window)

    @property
    def fill_ratio(self) -> float:
        """How full the window is (0.0 → 1.0)."""
        return len(self._window) / self.window_size
