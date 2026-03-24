"""
collect_real_images.py — Download REAL Appliance Images from Internet
======================================================================
Uses bing-image-downloader to collect actual appliance photos
"""

import os
import shutil
from pathlib import Path

try:
    from bing_image_downloader import downloader
except ImportError:
    print("Installing bing-image-downloader...")
    os.system("pip install bing-image-downloader --quiet")
    from bing_image_downloader import downloader

BASE_DIR = os.path.join(os.path.dirname(__file__), "data")
TRAIN_DIR = os.path.join(BASE_DIR, "train")
VAL_DIR = os.path.join(BASE_DIR, "val")

# Search queries for real appliance images
SEARCH_QUERIES = {
    "TV": [
        "television screen",
        "flat screen TV",
        "TV set",
        "LCD television",
        "smart TV"
    ],
    "Fan": [
        "electric fan",
        "ceiling fan",
        "table fan",
        "pedestal fan",
        "desk fan"
    ],
    "AC": [
        "air conditioner unit",
        "AC wall mounted",
        "split AC",
        "window air conditioner",
        "indoor AC unit"
    ],
    "Light": [
        "light bulb",
        "tube light",
        "LED light",
        "incandescent bulb",
        "fluorescent light"
    ],
    "Plug": [
        "electrical outlet socket",
        "power socket",
        "wall plug",
        "electrical plug outlet",
        "USB charging socket"
    ],
    "Other": [
        "microwave oven",
        "washing machine",
        "refrigerator",
        "electric kettle",
        "coffee maker"
    ]
}

def download_images_for_class(class_name, queries, num_images=80):
    """Download real images for a class"""
    print(f"\n{'='*60}")
    print(f"Downloading: {class_name}")
    print(f"{'='*60}")
    
    train_path = os.path.join(TRAIN_DIR, class_name)
    val_path = os.path.join(VAL_DIR, class_name)
    temp_path = os.path.join(BASE_DIR, f"temp_{class_name}")
    
    os.makedirs(train_path, exist_ok=True)
    os.makedirs(val_path, exist_ok=True)
    
    current_train = len([f for f in os.listdir(train_path) if f.lower().endswith(('.jpg', '.png', '.jpeg'))])
    
    if current_train >= num_images:
        print(f"✓ {class_name} already has {current_train} images")
        return current_train
    
    target_count = num_images - current_train
    
    # Try downloading from each query
    total_downloaded = current_train
    
    for idx, query in enumerate(queries):
        if total_downloaded >= num_images:
            break
            
        print(f"\n  Query {idx+1}/{len(queries)}: '{query}'")
        
        try:
            # Clean temp directory
            if os.path.exists(temp_path):
                shutil.rmtree(temp_path)
            
            # Download images
            downloader.download(
                query,
                limit=20,
                output_dir=BASE_DIR,
                adult_filter_off=True,
                force_replace=False,
                timeout=20,
                verbose=False
            )
            
            # Move downloaded images to train folder
            temp_query_path = os.path.join(BASE_DIR, query)
            if os.path.exists(temp_query_path):
                for img_file in os.listdir(temp_query_path):
                    if img_file.lower().endswith(('.jpg', '.png', '.jpeg')):
                        src = os.path.join(temp_query_path, img_file)
                        idx_num = total_downloaded - current_train + 1
                        
                        # Distribute: 85% train, 15% val
                        if idx_num % 7 == 0:  # ~14% to val
                            dest = os.path.join(val_path, f"val_{(total_downloaded - current_train):04d}.jpg")
                        else:
                            dest = os.path.join(train_path, f"img_{total_downloaded - current_train + 1:04d}.jpg")
                        
                        try:
                            shutil.copy(src, dest)
                            total_downloaded += 1
                            if total_downloaded % 10 == 0:
                                print(f"    ✓ Downloaded {total_downloaded - current_train} images")
                        except:
                            pass
                        
                        if total_downloaded >= num_images:
                            break
                
                shutil.rmtree(temp_query_path, ignore_errors=True)
        
        except Exception as e:
            print(f"    Note: {str(e)[:50]}...")
    
    # Cleanup
    if os.path.exists(temp_path):
        shutil.rmtree(temp_path, ignore_errors=True)
    
    final_train = len([f for f in os.listdir(train_path) if f.lower().endswith(('.jpg', '.png', '.jpeg'))])
    final_val = len([f for f in os.listdir(val_path) if f.lower().endswith(('.jpg', '.png', '.jpeg'))])
    
    print(f"\n✓ {class_name}: train={final_train}, val={final_val}")
    return final_train

def main():
    print("\n" + "="*60)
    print("  REAL APPLIANCE IMAGE COLLECTOR")
    print("="*60)
    print("\nDownloading real images from Internet...")
    print("Classes:")
    print("  • TV: Television screens")
    print("  • Fan: Electric fans")
    print("  • AC: Air conditioning units")
    print("  • Light: Light bulbs & tubes")
    print("  • Plug: Electrical outlets")
    print("  • Other: Other appliances\n")
    
    total_train = 0
    
    for class_name in ["TV", "Fan", "AC", "Light", "Plug", "Other"]:
        if class_name in SEARCH_QUERIES:
            queries = SEARCH_QUERIES[class_name]
            count = download_images_for_class(class_name, queries, num_images=80)
            total_train += count
    
    print("\n" + "="*60)
    print("  FINAL DATASET STATUS")
    print("="*60)
    
    all_train = 0
    all_val = 0
    for class_name in ["TV", "Fan", "AC", "Light", "Plug", "Other"]:
        train_path = os.path.join(TRAIN_DIR, class_name)
        val_path = os.path.join(VAL_DIR, class_name)
        train_count = len([f for f in os.listdir(train_path) if f.lower().endswith(('.jpg', '.png', '.jpeg'))])
        val_count = len([f for f in os.listdir(val_path) if f.lower().endswith(('.jpg', '.png', '.jpeg'))])
        all_train += train_count
        all_val += val_count
        print(f"  {class_name:8} → train: {train_count:3}  val: {val_count:3}")
    
    print("-" * 60)
    print(f"  TOTAL       → train: {all_train:3}  val: {all_val:3}")
    print("="*60)
    print("\n✓ Ready to train! Run:")
    print("  python train.py --data_dir ./data --epochs 30 --num_workers 0")

if __name__ == "__main__":
    main()
