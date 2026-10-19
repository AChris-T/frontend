"""
Train the YOLOv8 road-damage detector used by ai_service.py.

    pip install ultralytics
    python training/train_yolo.py                 # train + validate + export
    python training/train_yolo.py --epochs 5      # quick smoke run

The best weights are copied to backend/road_damage_model.pt, which
ai_service.load_model() picks up automatically on the next server start.
"""

import argparse
import os
import shutil

from ultralytics import YOLO

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(HERE)
DATA_YAML = os.path.join(HERE, "data.yaml")
OUTPUT_WEIGHTS = os.path.join(BACKEND_DIR, "road_damage_model.pt")


def parse_args():
    p = argparse.ArgumentParser(description="Train YOLOv8 for road fault detection")
    p.add_argument("--model", default="yolov8n.pt", help="Pretrained checkpoint to fine-tune (n/s/m)")
    p.add_argument("--epochs", type=int, default=100)
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--batch", type=int, default=16)
    p.add_argument("--device", default=None, help="'0' for GPU 0, 'cpu' for CPU (default: auto)")
    return p.parse_args()


def main():
    args = parse_args()
    model = YOLO(args.model)  # COCO-pretrained backbone, fine-tuned on road damage

    model.train(
        data=DATA_YAML,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        project=os.path.join(HERE, "runs"),
        name="road_damage",
        exist_ok=True,
        # Optimiser & schedule
        optimizer="AdamW",
        lr0=0.001,
        lrf=0.01,
        cos_lr=True,
        warmup_epochs=3,
        weight_decay=0.0005,
        patience=20,          # early stop if mAP stops improving
        # Augmentation (road photos: varied light, angle, phone cameras)
        hsv_h=0.015,
        hsv_s=0.6,
        hsv_v=0.4,
        degrees=5.0,
        translate=0.1,
        scale=0.5,
        fliplr=0.5,
        flipud=0.0,           # roads are never upside-down
        mosaic=1.0,
        mixup=0.1,
        close_mosaic=10,
        seed=42,
        plots=True,
    )

    best = os.path.join(HERE, "runs", "road_damage", "weights", "best.pt")
    metrics = YOLO(best).val(data=DATA_YAML, split="test", imgsz=args.imgsz)
    print(f"Test mAP50: {metrics.box.map50:.3f}  mAP50-95: {metrics.box.map:.3f}")

    shutil.copy(best, OUTPUT_WEIGHTS)
    print(f"Saved trained model to {OUTPUT_WEIGHTS}")


if __name__ == "__main__":
    main()
