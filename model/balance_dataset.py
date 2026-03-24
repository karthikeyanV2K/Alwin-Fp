"""
balance_dataset.py — Balance dataset by copying and generating images
"""

import os
import shutil
import cv2
import numpy as np
import random
from pathlib import Path

BASE_DIR = os.path.join(os.path.dirname(__file__), "data")
TRAIN_DIR = os.path.join(BASE_DIR, "train")
VAL_DIR = os.path.join(BASE_DIR, "val")

CLASSES = ["TV", "Fan", "AC", "Light", "Plug", "Other"]

def count_images(folder_path):
    """Count images in a folder"""
    if not os.path.exists(folder_path):
        return 0
    return len([f for f in os.listdir(folder_path) if f.lower().endswith(('.jpg', '.png', '.jpeg'))])

def duplicate_images(class_name, target_count=80):
    """Duplicate existing images to reach target count"""
    train_path = os.path.join(TRAIN_DIR, class_name)
    os.makedirs(train_path, exist_ok=True)
    
    current = count_images(train_path)
    if current >= target_count:
        print(f"✓ {class_name}: already has {current} images")
        return current
    
    existing = [f for f in os.listdir(train_path) if f.lower().endswith(('.jpg', '.png', '.jpeg'))]
    if not existing:
        return 0
    
    idx = current
    while idx < target_count:
        for img in existing:
            if idx >= target_count:
                break
            try:
                src = os.path.join(train_path, img)
                dst = os.path.join(train_path, f"dup_{idx+1:04d}.jpg")
                shutil.copy(src, dst)
                idx += 1
            except:
                pass
    
    final = count_images(train_path)
    return final

def gen_light_image():
    """Minimal light bulb image"""
    img = np.ones((224, 224, 3), dtype=np.uint8) * 245
    cv2.circle(img, (112, 80), 30, (255, 240, 100), -1)
    cv2.circle(img, (112, 80), 30, (200, 100, 0), 2)
    cv2.circle(img, (112, 80), 12, (255, 255, 200), -1)
    cv2.rectangle(img, (100, 110), (124, 140), (50, 50, 50), -1)
    return img

def gen_plug_image():
    """Minimal plug/outlet image"""
    img = np.ones((224, 224, 3), dtype=np.uint8) * 245
    cv2.rectangle(img, (70, 60), (154, 144), (240, 240, 240), -1)
    cv2.rectangle(img, (70, 60), (154, 144), (150, 150, 150), 2)
    cv2.rectangle(img, (85, 85), (100, 105), (50, 50, 50), -1)
    cv2.rectangle(img, (124, 85), (139, 105), (50, 50, 50), -1)
    cv2.circle(img, (112, 118), 4, (50, 50, 50), -1)
    return img

def gen_other_image():
    """Minimal other appliance image"""
    img = np.ones((224, 224, 3), dtype=np.uint8) * 200
    obj = random.randint(0, 2)
    if obj == 0:
        cv2.rectangle(img, (40, 40), (184, 160), (100, 100, 100), -1)
        cv2.rectangle(img, (50, 50), (174, 150), (200, 200, 200), 2)
    elif obj == 1:
        cv2.rectangle(img, (50, 40), (174, 180), (150, 150, 150), -1)
        cv2.circle(img, (112, 100), 40, (200, 200, 200), -1)
    else:
        cv2.rectangle(img, (60, 40), (164, 160), (200, 100, 50), -1)
        cv2.rectangle(img, (70, 50), (105, 120), (50, 50, 50), -1)
    return img

def generate_images(class_name, gen_fn, target_count=80):
    """Generate images for a class"""
    train_path = os.path.join(TRAIN_DIR, class_name)
    os.makedirs(train_path, exist_ok=True)
    
    current = count_images(train_path)
    if current >= target_count:
        return current
    
    for i in range(current, target_count):
        img = gen_fn()
        if random.random() > 0.5:
            brightness = random.uniform(0.85, 1.1)
            img = cv2.convertScaleAbs(img, alpha=brightness, beta=0)
        path = os.path.join(train_path, f"gen_{i+1:04d}.jpg")
        cv2.imwrite(path, img)
    
    return count_images(train_path)

def main():
    print("\n" + "="*60)
    print("  DATASET BALANCER")
    print("="*60 + "\n")
    
    # Duplicate existing
    for cls in ["TV", "Fan", "AC"]:
        duplic = duplicate_images(cls, target_count=80)
        print(f"✓ {cls}: {duplic} images")
    
    # Generate missing  
    print(f"✓ Light: {generate_images('Light', gen_light_image, 80)} images")
    print(f"✓ Plug: {generate_images('Plug', gen_plug_image, 80)} images")
    print(f"✓ Other: {generate_images('Other', gen_other_image, 80)} images")
    
    print("\n" + "="*60)
    print("  FINAL STATUS")
    print("="*60)
    
    for class_name in CLASSES:
        train_path = os.path.join(TRAIN_DIR, class_name)
        train_count = count_images(train_path)
        print(f"  {class_name:8} → {train_count:3} images")
    
    total = sum(count_images(os.path.join(TRAIN_DIR, c)) for c in CLASSES)
    print("-" * 60)
    print(f"  TOTAL       → {total} images")
    print("="*60)
    print("\n✓ Ready to train! Run:")
    print("  python train.py --data_dir ./data --epochs 20 --batch_size 16")

if __name__ == "__main__":
    main()
