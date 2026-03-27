"""
generate_tubelights.py
Generates 200 synthetic images of glowing tube lights/glares using Pillow
to force the AI model to learn that bright straight lines are 'Light'.
"""
import os
import random
from PIL import Image, ImageDraw, ImageFilter

BASE_DIR = os.path.dirname(__file__)
TRAIN_DIR = os.path.join(BASE_DIR, "data", "train", "Light")
VAL_DIR = os.path.join(BASE_DIR, "data", "val", "Light")

os.makedirs(TRAIN_DIR, exist_ok=True)
os.makedirs(VAL_DIR, exist_ok=True)

def create_synthetic_tubelight(save_path):
    size = 224
    # Random dark/grey background
    bg_color = (random.randint(10, 80), random.randint(10, 80), random.randint(10, 80))
    img = Image.new("RGB", (size, size), bg_color)
    draw = ImageDraw.Draw(img)
    
    # Tube properties
    length = random.randint(100, 200)
    thickness = random.randint(8, 20)
    
    # Angle (0 to 180)
    is_horizontal = random.random() > 0.5
    
    cx, cy = size//2 + random.randint(-40, 40), size//2 + random.randint(-40, 40)
    
    if is_horizontal:
        x0, y0 = cx - length//2, cy - thickness//2
        x1, y1 = cx + length//2, cy + thickness//2
    else:
        # verticalish
        x0, y0 = cx - thickness//2, cy - length//2
        x1, y1 = cx + thickness//2, cy + length//2
        
    # Draw glow layers (simulating intense glare)
    for i in range(5, 0, -1):
        glow = thickness + (i * 15)
        alpha = int(255 / (i * 2 + 1))
        # We simulate alpha blend by drawing directly or using blur
        
    # Draw blurred background glow
    img_blur = Image.new("RGB", (size, size), bg_color)
    draw_blur = ImageDraw.Draw(img_blur)
    draw_blur.rectangle([x0-20, y0-20, x1+20, y1+20], fill=(200, 255, 200)) # faint green/white
    img_blur = img_blur.filter(ImageFilter.GaussianBlur(30))
    
    img = Image.blend(img, img_blur, 0.5)
    
    # Draw solid white center core
    draw = ImageDraw.Draw(img)
    draw.rectangle([x0, y0, x1, y1], fill=(255, 255, 255))
    
    # Random noise / lines for realism (wall texture)
    for _ in range(50):
        nx = random.randint(0, size)
        ny = random.randint(0, size)
        draw.point((nx, ny), fill=(0,0,0))
    
    # Save
    img.save(save_path, quality=90)

def main():
    print("Generating 200 Synthetic Tube Lights...")
    
    count = 200
    for i in range(count):
        is_val = (i % 5 == 0)
        out_dir = VAL_DIR if is_val else TRAIN_DIR
        prefix = "val" if is_val else "img"
        idx = len([f for f in os.listdir(out_dir) if f.startswith('synthtube_')]) + 1
        
        save_path = os.path.join(out_dir, f"synthtube_{prefix}_{idx:04d}.jpg")
        create_synthetic_tubelight(save_path)
        
        if (i+1) % 20 == 0:
            print(f"  Generated {i+1}/{count}...")
            
    print("Synthetic tubes ready! You can now retrain the model.")

if __name__ == "__main__":
    main()
