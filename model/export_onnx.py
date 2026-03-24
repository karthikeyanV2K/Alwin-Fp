"""
export_onnx.py — Export trained MobileViT checkpoint to ONNX
=============================================================
Usage:
    python export_onnx.py --checkpoint checkpoints/mobilevit_appliance_best.pth
                          --output     checkpoints/mobilevit_appliance.onnx
"""
import argparse
import json
import os

import torch
import timm


def export(checkpoint_path: str, output_path: str):
    ckpt = torch.load(checkpoint_path, map_location="cpu")
    classes = ckpt["classes"]
    num_classes = len(classes)
    print(f"[INFO] Classes ({num_classes}): {classes}")

    # Rebuild model
    model = timm.create_model("mobilevit_s", pretrained=False, num_classes=num_classes)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    # Dummy input: batch=1, 3×224×224
    dummy = torch.randn(1, 3, 224, 224)

    torch.onnx.export(
        model,
        dummy,
        output_path,
        opset_version=17,
        input_names=["input"],
        output_names=["logits"],
        dynamic_axes={"input": {0: "batch_size"}, "logits": {0: "batch_size"}},
        verbose=False,
    )
    print(f"[OK] ONNX model saved → {output_path}")

    # Save class map alongside
    class_map_path = os.path.join(os.path.dirname(output_path), "class_map.json")
    with open(class_map_path, "w") as f:
        json.dump({str(i): cls for i, cls in enumerate(classes)}, f, indent=2)
    print(f"[OK] Class map saved → {class_map_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--output",     default="checkpoints/mobilevit_appliance.onnx")
    args = parser.parse_args()
    export(args.checkpoint, args.output)
