from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
import numpy as np
import cv2
import base64
import time
import math

try:
    from skimage.metrics import peak_signal_noise_ratio as psnr_fn
    from skimage.metrics import structural_similarity as ssim_fn
    HAS_SKIMAGE = True
except ImportError:
    HAS_SKIMAGE = False

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def read_image(contents: bytes) -> np.ndarray:
    arr = np.frombuffer(contents, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)

    if img is None:
        raise ValueError("Could not decode image")

    if len(img.shape) == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

    if len(img.shape) == 3 and img.shape[2] == 4:
        alpha = img[:, :, 3].astype(np.float32) / 255.0
        bgr = img[:, :, :3].astype(np.float32)
        white = np.full_like(bgr, 255, dtype=np.float32)
        img = (bgr * alpha[..., None] + white * (1 - alpha[..., None])).astype(np.uint8)

    return img


def encode_image(img_bgr: np.ndarray) -> str:
    success, buf = cv2.imencode(".png", img_bgr)
    if not success:
        raise ValueError("Could not encode image")
    return base64.b64encode(buf.tobytes()).decode("utf-8")


def safe_json_number(value):
    if value is None:
        return None
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        value = float(value)
        if not math.isfinite(value):
            return None
        return value
    return value


def sanitize_for_json(obj):
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    if isinstance(obj, tuple):
        return [sanitize_for_json(v) for v in obj]
    return safe_json_number(obj)


def compute_metrics(original: np.ndarray, result: np.ndarray):
    if not HAS_SKIMAGE:
        return None, None

    try:
        if original.shape != result.shape:
            result = cv2.resize(result, (original.shape[1], original.shape[0]))

        orig_rgb = cv2.cvtColor(original, cv2.COLOR_BGR2RGB)
        res_rgb = cv2.cvtColor(result, cv2.COLOR_BGR2RGB)

        p = psnr_fn(orig_rgb, res_rgb, data_range=255)
        s = ssim_fn(orig_rgb, res_rgb, channel_axis=2, data_range=255)

        p = safe_json_number(p)
        s = safe_json_number(s)

        if p is not None:
            p = round(p, 2)
        if s is not None:
            s = round(s, 4)

        return p, s
    except Exception:
        return None, None


def safe_int(value, default):
    try:
        return int(value)
    except Exception:
        return default


def safe_float(value, default):
    try:
        return float(value)
    except Exception:
        return default


def encode_for_download(img_bgr: np.ndarray, export_format: str, quality: float = 0.95):
    fmt = (export_format or "png").lower().strip()

    if fmt == "jpg":
        fmt = "jpeg"
    if fmt == "tif":
        fmt = "tiff"

    mime_map = {
        "png": "image/png",
        "jpeg": "image/jpeg",
        "bmp": "image/bmp",
        "tiff": "image/tiff",
    }

    ext_map = {
        "png": "png",
        "jpeg": "jpg",
        "bmp": "bmp",
        "tiff": "tiff",
    }

    encode_ext_map = {
        "png": ".png",
        "jpeg": ".jpg",
        "bmp": ".bmp",
        "tiff": ".tiff",
    }

    if fmt not in mime_map:
        raise ValueError(f"Unsupported export format: {export_format}")

    params = []
    if fmt == "jpeg":
        jpeg_q = int(max(1, min(100, round(float(quality) * 100))))
        params = [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_q]

    success, buf = cv2.imencode(encode_ext_map[fmt], img_bgr, params)
    if not success:
        raise ValueError(f"Could not encode image as {fmt}")

    return buf.tobytes(), mime_map[fmt], ext_map[fmt]


def enhance(img: np.ndarray, strength: float) -> np.ndarray:
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clip = float(np.clip(2.0 * strength, 1.0, 5.0))
    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(8, 8))
    l = clahe.apply(l)
    img = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)

    blurred = cv2.GaussianBlur(img, (0, 0), sigmaX=3.0)
    amount = float(np.clip(0.5 * strength, 0.1, 1.5))
    img = cv2.addWeighted(img, 1.0 + amount, blurred, -amount, 0)
    img = np.clip(img, 0, 255).astype(np.uint8)

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * (1.0 + 0.25 * strength), 0, 255)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def denoise(img: np.ndarray, strength: float) -> np.ndarray:
    h_val = float(np.clip(10 * strength, 3, 30))
    return cv2.fastNlMeansDenoisingColored(
        img, None, h=h_val, hColor=h_val, templateWindowSize=7, searchWindowSize=21
    )

def background_removal(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    mx = max(5, int(w * 0.05))
    my = max(5, int(h * 0.05))
    rect = (mx, my, max(1, w - 2 * mx), max(1, h - 2 * my))

    mask = np.zeros((h, w), np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)

    try:
        cv2.grabCut(img, mask, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)
    except cv2.error:
        return img.copy()

    fg = np.where(
        (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD),
        255,
        0,
    ).astype(np.uint8)

    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, k, iterations=2)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, k, iterations=1)

    contours, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return img.copy()

    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) <= 0:
        return img.copy()

    clean_mask = np.zeros_like(fg)
    cv2.drawContours(clean_mask, [largest], -1, 255, thickness=cv2.FILLED)
    clean_mask = cv2.morphologyEx(clean_mask, cv2.MORPH_CLOSE, k, iterations=1)

    x, y, bw, bh = cv2.boundingRect(largest)

    pad = 5
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(w, x + bw + pad)
    y2 = min(h, y + bh + pad)

    cropped = img[y1:y2, x1:x2].copy()
    return cropped


def color_correction(img: np.ndarray, strength: float) -> np.ndarray:
    b, g, r = cv2.split(img.astype(np.float32))
    avg = (b.mean() + g.mean() + r.mean()) / 3.0
    b = np.clip(b * (avg / (b.mean() + 1e-6)), 0, 255)
    g = np.clip(g * (avg / (g.mean() + 1e-6)), 0, 255)
    r = np.clip(r * (avg / (r.mean() + 1e-6)), 0, 255)
    img = cv2.merge([b, g, r]).astype(np.uint8)

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    hsv[:, :, 2] = cv2.equalizeHist(hsv[:, :, 2])
    img = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b_ch = cv2.split(lab)
    clip = float(np.clip(1.5 * strength, 0.5, 4.0))
    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(8, 8))
    return cv2.cvtColor(cv2.merge([clahe.apply(l), a, b_ch]), cv2.COLOR_LAB2BGR)


def super_resolution(img: np.ndarray, strength: float) -> np.ndarray:
    h, w = img.shape[:2]
    upscaled = cv2.resize(img, (w * 2, h * 2), interpolation=cv2.INTER_LANCZOS4)
    blurred = cv2.GaussianBlur(upscaled, (0, 0), sigmaX=1.5)
    amount = min(strength * 0.8, 2.0)
    result = cv2.addWeighted(upscaled, 1 + amount, blurred, -amount, 0)
    return np.clip(result, 0, 255).astype(np.uint8)


def edge_enhance(img: np.ndarray, strength: float) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    edges_bgr = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
    alpha = float(np.clip(0.4 * strength, 0.05, 1.0))
    result = cv2.addWeighted(img, 1.0, edges_bgr, alpha, 0)
    return np.clip(result, 0, 255).astype(np.uint8)


def resize_image(img: np.ndarray, width: int, height: int) -> np.ndarray:
    h, w = img.shape[:2]
    width = width if width > 0 else w
    height = height if height > 0 else h
    return cv2.resize(img, (width, height), interpolation=cv2.INTER_LINEAR)



def rotate_image(img: np.ndarray, angle: float) -> np.ndarray:
    if img is None or img.size == 0:
        return img

    h, w = img.shape[:2]

    # Normalize angle so 360 becomes 0 again
    angle = float(angle) % 360

    # Back to original position
    if abs(angle) < 1e-8:
        return img.copy()

    center = (w / 2.0, h / 2.0)

    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)

    rotated = cv2.warpAffine(
        img,
        matrix,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(255, 255, 255),
    )

    return rotated


def masking_tool(img: np.ndarray, x: int, y: int, w: int, h: int) -> np.ndarray:
    img_h, img_w = img.shape[:2]

    x = max(0, x)
    y = max(0, y)
    w = max(1, w)
    h = max(1, h)

    x2 = min(img_w, x + w)
    y2 = min(img_h, y + h)

    if x >= img_w or y >= img_h or x2 <= x or y2 <= y:
        return img.copy()

    result = img.copy()

    # 🔵 Create circular mask
    mask = np.zeros((img_h, img_w), dtype=np.uint8)

    center_x = (x + x2) // 2
    center_y = (y + y2) // 2
    radius = min((x2 - x) // 2, (y2 - y) // 2)

    cv2.circle(mask, (center_x, center_y), radius, 255, -1)

    # Dark overlay (masked effect)
    overlay = np.zeros_like(result)
    darkened = cv2.addWeighted(overlay, 0.5, result, 0.5, 0)

    # Apply mask: keep original inside circle, dark outside
    result[mask == 0] = darkened[mask == 0]

    # Draw circle border (optional)
    cv2.circle(result, (center_x, center_y), radius, (0, 255, 0), 2)

    return result

def layer_management(base_img: np.ndarray, overlay_img: np.ndarray, alpha: float) -> np.ndarray:
    h, w = base_img.shape[:2]
    overlay_resized = cv2.resize(overlay_img, (w, h))
    alpha = float(np.clip(alpha, 0.0, 1.0))
    result = cv2.addWeighted(base_img, 1 - alpha, overlay_resized, alpha, 0)
    return np.clip(result, 0, 255).astype(np.uint8)


def clone_tool(
    img: np.ndarray,
    src_x: int,
    src_y: int,
    src_w: int,
    src_h: int,
    dst_x: int,
    dst_y: int,
) -> np.ndarray:
    h, w = img.shape[:2]

    src_x = max(0, min(src_x, w - 1))
    src_y = max(0, min(src_y, h - 1))
    src_w = max(1, min(src_w, w - src_x))
    src_h = max(1, min(src_h, h - src_y))

    patch = img[src_y:src_y + src_h, src_x:src_x + src_w].copy()
    if patch.size == 0:
        return img.copy()

    mask = 255 * np.ones(patch.shape[:2], dtype=np.uint8)
    center_x = max(0, min(dst_x + src_w // 2, w - 1))
    center_y = max(0, min(dst_y + src_h // 2, h - 1))
    center = (center_x, center_y)

    try:
        return cv2.seamlessClone(patch, img, mask, center, cv2.NORMAL_CLONE)
    except cv2.error:
        result = img.copy()
        dst_x = max(0, min(dst_x, w - src_w))
        dst_y = max(0, min(dst_y, h - src_h))
        result[dst_y:dst_y + src_h, dst_x:dst_x + src_w] = patch
        return result


@app.post("/process/")
async def process_image(
    file: UploadFile = File(...),
    task: str = Form(...),
    strength: float = Form(1.0),
    overlay_file: UploadFile = File(None),
    width: int = Form(0),
    height: int = Form(0),
    angle: float = Form(0.0),
    x: int = Form(0),
    y: int = Form(0),
    mask_width: int = Form(100),
    mask_height: int = Form(100),
    alpha: float = Form(0.5),
    src_x: int = Form(0),
    src_y: int = Form(0),
    src_w: int = Form(50),
    src_h: int = Form(50),
    dst_x: int = Form(100),
    dst_y: int = Form(100),
):
    start = time.time()

    try:
        contents = await file.read()
        img = read_image(contents)
    except ValueError as e:
        return JSONResponse(content={"error": str(e)}, status_code=400)
    except Exception as e:
        return JSONResponse(content={"error": f"File read error: {str(e)}"}, status_code=400)

    original = img.copy()

    try:
        strength = safe_float(strength, 1.0)
        angle = safe_float(angle, 0.0)
        alpha = safe_float(alpha, 0.5)

        width = safe_int(width, 0)
        height = safe_int(height, 0)
        x = safe_int(x, 0)
        y = safe_int(y, 0)
        mask_width = safe_int(mask_width, 100)
        mask_height = safe_int(mask_height, 100)
        src_x = safe_int(src_x, 0)
        src_y = safe_int(src_y, 0)
        src_w = safe_int(src_w, 50)
        src_h = safe_int(src_h, 50)
        dst_x = safe_int(dst_x, 100)
        dst_y = safe_int(dst_y, 100)

        if task == "Enhance":
            result = enhance(img, strength)
        elif task == "Denoise":
            result = denoise(img, strength)
        elif task == "Background Removal":
            result = background_removal(img)
        elif task == "Color Correction":
            result = color_correction(img, strength)
        elif task == "Super Resolution":
            result = super_resolution(img, strength)
        elif task == "Edge Enhance":
            result = edge_enhance(img, strength)
        elif task == "Resize Image":
            result = resize_image(img, width, height)
        elif task == "Rotate Image":
            result = rotate_image(img, angle)
        elif task == "Masking":
            result = masking_tool(img, x, y, mask_width, mask_height)
        elif task == "Layer Management":
            if overlay_file is None:
                return JSONResponse(
                    content={"error": "overlay_file is required for Layer Management"},
                    status_code=400,
                )

            overlay_contents = await overlay_file.read()
            overlay_img = read_image(overlay_contents)
            result = layer_management(img, overlay_img, alpha)
        elif task == "Clone Tool":
            result = clone_tool(img, src_x, src_y, src_w, src_h, dst_x, dst_y)
        else:
            return JSONResponse(
                content={"error": f"Unknown task: {task}"},
                status_code=400,
            )
    except ValueError as e:
        return JSONResponse(content={"error": str(e)}, status_code=400)
    except Exception as e:
        return JSONResponse(
            content={"error": f"Processing error: {str(e)}"},
            status_code=500,
        )

    psnr_val, ssim_val = compute_metrics(original, result)
    elapsed = round(time.time() - start, 3)

    return JSONResponse(
        content=sanitize_for_json(
            {
                "image": encode_image(result),
                "psnr": psnr_val,
                "ssim": ssim_val,
                "time": elapsed,
            }
        )
    )


@app.post("/export/")
async def export_image(
    file: UploadFile = File(...),
    format: str = Form("png"),
    quality: float = Form(0.95),
):
    try:
        contents = await file.read()
        img = read_image(contents)

        quality = safe_float(quality, 0.95)
        file_bytes, mime_type, file_ext = encode_for_download(img, format, quality)

        return Response(
            content=file_bytes,
            media_type=mime_type,
            headers={
                "Content-Disposition": f'attachment; filename="edited-image.{file_ext}"'
            },
        )
    except ValueError as e:
        return JSONResponse(content={"error": str(e)}, status_code=400)
    except Exception as e:
        return JSONResponse(
            content={"error": f"Export error: {str(e)}"},
            status_code=500,
        )


@app.get("/")
def root():
    return {"status": "AI Image Editor backend running ✅"}