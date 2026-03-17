from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import numpy as np
import cv2
from PIL import Image
import io
import base64
import time

# skimage for metrics - optional, graceful fallback if not installed
try:
    from skimage.metrics import peak_signal_noise_ratio as psnr_fn
    from skimage.metrics import structural_similarity as ssim_fn
    HAS_SKIMAGE = True
except ImportError:
    HAS_SKIMAGE = False

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── helpers ─────────────────────────────────────────────────────────────────

def read_image(contents: bytes) -> np.ndarray:
    """Decode uploaded bytes → BGR numpy array."""
    arr = np.frombuffer(contents, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    return img

def encode_image(img_bgr: np.ndarray) -> str:
    """BGR numpy → base64 PNG string."""
    success, buf = cv2.imencode(".png", img_bgr)
    if not success:
        raise ValueError("Could not encode image")
    return base64.b64encode(buf.tobytes()).decode("utf-8")

def compute_metrics(original: np.ndarray, result: np.ndarray):
    """Return (psnr, ssim) rounded. Falls back to None if skimage missing."""
    if not HAS_SKIMAGE:
        return None, None
    # match sizes
    if original.shape != result.shape:
        result = cv2.resize(result, (original.shape[1], original.shape[0]))
    orig_rgb = cv2.cvtColor(original, cv2.COLOR_BGR2RGB)
    res_rgb  = cv2.cvtColor(result,   cv2.COLOR_BGR2RGB)
    p = psnr_fn(orig_rgb, res_rgb, data_range=255)
    s = ssim_fn(orig_rgb, res_rgb, channel_axis=2, data_range=255)
    return round(float(p), 2), round(float(s), 4)

# ─── AI techniques ───────────────────────────────────────────────────────────

def enhance(img: np.ndarray, strength: float) -> np.ndarray:
    """
    CLAHE on L channel + unsharp mask + gentle saturation boost.
    """
    # ── CLAHE ──
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clip = float(np.clip(2.0 * strength, 1.0, 5.0))
    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(8, 8))
    l = clahe.apply(l)
    img = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)

    # ── Unsharp mask ──
    blurred = cv2.GaussianBlur(img, (0, 0), sigmaX=3.0)
    amount  = float(np.clip(0.5 * strength, 0.1, 1.5))
    img = cv2.addWeighted(img, 1.0 + amount, blurred, -amount, 0)
    img = np.clip(img, 0, 255).astype(np.uint8)

    # ── Saturation ──
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * (1.0 + 0.25 * strength), 0, 255)
    img = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    return img


def denoise(img: np.ndarray, strength: float) -> np.ndarray:
    """Non-local means denoising."""
    h_val = float(np.clip(10 * strength, 3, 30))
    return cv2.fastNlMeansDenoisingColored(
        img, None,
        h=h_val, hColor=h_val,
        templateWindowSize=7,
        searchWindowSize=21,
    )


def background_removal(img: np.ndarray) -> np.ndarray:
    """
    GrabCut with a 5% margin rect, morphological cleanup,
    background replaced with white.
    """
    h, w = img.shape[:2]
    mx = max(5, int(w * 0.05))
    my = max(5, int(h * 0.05))
    rect = (mx, my, w - 2 * mx, h - 2 * my)

    mask      = np.zeros((h, w), np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)

    try:
        cv2.grabCut(img, mask, rect, bgd_model, fgd_model,
                    iterCount=5, mode=cv2.GC_INIT_WITH_RECT)
    except cv2.error:
        # fallback: return original
        return img

    fg = np.where((mask == 2) | (mask == 0), 0, 1).astype(np.uint8)

    # morphological cleanup
    k  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, k, iterations=2)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN,  k, iterations=1)

    # white background
    result = img.copy()
    result[fg == 0] = [255, 255, 255]
    return result


def color_correction(img: np.ndarray, strength: float) -> np.ndarray:
    """
    Gray-world white balance → histogram equalisation on V → CLAHE on L.
    """
    # gray-world white balance
    b, g, r = cv2.split(img.astype(np.float32))
    avg = (b.mean() + g.mean() + r.mean()) / 3.0
    b = np.clip(b * (avg / (b.mean() + 1e-6)), 0, 255)
    g = np.clip(g * (avg / (g.mean() + 1e-6)), 0, 255)
    r = np.clip(r * (avg / (r.mean() + 1e-6)), 0, 255)
    img = cv2.merge([b, g, r]).astype(np.uint8)

    # histogram equalization on V
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    hsv[:, :, 2] = cv2.equalizeHist(hsv[:, :, 2])
    img = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

    # CLAHE on L for gentle contrast
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b_ch = cv2.split(lab)
    clip = float(np.clip(1.5 * strength, 0.5, 4.0))
    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(8, 8))
    img = cv2.cvtColor(cv2.merge([clahe.apply(l), a, b_ch]), cv2.COLOR_LAB2BGR)
    return img


def super_resolution(cv_img: np.ndarray, strength: float) -> np.ndarray:
    """Upscale 2x with Lanczos + unsharp sharpening."""
    h, w = cv_img.shape[:2]
    upscaled = cv2.resize(cv_img, (w * 2, h * 2), interpolation=cv2.INTER_LANCZOS4)
    blurred  = cv2.GaussianBlur(upscaled, (0, 0), sigmaX=1.5)
    amount   = min(strength * 0.8, 2.0)
    return cv2.addWeighted(upscaled, 1 + amount, blurred, -amount, 0)


def edge_enhance(img: np.ndarray, strength: float) -> np.ndarray:
    """Overlay Canny edges on the original."""
    gray  = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    edges_bgr = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
    alpha = float(np.clip(0.4 * strength, 0.05, 1.0))
    result = cv2.addWeighted(img, 1.0, edges_bgr, alpha, 0)
    return np.clip(result, 0, 255).astype(np.uint8)

# ─── route ───────────────────────────────────────────────────────────────────

@app.post("/process/")
async def process_image(
    file:     UploadFile = File(...),
    task:     str        = Form(...),
    strength: float      = Form(1.0),
):
    start    = time.time()
    contents = await file.read()

    try:
        img = read_image(contents)
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)

    original = img.copy()

    try:
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
        else:
            return JSONResponse({"error": f"Unknown task: {task}"}, status_code=400)
    except Exception as e:
        return JSONResponse({"error": f"Processing error: {str(e)}"}, status_code=500)

    psnr_val, ssim_val = compute_metrics(original, result)
    elapsed = round(time.time() - start, 3)

    # Console output visible in terminal during demo
    sep = "=" * 50
    print()
    print(sep)
    print(f"  TASK       : {task}")
    print(f"  INPUT SIZE : {original.shape[1]}x{original.shape[0]} px")
    print(f"  OUTPUT SIZE: {result.shape[1]}x{result.shape[0]} px")
    print(f"  STRENGTH   : {strength}")
    if psnr_val is not None:
        print(f"  PSNR       : {psnr_val} dB")
        print(f"  SSIM       : {ssim_val}")
    print(f"  TIME       : {elapsed} sec")
    print(sep)
    print()

    return JSONResponse({
        "image": encode_image(result),
        "psnr":  psnr_val,
        "ssim":  ssim_val,
        "time":  elapsed,
    })


@app.get("/")
def root():
    return {"status": "AI Image Editor backend running ✅"}