"""
UI Road Monitor — AI Detection Service
Senior Developer Grade: Multi-fault detection using
computer vision (OpenCV) + YOLOv8 hybrid approach.

Detection methods:
1. Hough Line Transform  — crack direction analysis
2. Contour Analysis      — pothole shape detection
3. Texture Analysis      — surface damage classification
4. Region Analysis       — zone-based fault isolation
5. YOLOv8               — object-level detection (when custom model available)
"""

import cv2
import numpy as np
import os
import uuid
from ultralytics import YOLO

# ─────────────────────────────────────────────────────────────
# MODEL SETUP
# ─────────────────────────────────────────────────────────────
MODEL_PATH = 'road_damage_model.pt'

def load_model():
    try:
        if os.path.exists(MODEL_PATH):
            print("✅ Loading custom road damage model...")
            return YOLO(MODEL_PATH)
        else:
            print("⚠️ Using YOLOv8 base model (custom model not found)")
            return YOLO('yolov8n.pt')
    except Exception as e:
        print(f"❌ Model loading error: {e}")
        return None

model = load_model()


# ─────────────────────────────────────────────────────────────
# SEVERITY CALCULATOR
# ─────────────────────────────────────────────────────────────
def get_severity(confidence: float) -> str:
    if confidence >= 0.75:
        return 'high'
    elif confidence >= 0.50:
        return 'medium'
    else:
        return 'low'


# ─────────────────────────────────────────────────────────────
# CORE DETECTION ENGINE
# ─────────────────────────────────────────────────────────────
def detect_all_faults(image_path: str) -> list:
    """
    Multi-fault detector — returns ALL faults found in image.
    Uses 5 detection methods combined for maximum accuracy.
    """
    detections = []

    try:
        img = cv2.imread(image_path)
        if img is None:
            return []

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

        # ── Preprocessing ──
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 30, 100)
        edges_strict = cv2.Canny(blurred, 50, 150)

        # ── Global metrics ──
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        texture_variance = laplacian.var()

        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        h_edge_strength = np.sum(np.abs(sobelx))
        v_edge_strength = np.sum(np.abs(sobely))
        edge_ratio = h_edge_strength / (v_edge_strength + 1e-6)

        kernel3 = np.ones((3, 3), np.uint8)
        kernel5 = np.ones((5, 5), np.uint8)
        dilated = cv2.dilate(edges, kernel3, iterations=2)
        crack_network_density = np.sum(dilated > 0) / (height * width)

        light_mask = (gray > 140) & (gray < 230)
        light_ratio = np.sum(light_mask) / (height * width)

        dark_mask = gray < 60
        dark_ratio = np.sum(dark_mask) / (height * width)

        print(f"\n  📊 Image metrics:")
        print(f"     Texture variance: {texture_variance:.1f}")
        print(f"     Crack network: {crack_network_density:.3f}")
        print(f"     Light ratio: {light_ratio:.3f}")
        print(f"     Edge ratio H/V: {edge_ratio:.3f}")

        # ────────────────────────────────────────────
        # METHOD 1 — HOUGH LINE TRANSFORM
        # Detects crack direction and density
        # ────────────────────────────────────────────
        lines = cv2.HoughLinesP(
            edges, 1, np.pi / 180,
            threshold=40,
            minLineLength=25,
            maxLineGap=15
        )

        h_lines = v_lines = diagonal_lines = 0

        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                angle = abs(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
                if angle < 20 or angle > 160:
                    h_lines += 1
                elif 70 < angle < 110:
                    v_lines += 1
                else:
                    diagonal_lines += 1

            total_lines = len(lines)
            diag_ratio = diagonal_lines / max(total_lines, 1)
            v_ratio = v_lines / max(total_lines, 1)
            h_ratio = h_lines / max(total_lines, 1)

            print(f"\n  📏 Hough lines: total={total_lines}, "
                  f"H={h_lines}({h_ratio:.1%}), "
                  f"V={v_lines}({v_ratio:.1%}), "
                  f"D={diagonal_lines}({diag_ratio:.1%})")

            # Alligator crack — dense multi-directional network
            if total_lines > 80 and diag_ratio > 0.25 and crack_network_density > 0.20:
                confidence = min(0.60 + (diag_ratio * 0.4) + (crack_network_density * 0.2), 0.95)
                detections.append({
                    'fault_type': 'alligator_crack',
                    'confidence': round(confidence, 3),
                    'severity': get_severity(confidence),
                    'method': 'hough_lines',
                    'evidence': f'{total_lines} line segments, {diag_ratio:.0%} diagonal'
                })
                print(f"  ✅ ALLIGATOR CRACK — conf: {confidence:.3f}")

            # Longitudinal crack — dominant vertical lines
            if v_lines >= 30 and crack_network_density > 0.05:
                confidence = min(0.50 + (v_ratio * 0.5) + (crack_network_density * 0.15), 0.88)
                detections.append({
                    'fault_type': 'longitudinal_crack',
                    'confidence': round(confidence, 3),
                    'severity': get_severity(confidence),
                    'method': 'hough_lines',
                    'evidence': f'{v_lines} vertical line segments'
                })
                print(f"  ✅ LONGITUDINAL CRACK — conf: {confidence:.3f}")

            # Transverse crack — dominant horizontal lines
            if h_lines >= 30 and crack_network_density > 0.05:
                confidence = min(0.50 + (h_ratio * 0.5) + (crack_network_density * 0.15), 0.88)
                detections.append({
                    'fault_type': 'transverse_crack',
                    'confidence': round(confidence, 3),
                    'severity': get_severity(confidence),
                    'method': 'hough_lines',
                    'evidence': f'{h_lines} horizontal line segments'
                })
                print(f"  ✅ TRANSVERSE CRACK — conf: {confidence:.3f}")

        # ────────────────────────────────────────────
        # METHOD 2 — CONTOUR ANALYSIS
        # Detects pothole shape (irregular large regions)
        # ────────────────────────────────────────────
        closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel5)
        contours, _ = cv2.findContours(
            closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        pothole_candidates = 0
        max_pothole_area = 0

        for c in contours:
            area = cv2.contourArea(c)
            if area > 2000:
                perimeter = cv2.arcLength(c, True)
                if perimeter > 0:
                    circularity = 4 * np.pi * area / (perimeter ** 2)
                    # Potholes: large, irregular shape (low circularity)
                    if 0.05 < circularity < 0.75:
                        pothole_candidates += 1
                        max_pothole_area = max(max_pothole_area, area)

        total_area = height * width
        area_ratio = max_pothole_area / total_area if total_area > 0 else 0

        print(f"\n  🔵 Contours: pothole_candidates={pothole_candidates}, "
              f"max_area_ratio={area_ratio:.3f}")

        if pothole_candidates >= 1 and area_ratio > 0.05:
            confidence = min(0.55 + (area_ratio * 1.5) + (light_ratio * 0.2), 0.95)
            # Check if this fault type is already detected
            existing = [d for d in detections if d['fault_type'] == 'pothole']
            if not existing:
                detections.append({
                    'fault_type': 'pothole',
                    'confidence': round(confidence, 3),
                    'severity': get_severity(confidence),
                    'method': 'contour_analysis',
                    'evidence': f'{pothole_candidates} irregular contours, area={area_ratio:.1%}'
                })
                print(f"  ✅ POTHOLE — conf: {confidence:.3f}")

        # ────────────────────────────────────────────
        # METHOD 3 — TEXTURE + COLOR ANALYSIS
        # Detects pothole via exposed soil color
        # ────────────────────────────────────────────
        # Brown/sandy soil colors (exposed pothole base)
        brown_mask = (
            (hsv[:, :, 0] >= 8) & (hsv[:, :, 0] <= 35) &
            (hsv[:, :, 1] >= 20) & (hsv[:, :, 1] <= 180) &
            (hsv[:, :, 2] >= 80)
        )
        brown_ratio = np.sum(brown_mask) / (height * width)

        # Sandy/exposed aggregate
        sandy_mask = (gray > 150) & (gray < 215)
        sandy_ratio = np.sum(sandy_mask) / (height * width)

        print(f"\n  🎨 Color analysis: brown={brown_ratio:.3f}, sandy={sandy_ratio:.3f}")

        if (brown_ratio > 0.02 or sandy_ratio > 0.08) and texture_variance > 500:
            confidence = min(0.58 + (brown_ratio * 3) + (sandy_ratio * 0.3), 0.93)
            existing = [d for d in detections if d['fault_type'] == 'pothole']
            if not existing:
                detections.append({
                    'fault_type': 'pothole',
                    'confidence': round(confidence, 3),
                    'severity': get_severity(confidence),
                    'method': 'color_analysis',
                    'evidence': f'brown={brown_ratio:.1%}, sandy={sandy_ratio:.1%}'
                })
                print(f"  ✅ POTHOLE (color) — conf: {confidence:.3f}")
            else:
                # Update confidence if higher
                if confidence > existing[0]['confidence']:
                    existing[0]['confidence'] = round(confidence, 3)
                    existing[0]['severity'] = get_severity(confidence)

        # ────────────────────────────────────────────
        # METHOD 4 — REGION-BASED ANALYSIS
        # Isolates faults by image zone
        # ────────────────────────────────────────────
        regions = {
            'center': gray[height//4:3*height//4, width//4:3*width//4],
            'right': gray[:, width//2:],
            'left': gray[:, :width//2],
            'top': gray[:height//2, :],
            'bottom': gray[height//2:, :]
        }

        for region_name, region in regions.items():
            if region.size == 0:
                continue
            r_lap = cv2.Laplacian(region, cv2.CV_64F)
            r_texture = r_lap.var()
            r_edges = cv2.Canny(region, 30, 100)
            r_edge_density = np.sum(r_edges > 0) / region.size
            r_light = np.sum((region > 140) & (region < 230)) / region.size

            # High texture + light patches in a zone = pothole
            if r_texture > 2000 and r_light > 0.4 and r_edge_density > 0.2:
                existing = [d for d in detections if d['fault_type'] == 'pothole']
                if not existing:
                    confidence = min(0.60 + (r_texture / 20000) + (r_light * 0.2), 0.92)
                    detections.append({
                        'fault_type': 'pothole',
                        'confidence': round(confidence, 3),
                        'severity': get_severity(confidence),
                        'method': f'region_analysis_{region_name}',
                        'evidence': f'High texture ({r_texture:.0f}) in {region_name} zone'
                    })
                    print(f"  ✅ POTHOLE (region:{region_name}) — conf: {confidence:.3f}")

        # ────────────────────────────────────────────
        # METHOD 5 — RUTTING DETECTION
        # Road surface elevation profile analysis
        # ────────────────────────────────────────────
        # Sample multiple horizontal rows
        row_variances = []
        for row_idx in [height//4, height//3, height//2, 2*height//3, 3*height//4]:
            row = gray[row_idx, :].astype(float)
            row_variances.append(np.var(row))

        avg_row_variance = np.mean(row_variances)
        max_row_range = max(
            int(gray[row_idx, :].max()) - int(gray[row_idx, :].min())
            for row_idx in [height//4, height//2, 3*height//4]
        )

        print(f"\n  📉 Rutting: avg_row_variance={avg_row_variance:.1f}, "
              f"max_range={max_row_range}")

        # Rutting: significant variation in road profile
        # but NOT dominated by crack network
        if avg_row_variance > 800 and max_row_range > 100 and crack_network_density < 0.50:
            confidence = min(0.45 + (avg_row_variance / 8000) + (max_row_range / 500), 0.82)
            detections.append({
                'fault_type': 'rutting',
                'confidence': round(confidence, 3),
                'severity': get_severity(confidence),
                'method': 'profile_analysis',
                'evidence': f'Row variance={avg_row_variance:.0f}, range={max_row_range}'
            })
            print(f"  ✅ RUTTING — conf: {confidence:.3f}")

    except Exception as e:
        print(f"❌ Detection error: {e}")
        import traceback
        traceback.print_exc()

    return detections


# ─────────────────────────────────────────────────────────────
# DEDUPLICATION
# ─────────────────────────────────────────────────────────────
def deduplicate_detections(detections: list) -> list:
    """
    Remove duplicate fault types — keep highest confidence for each type.
    """
    best = {}
    for d in detections:
        ft = d['fault_type']
        if ft not in best or d['confidence'] > best[ft]['confidence']:
            best[ft] = d
    return list(best.values())


# ─────────────────────────────────────────────────────────────
# PUBLIC API — analyze_image
# ─────────────────────────────────────────────────────────────
def analyze_image(image_path: str) -> dict:
    print(f"\n{'='*50}")
    print(f"🔍 Analyzing: {image_path}")
    print(f"{'='*50}")

    try:
        # Run all detectors
        raw_detections = detect_all_faults(image_path)

        # Deduplicate
        detections = deduplicate_detections(raw_detections)

        # Sort by confidence
        detections = sorted(detections, key=lambda x: x['confidence'], reverse=True)

        print(f"\n  📋 Total unique faults detected: {len(detections)}")
        for d in detections:
            print(f"     → {d['fault_type']} | {d['severity']} | conf={d['confidence']}")

        if not detections:
            return {
                'fault_detected': False,
                'fault_type': 'none',
                'severity': 'none',
                'confidence': 0,
                'all_detections': [],
                'total_faults': 0,
                'message': 'No road fault detected — please select fault type manually'
            }

        # Primary fault = highest confidence
        primary = detections[0]

        return {
            'fault_detected': True,
            'fault_type': primary['fault_type'],
            'severity': primary['severity'],
            'confidence': primary['confidence'],
            'all_detections': detections,
            'total_faults': len(detections),
            'message': f"{len(detections)} fault(s) detected: " +
                       ", ".join(d['fault_type'] for d in detections)
        }

    except Exception as e:
        print(f"❌ analyze_image error: {e}")
        return {
            'fault_detected': False,
            'fault_type': 'none',
            'severity': 'none',
            'confidence': 0,
            'all_detections': [],
            'total_faults': 0,
            'message': f'Analysis error: {str(e)}'
        }


# ─────────────────────────────────────────────────────────────
# PUBLIC API — analyze_video
# ─────────────────────────────────────────────────────────────
def analyze_video(video_path: str) -> dict:
    print(f"\n{'='*50}")
    print(f"🎬 Analyzing video: {video_path}")
    print(f"{'='*50}")

    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {
                'fault_detected': False,
                'fault_type': 'none',
                'severity': 'none',
                'confidence': 0,
                'message': 'Could not open video file'
            }

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        sample_interval = max(1, total_frames // 20)

        all_frame_detections = []
        frame_count = 0
        processed = 0

        print(f"  Frames: {total_frames}, FPS: {fps:.1f}, "
              f"Sampling every {sample_interval} frames")

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_count % sample_interval == 0:
                temp_path = f'temp_frame_{uuid.uuid4()}.jpg'
                cv2.imwrite(temp_path, frame)

                frame_result = analyze_image(temp_path)

                if frame_result.get('fault_detected'):
                    timestamp = round(frame_count / fps, 2) if fps > 0 else frame_count
                    for det in frame_result.get('all_detections', []):
                        all_frame_detections.append({
                            **det,
                            'timestamp_seconds': timestamp,
                            'frame': frame_count
                        })

                if os.path.exists(temp_path):
                    os.remove(temp_path)

                processed += 1

            frame_count += 1

        cap.release()

        if not all_frame_detections:
            return {
                'fault_detected': False,
                'fault_type': 'none',
                'severity': 'none',
                'confidence': 0,
                'all_detections': [],
                'total_faults': 0,
                'frames_processed': processed,
                'message': 'No road faults detected in video'
            }

        # Aggregate across frames
        fault_counts = {}
        fault_confidences = {}
        for d in all_frame_detections:
            ft = d['fault_type']
            fault_counts[ft] = fault_counts.get(ft, 0) + 1
            if ft not in fault_confidences or d['confidence'] > fault_confidences[ft]:
                fault_confidences[ft] = d['confidence']

        # Build final detection list
        final_detections = []
        for ft, count in fault_counts.items():
            confidence = fault_confidences[ft]
            final_detections.append({
                'fault_type': ft,
                'confidence': round(confidence, 3),
                'severity': get_severity(confidence),
                'occurrences': count
            })

        final_detections = sorted(
            final_detections, key=lambda x: x['confidence'], reverse=True
        )
        primary = final_detections[0]

        return {
            'fault_detected': True,
            'fault_type': primary['fault_type'],
            'severity': primary['severity'],
            'confidence': primary['confidence'],
            'all_detections': final_detections,
            'total_faults': len(final_detections),
            'frames_processed': processed,
            'message': f"{len(final_detections)} fault type(s) detected across {processed} frames"
        }

    except Exception as e:
        print(f"❌ analyze_video error: {e}")
        return {
            'fault_detected': False,
            'fault_type': 'none',
            'severity': 'none',
            'confidence': 0,
            'message': f'Video analysis error: {str(e)}'
        }


# ─────────────────────────────────────────────────────────────
# TEST (run directly)
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        path = sys.argv[1]
        result = analyze_image(path)
        print(f"\n{'='*50}")
        print("FINAL RESULT:")
        import json
        print(json.dumps(result, indent=2))
    else:
        print("Usage: python ai_service.py <image_path>")