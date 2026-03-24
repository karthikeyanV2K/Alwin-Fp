"""
download_dataset.py — Automated Appliance Image Downloader
===========================================================
Downloads training images for each appliance class using Bing image search
(via icrawler — no API key required).

Usage:
    python download_dataset.py

Images → model/data/train/<Class>/ and model/data/val/<Class>/
Split  → 80% train, 20% val (automatic)
"""
import os
import shutil
import random
import sys
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
IMAGES_PER_CLASS = 120          # total to download per class
VAL_RATIO        = 0.20         # 20% goes to val
DOWNLOAD_TMP     = Path(__file__).parent / "data" / "_tmp_download"
TRAIN_DIR        = Path(__file__).parent / "data" / "train"
VAL_DIR          = Path(__file__).parent / "data" / "val"

# Search queries for each class (multiple queries → more variety)
CLASS_QUERIES = {
    "TV": [
        "television screen in living room",
        "smart TV wall mounted",
        "flat screen TV closeup",
        "LED television turned on",
    ],
    "Fan": [
        "ceiling fan in room",
        "table fan electric",
        "pedestal fan home appliance",
        "electric fan spinning",
    ],
    "AC": [
        "air conditioner indoor unit wall",
        "split AC unit room",
        "window air conditioner",
        "AC unit cooling system",
    ],
    "Light": [
        "light bulb glowing ceiling",
        "LED bulb light fixture",
        "room ceiling light on",
        "electric light lamp home",
    ],
    "Plug": [
        "electric wall plug socket",
        "power outlet socket wall",
        "extension cord plug",
        "electrical socket close up",
    ],
    "Other": [
        "empty room wall background",
        "random objects on table",
        "person face portrait",
        "bookshelf home interior",
        "car steering wheel",
        "kitchen countertop",
    ],
}


def install_icrawler():
    """Auto-install icrawler if not available."""
    try:
        import icrawler
    except ImportError:
        print("[Setup] Installing icrawler...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install",
                               "icrawler", "--quiet"])
    # Also ensure Pillow is available
    try:
        from PIL import Image
    except ImportError:
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install",
                               "Pillow", "--quiet"])


def download_class(class_name: str, queries: list, total: int):
    """Download `total` images for one class using multiple search queries."""
    from icrawler.builtin import BingImageCrawler

    tmp_dir = DOWNLOAD_TMP / class_name
    tmp_dir.mkdir(parents=True, exist_ok=True)

    per_query = max(1, total // len(queries))
    print(f"\n[{class_name}] Downloading ~{total} images via {len(queries)} queries...")

    for i, query in enumerate(queries):
        try:
            crawler = BingImageCrawler(
                storage={"root_dir": str(tmp_dir)},
                log_level=50,               # suppress all noise
                downloader_threads=2,
            )
            crawler.crawl(
                keyword=query,
                max_num=per_query,
                min_size=(100, 100),
                file_idx_offset="auto",
            )
            print(f"  ✓ Query {i+1}/{len(queries)}: '{query}'")
        except KeyboardInterrupt:
            raise
        except Exception as e:
            print(f"  [warn] Query '{query}' error: {type(e).__name__}")

    downloaded = list(tmp_dir.glob("*.jpg")) + list(tmp_dir.glob("*.png")) + list(tmp_dir.glob("*.jpeg"))
    print(f"  → Downloaded {len(downloaded)} raw images")
    return downloaded


def split_and_move(images: list, class_name: str):
    """Resize to 224×224, split 80/20, copy to train/val."""
    from PIL import Image as PILImage

    random.shuffle(images)
    n_val   = max(1, int(len(images) * VAL_RATIO))
    val_set = images[:n_val]
    trn_set = images[n_val:]

    train_cls = TRAIN_DIR / class_name
    val_cls   = VAL_DIR   / class_name
    train_cls.mkdir(parents=True, exist_ok=True)
    val_cls.mkdir(parents=True, exist_ok=True)

    saved = {"train": 0, "val": 0}

    for split_name, split_files, dest in [("train", trn_set, train_cls),
                                           ("val",   val_set, val_cls)]:
        for i, src in enumerate(split_files):
            try:
                img = PILImage.open(src).convert("RGB")
                img = img.resize((224, 224), PILImage.BILINEAR)
                dst = dest / f"img_{i+1:04d}.jpg"
                img.save(dst, "JPEG", quality=88)
                saved[split_name] += 1
            except Exception:
                pass  # skip corrupt images

    print(f"  → Saved: {saved['train']} train | {saved['val']} val")
    # Clean up tmp
    shutil.rmtree(str(DOWNLOAD_TMP / class_name), ignore_errors=True)
    return saved


def print_summary():
    print("\n" + "="*50)
    print("  Dataset Summary")
    print("="*50)
    total = 0
    for cls in CLASS_QUERIES:
        t = len(list((TRAIN_DIR / cls).glob("*.jpg"))) if (TRAIN_DIR / cls).exists() else 0
        v = len(list((VAL_DIR   / cls).glob("*.jpg"))) if (VAL_DIR   / cls).exists() else 0
        total += t + v
        bar = "█" * (t // 5)
        print(f"  {cls:<8} train={t:3d}  val={v:2d}  {bar}")
    print(f"\n  TOTAL: {total} images ready for training")
    print("="*50)


def main():
    print("\n" + "="*55)
    print("  Vision Smart Control — Automated Dataset Builder")
    print("="*55)
    print(f"  Classes : {list(CLASS_QUERIES.keys())}")
    print(f"  Target  : ~{IMAGES_PER_CLASS} images per class")
    print(f"  Split   : 80% train / 20% val")
    print(f"  Output  : {TRAIN_DIR.parent}")
    print("="*55 + "\n")

    install_icrawler()

    all_ok = True
    for class_name, queries in CLASS_QUERIES.items():
        images = download_class(class_name, queries, IMAGES_PER_CLASS)
        if images:
            split_and_move(images, class_name)
        else:
            print(f"  [!] No images downloaded for {class_name}")
            all_ok = False

    # Cleanup tmp root
    if DOWNLOAD_TMP.exists():
        shutil.rmtree(str(DOWNLOAD_TMP), ignore_errors=True)

    print_summary()

    if all_ok:
        print("\n[NEXT] Now run training:")
        print("       python train.py --data_dir ./data --epochs 30 --batch_size 16")
    else:
        print("\n[WARN] Some classes had download failures. Check network and retry.")


if __name__ == "__main__":
    main()
