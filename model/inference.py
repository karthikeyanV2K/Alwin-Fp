"""
inference.py — ONNX Runtime inference wrapper for MobileViT appliance classifier
==================================================================================
Usage (standalone test):
    python inference.py --model checkpoints/mobilevit_appliance.onnx
                        --image  test.jpg
"""
from __future__ import annotations
import json
import os
import time
import argparse
from pathlib import Path
from typing import Tuple

import numpy as np
from PIL import Image
import onnxruntime as ort


class ApplianceInference:
    """
    Wraps an ONNX MobileViT model for single-frame appliance classification.

    Args:
        model_path: Path to .onnx file
        class_map_path: Path to class_map.json ({"0":"TV","1":"Fan",...})
        input_size: (H, W) expected by the model (default 224)
        confidence_threshold: minimum confidence to return a non-Other prediction
    """

    MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    def __init__(
        self,
        model_path: str,
        class_map_path: str | None = None,
        input_size: int = 224,
        confidence_threshold: float = 0.72,
    ):
        self.input_size = input_size
        self.confidence_threshold = confidence_threshold

        # Load ONNX session (prefer CUDA, fall back to CPU)
        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if "CUDAExecutionProvider" in ort.get_available_providers()
            else ["CPUExecutionProvider"]
        )
        sess_opts = ort.SessionOptions()
        sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(model_path, sess_opts, providers=providers)
        self.input_name  = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name

        # Load class map
        if class_map_path is None:
            class_map_path = str(Path(model_path).parent / "class_map.json")
        with open(class_map_path) as f:
            raw = json.load(f)
        self.class_map: dict[int, str] = {int(k): v for k, v in raw.items()}
        print(f"[Inference] Loaded model: {model_path}")
        print(f"[Inference] Classes: {self.class_map}")

    def preprocess(self, image: Image.Image) -> np.ndarray:
        """PIL Image → ONNX input tensor (1, 3, H, W)."""
        img = image.convert("RGB").resize((self.input_size, self.input_size), Image.BILINEAR)
        arr = np.array(img, dtype=np.float32) / 255.0        # HWC
        arr = (arr - self.MEAN) / self.STD                   # normalize
        arr = arr.transpose(2, 0, 1)[np.newaxis, ...]        # NCHW
        return arr.astype(np.float32)

    def predict_with_scores(self, image: Image.Image) -> dict:
        """Return the top prediction plus per-class probabilities."""
        tensor = self.preprocess(image)
        logits = self.session.run([self.output_name], {self.input_name: tensor})[0]
        probs  = self._softmax(logits[0])
        idx    = int(np.argmax(probs))
        conf   = float(probs[idx])
        raw_label = self.class_map.get(idx, "Other")
        label = raw_label if conf >= self.confidence_threshold else "Other"
        predictions = {
            self.class_map.get(i, str(i)): float(prob)
            for i, prob in enumerate(probs)
        }
        return {
            "class": label,
            "confidence": conf,
            "predictions": predictions,
            "raw_class": raw_label,
        }

    def predict(self, image: Image.Image) -> Tuple[str, float]:
        """
        Returns (label, confidence) for the most likely appliance.
        Returns ("Other", conf) when confidence < threshold.
        """
        result = self.predict_with_scores(image)
        return result["class"], result["confidence"]

    def predict_from_bytes(self, jpeg_bytes: bytes) -> Tuple[str, float]:
        """Convenience method: accepts raw JPEG bytes."""
        import io
        img = Image.open(io.BytesIO(jpeg_bytes))
        return self.predict(img)

    @staticmethod
    def _softmax(logits: np.ndarray) -> np.ndarray:
        e = np.exp(logits - logits.max())
        return e / e.sum()


# ── CLI test ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model",  required=True, help="Path to ONNX model")
    parser.add_argument("--image",  required=True, help="Test image path")
    parser.add_argument("--threshold", type=float, default=0.72)
    args = parser.parse_args()

    engine = ApplianceInference(args.model, confidence_threshold=args.threshold)
    img = Image.open(args.image)

    t0 = time.time()
    label, conf = engine.predict(img)
    elapsed_ms = (time.time() - t0) * 1000

    print(f"\n{'─'*40}")
    print(f"  Prediction : {label}")
    print(f"  Confidence : {conf:.3f} ({conf*100:.1f}%)")
    print(f"  Latency    : {elapsed_ms:.1f} ms")
    print(f"{'─'*40}")
