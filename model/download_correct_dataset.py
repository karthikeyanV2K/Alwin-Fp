"""
download_correct_dataset.py — Download CORRECT Appliance Images
=================================================================
Downloads real images for:
  - AC: air conditioning units
  - Light: light bulbs and tube lights  
  - Plug: power outlets, charging sockets, buttons
  - Other: other appliances (fan, microwave, etc)
  - TV: televisions (already downloaded)
  - Fan: fans (already downloaded)
"""

import os
import requests
from PIL import Image
from io import BytesIO
import time

# Define search queries for each class
SEARCH_QUERIES = {
    "AC": [
        "air conditioner unit",
        "AC wall mounted",
        "air conditioning window unit",
        "split AC indoor unit",
        "central air conditioning"
    ],
    "Light": [
        "LED light bulb",
        "incandescent light bulb",
        "tube light fluorescent",
        "light fixture bulb",
        "ceiling light bulb"
    ],
    "Plug": [
        "electrical wall outlet socket",
        "power outlet plug",
        "electrical socket",
        "USB charging socket",
        "power outlet button switch"
    ],
    "Other": [
        "microwave oven",
        "washing machine",
        "refrigerator",
        "coffee maker",
        "electric kettle",
        "laptop charger",
        "phone charger"
    ]
}

BASE_DIR = os.path.join(os.path.dirname(__file__), "data")
TRAIN_DIR = os.path.join(BASE_DIR, "train")
VAL_DIR = os.path.join(BASE_DIR, "val")

# Image URLs (from Unsplash, Pixabay - free to use)
IMAGE_SOURCES = {
    "AC": [
        "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400",
        "https://images.unsplash.com/photo-1545259741-2ea3ebf61fa3?w=400",
        "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400",
        "https://images.unsplash.com/photo-1545259741-2ea3ebf61fa3?w=400",
    ],
    "Light": [
        "https://images.unsplash.com/photo-1565636192335-14c46fa1120d?w=400",
        "https://images.unsplash.com/photo-1515694426838-3fee46e4cbcd?w=400",
        "https://images.unsplash.com/photo-1578143213541-e48004ca16d0?w=400",
        "https://images.unsplash.com/photo-1590746882981-c1e200a9f845?w=400",
    ],
    "Plug": [
        "https://images.unsplash.com/photo-1589876948302-ed6e6f32d4c3?w=400",
        "https://images.unsplash.com/photo-1589876948302-ed6e6f32d4c3?w=400",
        "https://images.unsplash.com/photo-1589876948302-ed6e6f32d4c3?w=400",
        "https://images.unsplash.com/photo-1589876948302-ed6e6f32d4c3?w=400",
    ],
    "Other": [
        "https://images.unsplash.com/photo-1585518419759-4cb1d5b52f1d?w=400",
        "https://images.unsplash.com/photo-1626919260228-c9f0b6c61742?w=400",
        "https://images.unsplash.com/photo-1584622614875-2953ed5f8b06?w=400",
        "https://images.unsplash.com/photo-1584622614875-2953ed5f8b06?w=400",
    ]
}

def download_image(url, timeout=10):
    """Download image from URL"""
    try:
        response = requests.get(url, timeout=timeout)
        if response.status_code == 200:
            return Image.open(BytesIO(response.content))
    except Exception as e:
        print(f"  ✗ Error: {e}")
    return None

def download_class_images(class_name, urls, num_train=50, num_val=10):
    """Download images for a specific class"""
    print(f"\n{'='*60}")
    print(f"CLASS: {class_name}")
    print(f"{'='*60}")
    
    # Create directories
    for base_dir in [TRAIN_DIR, VAL_DIR]:
        os.makedirs(os.path.join(base_dir, class_name), exist_ok=True)
    
    train_path = os.path.join(TRAIN_DIR, class_name)
    val_path = os.path.join(VAL_DIR, class_name)
    
    train_count = len(os.listdir(train_path))
    val_count = len(os.listdir(val_path))
    
    print(f"Current: train={train_count}, val={val_count}")
    print(f"Target:  train={num_train}, val={num_val}")
    
    # Download training images
    attempt = 0
    url_idx = 0
    while train_count < num_train and attempt < 100:
        try:
            url = urls[url_idx % len(urls)]
            # Add variation to URL
            varied_url = url + f"&t={attempt}"
            
            print(f"  [{train_count+1}/{num_train}] Downloading from {url.split('?')[0][:40]}...", end=" ")
            img = download_image(varied_url)
            
            if img:
                img = img.convert('RGB')
                img = img.resize((224, 224))
                save_path = os.path.join(train_path, f"img_{train_count+1:04d}.jpg")
                img.save(save_path, quality=90)
                print("✓")
                train_count += 1
                time.sleep(0.5)
            else:
                print("✗")
            
            url_idx += 1
            attempt += 1
        except Exception as e:
            print(f"Error: {e}")
            attempt += 1
    
    # Download validation images
    attempt = 0
    url_idx = 0
    while val_count < num_val and attempt < 50:
        try:
            url = urls[url_idx % len(urls)]
            varied_url = url + f"&v={attempt}"
            
            print(f"  VAL [{val_count+1}/{num_val}] Downloading...", end=" ")
            img = download_image(varied_url)
            
            if img:
                img = img.convert('RGB')
                img = img.resize((224, 224))
                save_path = os.path.join(val_path, f"val_{val_count+1:04d}.jpg")
                img.save(save_path, quality=90)
                print("✓")
                val_count += 1
                time.sleep(0.5)
            else:
                print("✗")
                
            url_idx += 1
            attempt += 1
        except Exception as e:
            print(f"Error: {e}")
            attempt += 1
    
    print(f"✓ {class_name}: train={train_count}, val={val_count}")
    return train_count, val_count

def main():
    print("\n" + "="*60)
    print("  CORRECT APPLIANCE DATASET DOWNLOADER")
    print("="*60)
    print("\nDownloading correct images:")
    print("  • AC: Air Conditioning units")
    print("  • Light: Light bulbs & tube lights")
    print("  • Plug: Power outlets & sockets")
    print("  • Other: Other appliances\n")
    
    total_train = 0
    total_val = 0
    
    # Download each class
    for class_name in ["AC", "Light", "Plug", "Other"]:
        if class_name in IMAGE_SOURCES:
            urls = IMAGE_SOURCES[class_name]
            train_c, val_c = download_class_images(class_name, urls, num_train=50, num_val=10)
            total_train += train_c
            total_val += val_c
    
    print("\n" + "="*60)
    print("  DATASET SUMMARY")
    print("="*60)
    print(f"Training images: {total_train}")
    print(f"Validation images: {total_val}")
    print(f"TOTAL: {total_train + total_val}")
    print("\n✓ Ready to train! Run:")
    print("  python train.py --data_dir ./data --epochs 30")

if __name__ == "__main__":
    main()
