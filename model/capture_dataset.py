"""
capture_dataset.py — Webcam Dataset Collector for Appliance Classifier
=======================================================================
This script helps you build a labeled training dataset using your webcam.

Controls:
  SPACE  → save current frame as a training image
  C      → clear / discard last saved image
  N      → move to the next class
  Q      → quit
  
Usage:
  python capture_dataset.py

Images are saved to:
  model/data/train/<ClassName>/img_0001.jpg ...
  model/data/val/<ClassName>/img_0001.jpg   (every 5th image goes to val)

Tips:
  - Point camera at the appliance from multiple angles
  - Vary distance, lighting, background
  - Capture 50-100 images per class minimum
  - For "Other": point at random objects, walls, your face, etc.
"""

import cv2
import os
import sys

CLASSES = ["TV", "Fan", "AC", "Light", "Plug", "Other"]

BASE_DIR    = os.path.join(os.path.dirname(__file__), "data")
TRAIN_DIR   = os.path.join(BASE_DIR, "train")
VAL_DIR     = os.path.join(BASE_DIR, "val")
VAL_EVERY   = 5       # every Nth image → val set
TARGET_SIZE = (224, 224)

INSTRUCTIONS = [
    "TV        — Point camera at a television screen",
    "Fan       — Point camera at a ceiling/table fan",
    "AC        — Point camera at an air conditioner unit",
    "Light     — Point camera at a light bulb / fixture",
    "Plug      — Point camera at a wall plug / socket",
    "Other     — Point at random things, people, walls, etc.",
]


def make_dirs(cls_name):
    for base in [TRAIN_DIR, VAL_DIR]:
        os.makedirs(os.path.join(base, cls_name), exist_ok=True)


def next_index(cls_name):
    """Find next available image index across train+val folders."""
    count = 0
    for base in [TRAIN_DIR, VAL_DIR]:
        folder = os.path.join(base, cls_name)
        if os.path.isdir(folder):
            count += len([f for f in os.listdir(folder) if f.endswith(".jpg")])
    return count + 1


def draw_hud(frame, cls_name, saved, instruction, last_msg=""):
    h, w = frame.shape[:2]
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 70), (20, 20, 30), -1)
    cv2.rectangle(overlay, (0, h - 80), (w, h), (20, 20, 30), -1)
    cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)

    # Class name
    cv2.putText(frame, f"Class: {cls_name}", (12, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.85, (160, 100, 255), 2)
    cv2.putText(frame, f"Saved: {saved}", (12, 56),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (80, 200, 120), 1)

    # Instruction
    cv2.putText(frame, instruction, (12, h - 52),
                cv2.FONT_HERSHEY_SIMPLEX, 0.52, (200, 200, 200), 1)

    # Controls
    ctrl = "[SPACE] Save   [N] Next class   [C] Undo   [Q] Quit"
    cv2.putText(frame, ctrl, (12, h - 24),
                cv2.FONT_HERSHEY_SIMPLEX, 0.46, (120, 120, 180), 1)

    # Flash message
    if last_msg:
        msg_w = cv2.getTextSize(last_msg, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0][0]
        cx = (w - msg_w) // 2
        cv2.putText(frame, last_msg, (cx, h // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 220, 120), 2)
    return frame


def capture_class(cap, cls_name, instruction):
    make_dirs(cls_name)
    saved_paths = []
    flash_msg   = ""
    flash_timer = 0

    print(f"\n{'='*50}")
    print(f"  CLASS: {cls_name}")
    print(f"  {instruction}")
    print(f"  SPACE=save  N=next  C=undo  Q=quit")
    print(f"{'='*50}")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[ERROR] Camera read failed")
            break

        display = frame.copy()
        flash_msg_show = flash_msg if flash_timer > 0 else ""
        draw_hud(display, cls_name, len(saved_paths), instruction, flash_msg_show)
        if flash_timer > 0:
            flash_timer -= 1

        cv2.imshow("Dataset Capture — Vision Smart Control", display)
        key = cv2.waitKey(1) & 0xFF

        if key == ord('q'):
            return "quit"

        elif key == ord('n'):
            return "next"

        elif key == ord(' '):
            # Determine train or val
            idx = next_index(cls_name)
            if idx % VAL_EVERY == 0:
                save_dir = os.path.join(VAL_DIR, cls_name)
            else:
                save_dir = os.path.join(TRAIN_DIR, cls_name)

            fname = os.path.join(save_dir, f"img_{idx:04d}.jpg")
            resized = cv2.resize(frame, TARGET_SIZE)
            cv2.imwrite(fname, resized, [cv2.IMWRITE_JPEG_QUALITY, 90])
            saved_paths.append(fname)

            flash_msg   = f"  Saved #{idx}!"
            flash_timer = 20
            print(f"  [+] {fname}")

        elif key == ord('c') and saved_paths:
            last = saved_paths.pop()
            if os.path.exists(last):
                os.remove(last)
            flash_msg   = "  Deleted last!"
            flash_timer = 20
            print(f"  [-] Deleted {last}")


def main():
    print("\n" + "="*55)
    print("  VISION SMART CONTROL — Dataset Capture Tool")
    print("="*55)
    print("\nThis will capture images for each appliance class.")
    print("You'll cycle through these classes:")
    for i, (cls, tip) in enumerate(zip(CLASSES, INSTRUCTIONS)):
        print(f"  {i+1}. {tip}")
    print("\nPress ENTER when ready or Q to skip a class.\n")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] Could not open webcam.")
        sys.exit(1)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    for cls_name, instruction in zip(CLASSES, INSTRUCTIONS):
        result = capture_class(cap, cls_name, instruction)
        if result == "quit":
            break

    cap.release()
    cv2.destroyAllWindows()

    # Summary
    print("\n" + "="*45)
    print("  Dataset Summary")
    print("="*45)
    total = 0
    for cls in CLASSES:
        t = len(os.listdir(os.path.join(TRAIN_DIR, cls))) if os.path.isdir(os.path.join(TRAIN_DIR, cls)) else 0
        v = len(os.listdir(os.path.join(VAL_DIR,   cls))) if os.path.isdir(os.path.join(VAL_DIR,   cls)) else 0
        total += t + v
        print(f"  {cls:<8} train={t:3d}  val={v:2d}")
    print(f"  {'TOTAL':<8} {total} images")
    print("\nNext step:")
    print("  python train.py --data_dir ./data --epochs 30")


if __name__ == "__main__":
    main()
