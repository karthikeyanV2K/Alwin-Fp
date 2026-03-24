"""
Generate placeholder images for missing appliance classes
"""
import os
from PIL import Image, ImageDraw, ImageFont
import random
from pathlib import Path

def generate_placeholder(class_name, num_images=80):
    """Generate synthetic placeholder images for a class."""
    train_dir = Path(__file__).parent / "data" / "train" / class_name
    val_dir = Path(__file__).parent / "data" / "val" / class_name
    
    train_dir.mkdir(parents=True, exist_ok=True)
    val_dir.mkdir(parents=True, exist_ok=True)
    
    # Placeholder colors for each class
    colors = {
        "AC": (100, 150, 200),        # Blue-ish
        "Light": (255, 255, 100),     # Yellow
        "Plug": (200, 100, 100),      # Red-ish
        "Other": (150, 150, 150),     # Gray
    }
    
    base_color = colors.get(class_name, (128, 128, 128))
    
    for i in range(num_images):
        # Generate random image
        color = (
            min(255, base_color[0] + random.randint(-30, 30)),
            min(255, base_color[1] + random.randint(-30, 30)),
            min(255, base_color[2] + random.randint(-30, 30)),
        )
        
        img = Image.new('RGB', (224, 224), color)
        draw = ImageDraw.Draw(img)
        
        # Add some texture
        for _ in range(20):
            x1, y1 = random.randint(0, 224), random.randint(0, 224)
            x2, y2 = x1 + random.randint(10, 50), y1 + random.randint(10, 50)
            draw.rectangle([x1, y1, x2, y2], 
                          fill=(random.randint(100, 200), random.randint(100, 200), random.randint(100, 200)))
        
        # Add class label
        try:
            draw.text((10, 10), class_name, fill=(255, 255, 255))
        except:
            pass  # Font may not be available
        
        # Save to train or val
        if i < int(num_images * 0.8):
            train_idx = int(i / 0.8) + 1
            path = train_dir / f"img_{train_idx:04d}.jpg"
        else:
            val_idx = i - int(num_images * 0.8)
            path = val_dir / f"img_{val_idx + 1:04d}.jpg"
        
        img.save(str(path), "JPEG", quality=85)
    
    print(f"✓ {class_name}: Generated {num_images} placeholder images")

# Generate for missing classes
missing = ["AC", "Light", "Plug", "Other"]
for cls in missing:
    generate_placeholder(cls, 80)

print("\n✅ All placeholder images generated!")
