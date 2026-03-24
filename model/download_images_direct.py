"""
download_images_direct.py — Direct URL Image Downloader
========================================================
Downloads images from reliable free image sources
"""

import os
import requests
from PIL import Image
from io import BytesIO
import time

BASE_DIR = os.path.join(os.path.dirname(__file__), "data")
TRAIN_DIR = os.path.join(BASE_DIR, "train")
VAL_DIR = os.path.join(BASE_DIR, "val")

# Real image URLs from Unsplash, Pixabay (free stock photos)
REAL_IMAGE_URLS = {
    "TV": [
        "https://images.unsplash.com/photo-1593642532400-2682a8a0fda7?w=400&h=400",
        "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400&h=400",
        "https://images.unsplash.com/photo-1633356122544-f134324ef6db?w=400&h=400",
        "https://images.unsplash.com/photo-1612198188060-c7b2fdd82a8b?w=400&h=400",
        "https://images.unsplash.com/photo-1606998248179-c52b31e06c43?w=400&h=400",
        "https://images.unsplash.com/photo-1624226505372-4a50b4e87fb1?w=400&h=400",
        "https://images.unsplash.com/photo-1553657671-d583d0d87c8f?w=400&h=400",
        "https://images.unsplash.com/photo-1516251193007-0e4b340bb62e?w=400&h=400",
    ],
    "Fan": [
        "https://images.unsplash.com/photo-1545259741-2ea3ebf61fa3?w=400&h=400",
        "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&h=400",
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400",
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400",
        "https://images.unsplash.com/photo-1584622614875-2953ed5f8b06?w=400&h=400",
        "https://images.unsplash.com/photo-1626919260228-c9f0b6c61742?w=400&h=400",
    ],
    "AC": [
        "https://images.unsplash.com/photo-1585518419759-4cb1d5b52f1d?w=400&h=400",
        "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&h=400",
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400",
        "https://images.unsplash.com/photo-1544066531-a7f7ff52b4eb?w=400&h=400",
    ],
    "Light": [
        "https://images.unsplash.com/photo-1565636192335-14c46fa1120d?w=400&h=400",
        "https://images.unsplash.com/photo-1515694426838-3fee46e4cbcd?w=400&h=400",
        "https://images.unsplash.com/photo-1578143213541-e48004ca16d0?w=400&h=400",
        "https://images.unsplash.com/photo-1590746882981-c1e200a9f845?w=400&h=400",
        "https://images.unsplash.com/photo-1551830820-330a71b99659?w=400&h=400",
    ],
    "Plug": [
        "https://images.unsplash.com/photo-1589876948302-ed6e6f32d4c3?w=400&h=400",
        "https://images.unsplash.com/photo-1581092918056-0c4c3004cd00?w=400&h=400",
        "https://images.unsplash.com/photo-1590746736338-94b617ebd690?w=400&h=400",
        "https://images.unsplash.com/photo-1607798303019-b2b6c6ee986b?w=400&h=400",
    ],
    "Other": [
        "https://images.unsplash.com/photo-1585518419759-4cb1d5b52f1d?w=400&h=400",
        "https://images.unsplash.com/photo-1611532736000-c4b9e71c64d1?w=400&h=400",
        "https://images.unsplash.com/photo-1584622614875-2953ed5f8b06?w=400&h=400",
        "https://images.unsplash.com/photo-1626919260228-c9f0b6c61742?w=400&h=400",
        "https://images.unsplash.com/photo-1578143213541-e48004ca16d0?w=400&h=400",
    ]
}

def download_image(url, timeout=10):
    """Download single image from URL"""
    try:
        response = requests.get(url, timeout=timeout, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0'
        })
        if response.status_code == 200:
            img = Image.open(BytesIO(response.content))
            return img
    except Exception as e:
        print(f"      ✗ {str(e)[:40]}")
    return None

def download_class(class_name, urls, target_images=60):
    """Download images for one class"""
    print(f"\n{'='*60}")
    print(f"Downloading: {class_name}")
    print(f"{'='*60}")
    
    train_path = os.path.join(TRAIN_DIR, class_name)
    val_path = os.path.join(VAL_DIR, class_name)
    
    os.makedirs(train_path, exist_ok=True)
    os.makedirs(val_path, exist_ok=True)
    
    current_train = len([f for f in os.listdir(train_path) if f.endswith(('.jpg', '.png'))])
    current_val = len([f for f in os.listdir(val_path) if f.endswith(('.jpg', '.png'))])
    
    if current_train >= target_images:
        print(f"✓ Already has {current_train} training images")
        return
    
    print(f"Current: train={current_train}, val={current_val}")
    print(f"Target:  train={target_images}, val={target_images//5}\n")
    
    downloaded = current_train
    url_idx = 0
    
    # Download training images
    while downloaded < target_images and url_idx < len(urls) * 3:
        try:
            url = urls[url_idx % len(urls)]
            varied_url = url + f"&seed={url_idx}" if "?" in url else url + f"?seed={url_idx}"
            
            print(f"  [{downloaded - current_train + 1:3d}/{target_images - current_train:3d}] ", end="")
            img = download_image(varied_url, timeout=8)
            
            if img:
                img = img.convert('RGB')
                img = img.resize((224, 224), Image.Resampling.LANCZOS)
                
                # Save to train or val
                if (downloaded - current_train) % 6 == 0:
                    save_path = os.path.join(val_path, f"val_{(downloaded - current_train)//6 + 1:04d}.jpg")
                else:
                    save_path = os.path.join(train_path, f"img_{downloaded - current_train + 1:04d}.jpg")
                
                img.save(save_path, quality=90)
                print("✓")
                downloaded += 1
                time.sleep(0.3)
            else:
                print("✗")
                time.sleep(0.5)
            
            url_idx += 1
        
        except KeyboardInterrupt:
            print("\n\n⚠ Download interrupted by user")
            break
        except Exception as e:
            print(f"✗ {str(e)[:30]}")
            url_idx += 1
            time.sleep(1)
    
    final_train = len([f for f in os.listdir(train_path) if f.endswith(('.jpg', '.png'))])
    final_val = len([f for f in os.listdir(val_path) if f.endswith(('.jpg', '.png'))])
    
    print(f"\n✓ {class_name}: train={final_train}, val={final_val}")

def main():
    print("\n" + "="*60)
    print("  REAL APPLIANCE IMAGE DOWNLOADER")
    print("="*60)
    print("\nDownloading real stock photos...")
    
    for class_name in ["TV", "Fan", "AC", "Light", "Plug", "Other"]:
        if class_name in REAL_IMAGE_URLS:
            urls = REAL_IMAGE_URLS[class_name]
            download_class(class_name, urls, target_images=50)
    
    print("\n" + "="*60)
    print("  FINAL DATASET STATUS")
    print("="*60)
    
    all_train = 0
    all_val = 0
    for class_name in ["TV", "Fan", "AC", "Light", "Plug", "Other"]:
        train_path = os.path.join(TRAIN_DIR, class_name)
        val_path = os.path.join(VAL_DIR, class_name)
        train_count = len([f for f in os.listdir(train_path) if f.endswith(('.jpg', '.png'))])
        val_count = len([f for f in os.listdir(val_path) if f.endswith(('.jpg', '.png'))])
        all_train += train_count
        all_val += val_count
        print(f"  {class_name:8} → train: {train_count:3}  val: {val_count:3}")
    
    print("-" * 60)
    print(f"  TOTAL       → train: {all_train:3}  val: {all_val:3}")
    print("="*60)
    
    if all_train > 0:
        print("\n✓ Dataset ready! Next steps:")
        print("  cd X:\\Alwin-Fp\\model")
        print("  python train.py --data_dir ./data --epochs 30 --num_workers 0")
    else:
        print("\n⚠ No images downloaded. Check internet connection.")

if __name__ == "__main__":
    main()
