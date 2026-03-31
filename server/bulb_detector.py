"""
bulb_detector.py — Dedicated Bulb/Light Detector
=================================================
Uses OpenCV computer vision to detect light bulbs by:
  1. Brightness blob detection (lit bulb = very bright spot)
  2. Warm white / yellow color mask (typical bulb glow color)
  3. Hough circle transform (circular bulb shape)

Works ALONGSIDE the main MobileViT model (no extra ML model needed).
When both agree → high confidence.
When bulb detector finds it but MobileViT says "Other" → still flags it.
"""

import cv2
import numpy as np


class BulbDetector:
    """
    Detects lit light bulbs using pure computer vision.

    Scoring pipeline:
      base_score   = area of bright warm-colored blobs (0 → 0.65)
      circle_bonus = +0.20 per circular blob that overlaps bright region
      final        = capped at 0.97

    Result is merged with MobileViT label in main.py to boost
    "Light" predictions and suppress false negatives.
    """

    def __init__(
        self,
        brightness_threshold: int   = 190,   # pixel value 0-255
        min_radius: int              = 12,    # smallest bulb radius (px)
        max_radius: int              = 180,   # largest bulb radius (px)
        circle_bonus: float          = 0.20,  # confidence added per circle hit
        detection_threshold: float   = 0.35,  # min score to call it a bulb
    ):
        self.brightness_threshold = brightness_threshold
        self.min_radius           = min_radius
        self.max_radius           = max_radius
        self.circle_bonus         = circle_bonus
        self.detection_threshold  = detection_threshold

    # ── Public API ─────────────────────────────────────────────────────────────

    def detect(self, image_bytes: bytes) -> dict:
        """
        Run bulb detection on raw image bytes (JPEG/PNG).

        Args:
            image_bytes: Raw image bytes from camera frame

        Returns:
            {
                "bulb_detected": bool,
                "confidence":    float (0.0 – 1.0),
                "bboxes":        [(x, y, w, h), ...],   # pixel coords
                "centers":       [(cx, cy, radius), ...],
                "bright_ratio":  float,  # fraction of frame that is bright
            }
        """
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return self._empty()

            h, w = img.shape[:2]
            return self._run(img, h, w)

        except Exception as exc:
            print(f"[BulbDetector] Error: {exc}")
            return self._empty()

    def detect_from_pil(self, pil_image) -> dict:
        """Convenience: accept a PIL Image instead of bytes."""
        import io
        buf = io.BytesIO()
        pil_image.save(buf, format="JPEG", quality=85)
        return self.detect(buf.getvalue())

    # ── Internal ────────────────────────────────────────────────────────────────

    def _run(self, img, h: int, w: int) -> dict:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        hsv  = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

        # ── Step 1: Brightness mask ──────────────────────────────────────────
        _, bright = cv2.threshold(
            gray, self.brightness_threshold, 255, cv2.THRESH_BINARY
        )

        # ── Step 2: Color masks ──────────────────────────────────────────────
        # Warm white (low saturation, very bright)
        warm   = cv2.inRange(hsv, (10, 0, 200),  (35, 70, 255))
        # Pure white glare
        white  = cv2.inRange(hsv, (0, 0, 220),   (180, 25, 255))
        # Yellow-orange glow (classic incandescent/LED warm)
        yellow = cv2.inRange(hsv, (15, 50, 140), (40, 255, 255))

        color_mask = cv2.bitwise_or(cv2.bitwise_or(warm, white), yellow)

        # ── Step 3: Combined blob ────────────────────────────────────────────
        blob = cv2.bitwise_and(bright, color_mask)

        # Morphological clean-up
        close_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        open_k  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        blob = cv2.morphologyEx(blob, cv2.MORPH_CLOSE, close_k)
        blob = cv2.morphologyEx(blob, cv2.MORPH_OPEN,  open_k)

        # ── Step 4: Base confidence from bright region coverage ──────────────
        bright_ratio = float(np.sum(blob > 0)) / (h * w)
        confidence   = min(0.65, bright_ratio * 80)

        # ── Step 5: Hough circle detection ───────────────────────────────────
        blurred = cv2.GaussianBlur(gray, (9, 9), 2)
        circles = cv2.HoughCircles(
            blurred, cv2.HOUGH_GRADIENT,
            dp=1.2, minDist=40,
            param1=60, param2=28,
            minRadius=self.min_radius,
            maxRadius=self.max_radius,
        )

        centers, bboxes = [], []
        if circles is not None:
            for cx, cy, r in np.round(circles[0]).astype(int):
                y1, y2 = max(0, cy - r), min(h, cy + r)
                x1, x2 = max(0, cx - r), min(w, cx + r)
                roi = blob[y1:y2, x1:x2]

                # Circle counts only if it overlaps a bright blob
                if roi.size and np.sum(roi > 0) / roi.size > 0.15:
                    confidence = min(0.97, confidence + self.circle_bonus)
                    centers.append((int(cx), int(cy), int(r)))
                    bboxes.append((
                        int(cx - r), int(cy - r),
                        int(2 * r),  int(2 * r),
                    ))

        return {
            "bulb_detected": confidence >= self.detection_threshold,
            "confidence":    round(confidence, 3),
            "bboxes":        bboxes,
            "centers":       centers,
            "bright_ratio":  round(bright_ratio, 4),
        }

    def _empty(self) -> dict:
        return {
            "bulb_detected": False,
            "confidence":    0.0,
            "bboxes":        [],
            "centers":       [],
            "bright_ratio":  0.0,
        }
