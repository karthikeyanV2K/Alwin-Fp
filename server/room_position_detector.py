"""
Room Position Detector
======================
Detects WHICH specific bulb is being pointed at based on its 
bounding box position in the camera frame.

Works with your existing MobileViT/YOLO detection pipeline.
"""

from dataclasses import dataclass
from typing import Optional
import numpy as np


# ─────────────────────────────────────────────────────────────
# STEP 1: Define your room zones (calibrate these values!)
# ─────────────────────────────────────────────────────────────

@dataclass
class Zone:
    """A rectangular region in the camera frame mapped to a device."""
    name: str           # e.g. "Living Room Bulb 1"
    device_id: str      # e.g. "relay_1" (matches your ESP32 relay ID)
    relay_pin: int      # GPIO pin on your ESP32
    # Bounding box in NORMALIZED coordinates (0.0 to 1.0)
    x_min: float        # left edge
    x_max: float        # right edge
    y_min: float        # top edge
    y_max: float        # bottom edge


# ─── CONFIGURE YOUR ZONES HERE ────────────────────────────────
# Divide the frame into regions for each bulb.
# These are normalized (0.0 = left/top, 1.0 = right/bottom)
#
# Example: 3 bulbs side by side in the same room
# ┌──────────┬──────────┬──────────┐
# │  ZONE A  │  ZONE B  │  ZONE C  │
# │  Bulb 1  │  Bulb 2  │  Bulb 3  │
# └──────────┴──────────┴──────────┘

ROOM_ZONES = [
    Zone(
        name="Living Room Bulb 1",
        device_id="relay_1",
        relay_pin=5,
        x_min=0.0,  x_max=0.33,  # Left third of frame
        y_min=0.0,  y_max=1.0,   # Full height
    ),
    Zone(
        name="Living Room Bulb 2",
        device_id="relay_2",
        relay_pin=18,
        x_min=0.33, x_max=0.66,  # Center third of frame
        y_min=0.0,  y_max=1.0,
    ),
    Zone(
        name="Living Room Bulb 3",
        device_id="relay_3",
        relay_pin=19,
        x_min=0.66, x_max=1.0,   # Right third of frame
        y_min=0.0,  y_max=1.0,
    ),
]


# ─────────────────────────────────────────────────────────────
# STEP 2: Zone Mapper — match a detection to a zone
# ─────────────────────────────────────────────────────────────

class RoomPositionDetector:
    """
    Maps detected bounding boxes to specific room devices.
    
    Usage:
        detector = RoomPositionDetector(ROOM_ZONES)
        zone = detector.identify(bbox, frame_width, frame_height)
        print(zone.device_id)  # → "relay_1"
    """

    def __init__(self, zones: list[Zone]):
        self.zones = zones

    def identify(
        self,
        bbox: tuple[int, int, int, int],  # (x1, y1, x2, y2) in pixels
        frame_width: int,
        frame_height: int,
    ) -> Optional[Zone]:
        """
        Given a detected bounding box, return the matching zone.
        
        Args:
            bbox: (x1, y1, x2, y2) pixel coordinates of detected object
            frame_width: camera frame width in pixels
            frame_height: camera frame height in pixels
            
        Returns:
            Matching Zone or None if no zone matched
        """
        x1, y1, x2, y2 = bbox

        # Get CENTER of the detected bounding box (normalized)
        cx = ((x1 + x2) / 2) / frame_width
        cy = ((y1 + y2) / 2) / frame_height

        return self._find_zone(cx, cy)

    def identify_from_normalized(self, cx: float, cy: float) -> Optional[Zone]:
        """Use this if your detector already returns normalized coords."""
        return self._find_zone(cx, cy)

    def _find_zone(self, cx: float, cy: float) -> Optional[Zone]:
        """Find which zone contains the center point (cx, cy)."""
        for zone in self.zones:
            if (zone.x_min <= cx <= zone.x_max and
                    zone.y_min <= cy <= zone.y_max):
                return zone
        return None  # Point is outside all defined zones

    def visualize_zones(self, frame: np.ndarray) -> np.ndarray:
        """
        Draw zone boundaries on the frame for debugging/calibration.
        Call this to visually see your zone boundaries.
        """
        import cv2
        h, w = frame.shape[:2]
        colors = [(0, 100, 255), (0, 200, 100), (255, 100, 0)]

        for i, zone in enumerate(self.zones):
            x1 = int(zone.x_min * w)
            x2 = int(zone.x_max * w)
            y1 = int(zone.y_min * h)
            y2 = int(zone.y_max * h)
            color = colors[i % len(colors)]

            # Draw zone rectangle
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            # Draw zone label
            cv2.putText(
                frame, zone.name,
                (x1 + 10, y1 + 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2
            )
        return frame


# ─────────────────────────────────────────────────────────────
# STEP 3: Integration with your existing FastAPI inference server
# ─────────────────────────────────────────────────────────────

# In your existing inference_server.py or websocket handler,
# add this logic after your model prediction:

DETECTOR = RoomPositionDetector(ROOM_ZONES)

def process_detection_with_position(
    label: str,
    bbox: tuple[int, int, int, int],
    confidence: float,
    frame_width: int,
    frame_height: int,
) -> dict:
    """
    Full pipeline: label + position → device command.
    
    Replace/extend your existing process_detection() function with this.
    """
    result = {
        "label": label,
        "confidence": confidence,
        "bbox": bbox,
        "zone": None,
        "device_id": None,
        "relay_pin": None,
        "command": None,
    }

    # Only process appliance-type labels
    if label.lower() not in ["bulb", "fan", "tv", "light"]:
        return result

    # Identify WHICH physical device this is
    zone = DETECTOR.identify(bbox, frame_width, frame_height)

    if zone:
        result["zone"] = zone.name
        result["device_id"] = zone.device_id
        result["relay_pin"] = zone.relay_pin
        result["command"] = {
            "device": zone.device_id,
            "pin": zone.relay_pin,
            "action": "toggle",
            "label": label,
            "confidence": confidence,
        }
        print(f"✅ Detected: {label} → Zone: {zone.name} → {zone.device_id}")
    else:
        print(f"⚠️  Detected: {label} but outside all defined zones")

    return result


# ─────────────────────────────────────────────────────────────
# STEP 4: Calibration helper — run this to find your zone values
# ─────────────────────────────────────────────────────────────

def calibrate_zones():
    """
    Run this script directly to find the correct zone boundaries.
    Point your camera at each bulb and note the printed coordinates.
    
    Usage: python room_position_detector.py
    """
    import cv2

    cap = cv2.VideoCapture(0)  # Change to your camera index
    print("📷 Calibration Mode — Point at each bulb and press SPACE")
    print("   The center coordinates will be printed.")
    print("   Press Q to quit.\n")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        h, w = frame.shape[:2]

        # Draw existing zones for reference
        frame_with_zones = DETECTOR.visualize_zones(frame.copy())

        # Show crosshair at center
        cx, cy = w // 2, h // 2
        cv2.drawMarker(frame_with_zones, (cx, cy), (0, 255, 255),
                       cv2.MARKER_CROSS, 30, 2)

        # Show normalized coords
        norm_x = cx / w
        norm_y = cy / h
        cv2.putText(
            frame_with_zones,
            f"Center: ({norm_x:.2f}, {norm_y:.2f})",
            (10, h - 20),
            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2
        )

        cv2.imshow("Zone Calibration", frame_with_zones)

        key = cv2.waitKey(1) & 0xFF
        if key == ord(' '):
            print(f"📌 Marked position: x={norm_x:.3f}, y={norm_y:.3f}")
        elif key == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    calibrate_zones()
