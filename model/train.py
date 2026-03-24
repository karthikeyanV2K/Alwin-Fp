"""
train.py — Custom MobileViT Appliance Classifier Training Script
=================================================================
Appliance Classes: TV, Fan, AC, Light, Plug (+ background/other)

Dataset layout expected:
    data/
        train/
            TV/      *.jpg
            Fan/     *.jpg
            AC/      *.jpg
            Light/   *.jpg
            Plug/    *.jpg
            Other/   *.jpg      ← "none of the above" negatives
        val/
            TV/  ...
            ...

Usage:
    python train.py --data_dir ./data --epochs 30 --batch_size 32
"""
import os
import argparse
import time
import json

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
import timm
from tqdm import tqdm
import matplotlib.pyplot as plt

# ── Classes ──────────────────────────────────────────────────────────────────
CLASSES = ["TV", "Fan", "AC", "Light", "Plug", "Other"]
NUM_CLASSES = len(CLASSES)

# ── Augmentation Pipelines ────────────────────────────────────────────────────
TRAIN_TRANSFORMS = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.RandomCrop(224),
    transforms.RandomHorizontalFlip(),
    transforms.RandomVerticalFlip(p=0.1),
    transforms.ColorJitter(brightness=0.4, contrast=0.4, saturation=0.3, hue=0.05),
    transforms.RandomRotation(15),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

VAL_TRANSFORMS = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def build_model(num_classes: int, pretrained: bool = True):
    """Load MobileViT-S backbone from timm with custom head."""
    model = timm.create_model(
        "mobilevit_s",
        pretrained=pretrained,
        num_classes=num_classes,
    )
    return model


def train_one_epoch(model, loader, optimizer, criterion, device, scaler):
    model.train()
    total_loss, correct, total = 0.0, 0, 0
    for images, labels in tqdm(loader, leave=False, desc="  Train"):
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        with torch.cuda.amp.autocast(enabled=(device.type == "cuda")):
            outputs = model(images)
            loss = criterion(outputs, labels)
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()
        total_loss += loss.item() * images.size(0)
        preds = outputs.argmax(dim=1)
        correct += (preds == labels).sum().item()
        total += images.size(0)
    return total_loss / total, correct / total


@torch.no_grad()
def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    for images, labels in tqdm(loader, leave=False, desc="  Val  "):
        images, labels = images.to(device), labels.to(device)
        outputs = model(images)
        loss = criterion(outputs, labels)
        total_loss += loss.item() * images.size(0)
        preds = outputs.argmax(dim=1)
        correct += (preds == labels).sum().item()
        total += images.size(0)
    return total_loss / total, correct / total


def main(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[INFO] Using device: {device}")

    # ── Datasets ─────────────────────────────────────────────────────────────
    train_dir = os.path.join(args.data_dir, "train")
    val_dir   = os.path.join(args.data_dir, "val")
    assert os.path.isdir(train_dir), f"Dataset not found at {train_dir}"

    train_ds = datasets.ImageFolder(train_dir, transform=TRAIN_TRANSFORMS)
    val_ds   = datasets.ImageFolder(val_dir,   transform=VAL_TRANSFORMS)

    # Validate class names match expected
    detected_classes = train_ds.classes
    print(f"[INFO] Detected classes: {detected_classes}")

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,
                              num_workers=0, pin_memory=False)
    val_loader   = DataLoader(val_ds,   batch_size=args.batch_size, shuffle=False,
                              num_workers=0, pin_memory=False)

    # ── Model ────────────────────────────────────────────────────────────────
    num_classes = len(detected_classes)
    model = build_model(num_classes, pretrained=(not args.no_pretrain))
    model = model.to(device)
    print(f"[INFO] Model: MobileViT-S | Classes: {num_classes} | Params: "
          f"{sum(p.numel() for p in model.parameters()) / 1e6:.2f}M")

    # ── Optimizer / LR / Loss ────────────────────────────────────────────────
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    scaler    = torch.cuda.amp.GradScaler(enabled=(device.type == "cuda"))

    # ── Training Loop ────────────────────────────────────────────────────────
    os.makedirs(args.output_dir, exist_ok=True)
    best_acc = 0.0
    history  = {"train_loss": [], "val_loss": [], "train_acc": [], "val_acc": []}

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        tr_loss, tr_acc = train_one_epoch(model, train_loader, optimizer, criterion, device, scaler)
        va_loss, va_acc = evaluate(model, val_loader, criterion, device)
        scheduler.step()

        history["train_loss"].append(tr_loss)
        history["val_loss"].append(va_loss)
        history["train_acc"].append(tr_acc)
        history["val_acc"].append(va_acc)

        flag = " ★" if va_acc > best_acc else ""
        if va_acc > best_acc:
            best_acc = va_acc
            ckpt_path = os.path.join(args.output_dir, "mobilevit_appliance_best.pth")
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_acc": va_acc,
                "classes": detected_classes,
            }, ckpt_path)
            print(f"  → Saved best checkpoint: {ckpt_path}")

        elapsed = time.time() - t0
        print(f"Epoch {epoch:3d}/{args.epochs} | "
              f"TrainLoss={tr_loss:.4f} TrainAcc={tr_acc:.3f} | "
              f"ValLoss={va_loss:.4f} ValAcc={va_acc:.3f} | "
              f"{elapsed:.1f}s{flag}")

    # ── Save class map ────────────────────────────────────────────────────────
    class_map = {i: cls for i, cls in enumerate(detected_classes)}
    with open(os.path.join(args.output_dir, "class_map.json"), "w") as f:
        json.dump(class_map, f, indent=2)
    print(f"[INFO] Best Val Acc: {best_acc:.4f}")

    # ── Plot curves ───────────────────────────────────────────────────────────
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    axes[0].plot(history["train_loss"], label="Train")
    axes[0].plot(history["val_loss"],   label="Val")
    axes[0].set_title("Loss"); axes[0].legend()
    axes[1].plot(history["train_acc"], label="Train")
    axes[1].plot(history["val_acc"],   label="Val")
    axes[1].set_title("Accuracy"); axes[1].legend()
    plot_path = os.path.join(args.output_dir, "training_curves.png")
    plt.savefig(plot_path, dpi=120, bbox_inches="tight")
    print(f"[INFO] Saved training curves → {plot_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train MobileViT appliance classifier")
    parser.add_argument("--data_dir",   default="./data")
    parser.add_argument("--output_dir", default="./checkpoints")
    parser.add_argument("--epochs",     type=int,   default=30)
    parser.add_argument("--batch_size", type=int,   default=32)
    parser.add_argument("--lr",         type=float, default=1e-4)
    parser.add_argument("--workers",    type=int,   default=4)
    parser.add_argument("--no_pretrain", action="store_true",
                        help="Train from scratch (not recommended)")
    args = parser.parse_args()
    main(args)
