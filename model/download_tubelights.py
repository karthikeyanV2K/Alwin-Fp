"""
download_tubelights.py (Wikimedia/Pixabay API Fallback)
Downloads images of tube lights from Wikimedia Commons to avoid rate limits
"""
import os
import requests
from io import BytesIO
from PIL import Image

BASE_DIR = os.path.dirname(__file__)
TRAIN_DIR = os.path.join(BASE_DIR, "data", "train", "Light")
VAL_DIR = os.path.join(BASE_DIR, "data", "val", "Light")

os.makedirs(TRAIN_DIR, exist_ok=True)
os.makedirs(VAL_DIR, exist_ok=True)

# We use Wikipedia's open API to search for images of typical tube lights
# namespace=6 is for Files
API_URL = "https://commons.wikimedia.org/w/api.php"

def search_wikimedia(query, limit=50):
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": query,
        "gsrnamespace": 6,
        "gsrlimit": limit,
        "prop": "imageinfo",
        "iiprop": "url",
        "format": "json"
    }
    
    try:
        r = requests.get(API_URL, params=params, headers={"User-Agent": "AlwinVisionBot/1.0"}).json()
        pages = r.get("query", {}).get("pages", {})
        urls = []
        for pid, pdata in pages.items():
            info = pdata.get("imageinfo", [{}])[0]
            url = info.get("url")
            if url and url.lower().endswith(('.jpg', '.jpeg', '.png')):
                urls.append(url)
        return urls
    except Exception as e:
        print(f"Wikimedia API error: {e}")
        return []

def main():
    queries = ["fluorescent lamp tube", "led batten light", "neon tube light glowing", "tube light wall"]
    
    all_urls = []
    print("Fetching image URLs from Wikimedia Commons...")
    for q in queries:
        urls = search_wikimedia(q, 30)
        all_urls.extend(urls)
        
    all_urls = list(set(all_urls))
    print(f"Found {len(all_urls)} unique tube light images.")
    
    downloaded = 0
    for url in all_urls:
        try:
            resp = requests.get(url, timeout=10, headers={"User-Agent": "AlwinVisionBot/1.0"})
            if resp.status_code == 200:
                img = Image.open(BytesIO(resp.content)).convert("RGB")
                img = img.resize((224, 224), Image.Resampling.LANCZOS)
                
                is_val = (downloaded % 5 == 0)
                out_dir = VAL_DIR if is_val else TRAIN_DIR
                prefix = "val" if is_val else "img"
                idx = len([f for f in os.listdir(out_dir) if f.startswith('tube_')]) + 1
                
                save_path = os.path.join(out_dir, f"tube_{prefix}_{idx:04d}.jpg")
                img.save(save_path, quality=90)
                
                downloaded += 1
                print(f"  [{downloaded}/{min(100, len(all_urls))}] Downloaded {url.split('/')[-1][:20]}...")
                
                if downloaded >= 100:
                    break
        except Exception:
            pass
            
    print(f"Done! Successfully injected {downloaded} new tube light images into the dataset.")

if __name__ == "__main__":
    main()
