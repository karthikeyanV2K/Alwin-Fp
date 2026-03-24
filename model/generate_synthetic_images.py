"""
generate_synthetic_images.py — Generate Balanced Training Images
=================================================================
Creates realistic synthetic training images to balance the dataset:
  - AC: Blue/silver boxes with grilles
  - Light: Round/tube shapes with bright centers
  - Plug: White rectangles with holes/buttons
  - Other: Various household objects
"""

import cv2
import numpy as np
import os
import random

BASE_DIR = os.path.join(os.path.dirname(__file__), "data")
TRAIN_DIR = os.path.join(BASE_DIR, "train")
VAL_DIR = os.path.join(BASE_DIR, "val")

def generate_ac_image():
    """Generate realistic AC unit image"""
    img = np.ones((224, 224, 3), dtype=np.uint8) * 240  # Light background
    
    # Main body - metallic silver/blue
    cv2.rectangle(img, (40, 50), (184, 180), (180, 180, 200), -1)
    cv2.rectangle(img, (40, 50), (184, 180), (100, 100, 120), 2)
    
    # Grille pattern
    for i in range(5):
        y = 70 + i * 20
        cv2.line(img, (50, y), (174, y), (120, 120, 140), 1)
    for i in range(7):
        x = 50 + i * 18
        cv2.line(img, (x, 70), (x, 160), (120, 120, 140), 1)
    
    # Display/buttons
    cv2.rectangle(img, (60, 190), (164, 210), (50, 50, 50), -1)
    cv2.circle(img, (90, 200), 5, (0, 255, 0), -1)
    
    return img

def generate_light_image():
    """Generate realistic light bulb/tube image"""
    img = np.ones((224, 224, 3), dtype=np.uint8) * 200  # Gray background
    
    # Bulb shape
    cv2.circle(img, (112, 80), 35, (255, 240, 100), -1)
    cv2.circle(img, (112, 80), 35, (200, 100, 0), 2)
    
    # Filament glow
    cv2.circle(img, (112, 80), 15, (255, 255, 255), -1)
    cv2.circle(img, (112, 80), 10, (255, 250, 0), -1)
    
    # Base
    cv2.rectangle(img, (100, 115), (124, 140), (50, 50, 50), -1)
    cv2.rectangle(img, (95, 138), (129, 145), (100, 100, 100), -1)
    
    # Reflection
    cv2.circle(img, (100, 65), 8, (255, 255, 200), -1)
    
    return img

def generate_plug_image():
    """Generate realistic electrical plug/outlet image"""
    img = np.ones((224, 224, 3), dtype=np.uint8) * 245  # Off-white wall
    
    # Outlet plate
    cv2.rectangle(img, (70, 60), (154, 144), (240, 240, 240), -1)
    cv2.rectangle(img, (70, 60), (154, 144), (150, 150, 150), 2)
    
    # Left slot
    cv2.rectangle(img, (85, 85), (100, 105), (50, 50, 50), -1)
    cv2.line(img, (92, 85), (92, 105), (255, 255, 255), 1)
    
    # Right slot
    cv2.rectangle(img, (124, 85), (139, 105), (50, 50, 50), -1)
    cv2.line(img, (131, 85), (131, 105), (255, 255, 255), 1)
    
    # Ground hole
    cv2.circle(img, (112, 118), 4, (50, 50, 50), -1)
    
    # Switch/button area
    cv2.circle(img, (112, 170), 8, (200, 100, 100), -1)
    cv2.circle(img, (112, 170), 4, (255, 100, 100), -1)
    
    return img

def generate_other_image():
    """Generate random household appliance images"""
    img = np.ones((224, 224, 3), dtype=np.uint8) * 220
    
    # Random different objects
    obj_type = random.randint(0, 3)
    
    if obj_type == 0:  # Microwave
        cv2.rectangle(img, (40, 40), (184, 160), (100, 100, 100), -1)
        cv2.rectangle(img, (50, 50), (174, 150), (200, 200, 200), 2)
        cv2.rectangle(img, (60, 60), (164, 140), (100, 100, 100), -1)
        for i in range(2):
            for j in range(3):
                cv2.circle(img, (80+35*j, 165+25*i), 5, (255, 255, 0), -1)
    
    elif obj_type == 1:  # Washing machine
        cv2.rectangle(img, (50, 40), (174, 180), (150, 150, 150), -1)
        cv2.circle(img, (112, 100), 40, (200, 200, 200), -1)
        cv2.circle(img, (112, 100), 35, (150, 150, 150), 2)
        for angle in range(0, 360, 45):
            rad = np.radians(angle)
            x = int(112 + 25 * np.cos(rad))
            y = int(100 + 25 * np.sin(rad))
            cv2.circle(img, (x, y), 3, (100, 100, 100), -1)
    
    elif obj_type == 2:  # Toaster
        cv2.rectangle(img, (60, 40), (164, 160), (200, 100, 50), -1)
        cv2.rectangle(img, (70, 50), (154, 120), (50, 50, 50), -1)
        cv2.rectangle(img, (75, 55), (105, 115), (200, 100, 50), 1)
        cv2.rectangle(img, (119, 55), (149, 115), (200, 100, 50), 1)
    
    else:  # Coffee maker
        cv2.rectangle(img, (70, 50), (154, 150), (0, 0, 0), -1)
        cv2.rectangle(img, (75, 55), (149, 145), (100, 100, 100), 2)
        cv2.circle(img, (112, 80), 15, (150, 150, 150), -1)
    
    return img

def generate_class_images(class_name, generator_fn, num_train=60, num_val=15):
    """Generate synthetic images for a class"""
    print(f"\n{'='*50}")
    print(f"Generating: {class_name}")
    print(f"{'='*50}")
    
    train_path = os.path.join(TRAIN_DIR, class_name)
    val_path = os.path.join(VAL_DIR, class_name)
    os.makedirs(train_path, exist_ok=True)
    os.makedirs(val_path, exist_ok=True)
    
    current_train = len([f for f in os.listdir(train_path) if f.endswith(('.jpg', '.png'))])
    current_val = len([f for f in os.listdir(val_path) if f.endswith(('.jpg', '.png'))])
    
    # Generate training images
    for i in range(current_train, num_train):
        img = generator_fn()
        
        # Add slight variations
        if random.random() > 0.5:
            img = cv2.GaussianBlur(img, (3, 3), 0)
        if random.random() > 0.7:
            img = cv2.flip(img, 1)
        
        brightness = random.uniform(0.8, 1.2)
        img = cv2.convertScaleAbs(img, alpha=brightness, beta=0)
        img = np.clip(img, 0, 255).astype(np.uint8)
        
        save_path = os.path.join(train_path, f"img_{i+1:04d}.jpg")
        cv2.imwrite(save_path, img)
        if (i + 1) % 10 == 0:
            print(f"  Train: {i+1}/{num_train}")
    
    # Generate validation images
    for i in range(current_val, num_val):
        img = generator_fn()
        brightness = random.uniform(0.9, 1.1)
        img = cv2.convertScaleAbs(img, alpha=brightness, beta=0)
        img = np.clip(img, 0, 255).astype(np.uint8)
        
        save_path = os.path.join(val_path, f"val_{i+1:04d}.jpg")
        cv2.imwrite(save_path, img)
    
    print(f"✓ {class_name}: train={num_train}, val={num_val}")
    return num_train, num_val

def main():
    print("\n" + "="*60)
    print("  SYNTHETIC IMAGE GENERATOR")
    print("="*60)
    print("\nGenerating balanced dataset...\n")
    
    total_train = 0
    total_val = 0
    
    # Generate each class
    generators = {
        "AC": (generate_ac_image, 60),
        "Light": (generate_light_image, 60),
        "Plug": (generate_plug_image, 60),
        "Other": (generate_other_image, 60),
    }
    
    for class_name, (gen_fn, num_images) in generators.items():
        train_c, val_c = generate_class_images(class_name, gen_fn, num_train=num_images, num_val=15)
        total_train += train_c
        total_val += val_c
    
    print("\n" + "="*60)
    print("  DATASET STATUS")
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
    print("\n✓ Ready to train! Run:")
    print("  python train.py --data_dir ./data --epochs 30")

if __name__ == "__main__":
    main()
