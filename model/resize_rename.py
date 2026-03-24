"""
resize_rename_images.py — Resize and rename all images in dataset
"""

import os
import cv2
from pathlib import Path

BASE_DIR = os.path.join(os.path.dirname(__file__), "data")
TRAIN_DIR = os.path.join(BASE_DIR, "train")
VAL_DIR = os.path.join(BASE_DIR, "val")

CLASSES = ["TV", "Fan", "AC", "Light", "Plug", "Other"]
TARGET_SIZE = (224, 224)

def resize_rename_class(class_name, folder_type="train"):
    """Resize and rename all images in a class folder"""
    if folder_type == "train":
        class_path = os.path.join(TRAIN_DIR, class_name)
    else:
        class_path = os.path.join(VAL_DIR, class_name)
    
    if not os.path.exists(class_path):
        print(f"✗ {class_name}: folder not found")
        return 0
    
    files = os.listdir(class_path)
    image_files = [f for f in files if f.lower().endswith(('.jpg', '.png', '.jpeg'))]
    
    if not image_files:
        print(f"✗ {class_name}: no images found")
        return 0
    
    processed = 0
    for idx, filename in enumerate(image_files, 1):
        try:
            filepath = os.path.join(class_path, filename)
            
            # Read image
            img = cv2.imread(filepath)
            if img is None:
                print(f"  ✗ {filename}: could not read")
                continue
            
            # Resize to 224x224
            img_resized = cv2.resize(img, TARGET_SIZE, interpolation=cv2.INTER_LANCZOS4)
            
            # New filename
            if folder_type == "train":
                new_name = f"img_{idx:04d}.jpg"
            else:
                new_name = f"val_{idx:04d}.jpg"
            
            new_filepath = os.path.join(class_path, new_name)
            
            # Save resized image
            cv2.imwrite(new_filepath, img_resized, [cv2.IMWRITE_JPEG_QUALITY, 95])
            
            # Delete old file if name changed
            if new_filepath != filepath:
                try:
                    os.remove(filepath)
                except:
                    pass
            
            processed += 1
            
        except Exception as e:
            print(f"  ✗ Error: {str(e)[:40]}")
    
    return processed

def main():
    print("\n" + "="*60)
    print("  RESIZE & RENAME ALL IMAGES")
    print("="*60 + "\n")
    
    print("TRAINING IMAGES:")
    for class_name in CLASSES:
        count = resize_rename_class(class_name, "train")
        print(f"  {class_name:8} → {count:3} images resized")
    
    print("\nVALIDATION IMAGES:")
    val_total = 0
    for class_name in CLASSES:
        count = resize_rename_class(class_name, "val")
        val_total += count
        if count > 0:
            print(f"  {class_name:8} → {count:3} images resized")
    
    print("\n" + "="*60)
    print("  FINAL DATASET")
    print("="*60)
    
    train_total = 0
    val_total = 0
    for class_name in CLASSES:
        train_path = os.path.join(TRAIN_DIR, class_name)
        val_path = os.path.join(VAL_DIR, class_name)
        
        train_count = len([f for f in os.listdir(train_path) if f.lower().endswith(('.jpg', '.png'))])
        val_count = len([f for f in os.listdir(val_path) if f.lower().endswith(('.jpg', '.png'))])
        
        train_total += train_count
        val_total += val_count
        print(f"  {class_name:8} → train: {train_count:3}  val: {val_count:3}")
    
    print("-" * 60)
    print(f"  TOTAL       → train: {train_total:3}  val: {val_total:3}")
    print("="*60)
    print("\n✓ Ready to train! Run:")
    print("  python train.py --data_dir ./data --epochs 25 --batch_size 16")

if __name__ == "__main__":
    main()
