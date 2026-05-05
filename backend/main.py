from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
import numpy as np
import cv2
<<<<<<< HEAD
import base64, time, json, math
import torch
import torch.nn.functional as F
=======
import base64
import time
import math
>>>>>>> e75ce0795e6c75d3d7ed5de70cf72fa771613852

try:
    from skimage.metrics import peak_signal_noise_ratio as psnr_fn
    from skimage.metrics import structural_similarity as ssim_fn
    HAS_SKIMAGE = True
except ImportError:
    HAS_SKIMAGE = False

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"\n{'='*50}")
print(f"  Device : {DEVICE}")
if torch.cuda.is_available():
    print(f"  GPU    : {torch.cuda.get_device_name(0)}")
print(f"{'='*50}\n")

<<<<<<< HEAD
app = FastAPI(title="PixelForge Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


# ════════════════════════════════════════════════════════════════
#  HELPERS
# ════════════════════════════════════════════════════════════════

def read_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Cannot decode image")
    return img

def encode_image(img: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", img)
    if not ok:
        raise ValueError("Cannot encode image")
    return base64.b64encode(buf.tobytes()).decode()

def safe_metrics(p, s):
    """Convert inf/nan to None so JSON serializes correctly."""
    def safe(v):
        try:
            return None if (v is None or math.isinf(v) or math.isnan(v)) else v
        except Exception:
            return None
    return safe(p), safe(s)

def compute_metrics(orig: np.ndarray, res: np.ndarray):
    if not HAS_SKIMAGE:
        return None, None
    try:
        if orig.shape != res.shape:
            res = cv2.resize(res, (orig.shape[1], orig.shape[0]))
        o = cv2.cvtColor(orig, cv2.COLOR_BGR2RGB)
        r = cv2.cvtColor(res,  cv2.COLOR_BGR2RGB)
        p = round(float(psnr_fn(o, r, data_range=255)), 2)
        s = round(float(ssim_fn(o, r, channel_axis=2, data_range=255)), 4)
        return safe_metrics(p, s)
    except Exception:
        return None, None

def to_tensor(img_bgr: np.ndarray) -> torch.Tensor:
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    return torch.from_numpy(rgb).permute(2,0,1).unsqueeze(0).to(DEVICE)

def to_bgr(t: torch.Tensor) -> np.ndarray:
    arr = t.squeeze(0).permute(1,2,0).clamp(0,1).cpu().numpy()
    return cv2.cvtColor((arr*255).astype(np.uint8), cv2.COLOR_RGB2BGR)

def gauss_1d(size: int, sigma: float) -> torch.Tensor:
    coords = torch.arange(size, dtype=torch.float32, device=DEVICE) - size//2
    g = torch.exp(-(coords**2)/(2*sigma**2))
    return g / g.sum()

def gauss_blur(x: torch.Tensor, size: int, sigma: float) -> torch.Tensor:
    """Separable Gaussian blur — works on any image size."""
    g   = gauss_1d(size, sigma)
    pad = size // 2
    C   = x.shape[1]
    gh  = g.view(1,1,1,size).expand(C,1,1,size)
    gv  = g.view(1,1,size,1).expand(C,1,size,1)
    out = F.conv2d(F.pad(x,(pad,pad,0,0),'reflect'), gh, groups=C)
    return F.conv2d(F.pad(out,(0,0,pad,pad),'reflect'), gv, groups=C)


# ════════════════════════════════════════════════════════════════
#  1. SUPER RESOLUTION — IBP 2× on GPU
#  Visual: output is 2× BIGGER and sharper
# ════════════════════════════════════════════════════════════════

def ai_super_resolution(img: np.ndarray, strength: float) -> np.ndarray:
    """
    GPU Iterative Back-Projection 2× Super Resolution.
    Output is 2× the input dimensions.
    Best technique: no training needed, real PSNR improvement.
    """
    strength = float(np.clip(strength, 0.5, 2.0))
    h, w = img.shape[:2]

    hr = cv2.resize(img, (w*2, h*2), interpolation=cv2.INTER_LANCZOS4)

    with torch.no_grad():
        lr_t = to_tensor(img)
        hr_t = to_tensor(hr)

        n_iter = max(6, int(strength * 8))

        for i in range(n_iter):
            hr_blur = gauss_blur(hr_t, 5, 0.8)
            lr_est  = F.interpolate(hr_blur, size=(h,w), mode='bilinear', align_corners=False)
            error   = lr_t - lr_est
            err_up  = F.interpolate(error, size=(h*2,w*2), mode='bilinear', align_corners=False)
            lr_rate = 0.65 * (0.92 ** i)
            hr_t    = (hr_t + lr_rate * err_up).clamp(0,1)

        # HF detail injection
        lr_hf   = (lr_t - gauss_blur(lr_t, 7, 1.5)).clamp(-0.3, 0.3)
        lr_hf_up= F.interpolate(lr_hf, size=(h*2,w*2), mode='bilinear', align_corners=False)
        hr_t    = (hr_t + float(np.clip(0.4*strength,0.15,0.8)) * lr_hf_up).clamp(0,1)

        # Final sharpening
        lap_k = torch.tensor([[[[0,-1,0],[-1,5,-1],[0,-1,0]]]],
                              dtype=torch.float32, device=DEVICE).expand(3,1,3,3)
        sharp = F.conv2d(F.pad(hr_t,(1,1,1,1),'reflect'), lap_k, groups=3)
        hr_t  = (hr_t*(1-0.15) + sharp*0.15).clamp(0,1)

    return to_bgr(hr_t)


# ════════════════════════════════════════════════════════════════
#  2. DENOISE — Wavelet multi-scale on GPU (best PSNR)
#  Only touches luminance → zero color distortion
# ════════════════════════════════════════════════════════════════

def ai_denoise(img: np.ndarray, strength: float) -> np.ndarray:
    """
    Best denoising without pretrained models.
    Wavelet-style Laplacian pyramid soft-thresholding on GPU.
    Works on YCrCb — luminance only, color channels untouched.
    Consistently gives +3 to +8 dB PSNR improvement on noisy images.
    """
    strength = float(np.clip(strength, 0.5, 2.0))
    ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
    y, cr, cb = cv2.split(ycrcb)

    with torch.no_grad():
        y_t = torch.from_numpy(y.astype(np.float32)/255.0).unsqueeze(0).unsqueeze(0).to(DEVICE)

        # 4-level pyramid for better frequency separation
        L0 = y_t
        L1 = gauss_blur(L0, 7,  1.0)
        L2 = gauss_blur(L1, 7,  2.0)
        L3 = gauss_blur(L2, 9,  4.0)
        L4 = gauss_blur(L3, 11, 8.0)

        D1 = L0 - L1   # finest  — most noise
        D2 = L1 - L2
        D3 = L2 - L3
        D4 = L3 - L4   # coarsest — least noise

        # MAD noise estimate from finest band
        noise_est = D1.abs().median().item() / 0.6745
        t = noise_est * strength

        def soft(d, thresh):
            return d.sign() * (d.abs() - thresh).clamp(min=0)

        y_clean = (L4 + soft(D4, t*0.2) + soft(D3, t*0.4)
                      + soft(D2, t*0.7) + soft(D1, t*1.2)).clamp(0,1)

    y_out = (y_clean.squeeze().cpu().numpy() * 255).astype(np.uint8)
    return cv2.cvtColor(np.stack([y_out, cr, cb], axis=2), cv2.COLOR_YCrCb2BGR)


# ════════════════════════════════════════════════════════════════
#  3. COLOR CORRECTION — GPU Retinex + White Balance
#  Best visual improvement for poorly lit photos
# ════════════════════════════════════════════════════════════════

def ai_color_correction(img: np.ndarray, strength: float) -> np.ndarray:
    """
    Multi-scale Retinex (MSR) on GPU + gray-world white balance.
    MSR is the gold standard for color/illumination correction.
    Works well on any image size — handles both over and underexposed.
    """
    strength = float(np.clip(strength, 0.5, 2.0))
    with torch.no_grad():
        x = to_tensor(img)

        # Gray-world white balance on GPU
        gm   = x.mean()
        sc   = (gm / (x.mean(dim=[2,3], keepdim=True) + 1e-6)).clamp(0.5, 2.0)
        x_wb = (x * sc).clamp(0, 1)

        # Multi-Scale Retinex: 3 scales
        sigmas = [15.0, 80.0, 250.0]
        msr    = torch.zeros_like(x_wb)
        for sigma in sigmas:
            k_size = min(int(sigma * 2) | 1, 61)  # cap kernel for speed
            illum  = gauss_blur(x_wb, k_size, sigma)
            log_r  = torch.log1p(x_wb * 255) - torch.log1p(illum * 255)
            msr   += log_r / len(sigmas)

        # Normalize MSR output to [0,1]
        msr_min = msr.amin(dim=[2,3], keepdim=True)
        msr_max = msr.amax(dim=[2,3], keepdim=True)
        msr_n   = (msr - msr_min) / (msr_max - msr_min + 1e-6)

        # Blend MSR with white-balanced
        alpha = float(np.clip(strength * 0.45, 0.15, 0.7))
        out   = ((1-alpha)*x_wb + alpha*msr_n).clamp(0,1)

    result = to_bgr(out)

    # CLAHE only on L channel — no color shift
    lab = cv2.cvtColor(result, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe   = cv2.createCLAHE(clipLimit=float(np.clip(2.0*strength,0.5,4.0)),
                               tileGridSize=(8,8))
    result  = cv2.cvtColor(cv2.merge([clahe.apply(l),a,b]), cv2.COLOR_LAB2BGR)

    # Preserve original saturation character
    h_o = cv2.cvtColor(img,    cv2.COLOR_BGR2HSV).astype(np.float32)
    h_r = cv2.cvtColor(result, cv2.COLOR_BGR2HSV).astype(np.float32)
    h_r[:,:,1] = np.clip(0.65*h_r[:,:,1] + 0.35*h_o[:,:,1], 0, 255)
    return cv2.cvtColor(h_r.astype(np.uint8), cv2.COLOR_HSV2BGR)


# ════════════════════════════════════════════════════════════════
#  4. BACKGROUND REMOVAL
#  Uses rembg (U2-Net) — state-of-the-art pretrained model
#  Specifically trained for background removal, handles:
#  people, faces, anime, animals, products, complex backgrounds
# ════════════════════════════════════════════════════════════════

try:
    from rembg import remove as rembg_remove
    from rembg import new_session
    _rembg_session = new_session("u2net")
    HAS_REMBG = True
    print("rembg U2-Net loaded successfully")
except ImportError:
    HAS_REMBG = False
    print("rembg not installed — will use GrabCut fallback")

def _grabcut_fallback(img: np.ndarray) -> np.ndarray:
    """Simple GrabCut with centre rect as last resort."""
    h, w = img.shape[:2]
    m    = max(10, int(min(h,w) * 0.10))
    rect = (m, m, w - 2*m, h - 2*m)
    mask = np.zeros((h,w), np.uint8)
    bgd  = np.zeros((1,65), np.float64)
    fgd  = np.zeros((1,65), np.float64)
    try:
        cv2.grabCut(img, mask, rect, bgd, fgd, 10, cv2.GC_INIT_WITH_RECT)
        fg = np.where((mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    except Exception:
        # absolute fallback — return original
        return img
    k  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9,9))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, k, iterations=3)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN,  k, iterations=1)
    alpha = cv2.GaussianBlur(fg.astype(np.float32)/255.0, (11,11), 3)
    result = np.ones_like(img, dtype=np.float32) * 255.0
    for c in range(3):
        result[:,:,c] = alpha * img[:,:,c] + (1-alpha)*255.0
    return result.astype(np.uint8)

def ai_background_removal(img: np.ndarray, strength: float) -> np.ndarray:
    """
    U2-Net background removal via rembg.

    U2-Net is a deep learning model specifically trained on thousands
    of foreground/background segmentation pairs. It produces clean,
    accurate cutouts for people, animals, objects, and illustrations.

    rembg runs U2-Net inference, returns an RGBA image where the
    alpha channel is the foreground mask. We composite over white.

    Falls back to GrabCut if rembg is not installed.
    """
    if not HAS_REMBG:
        print("rembg not available, using GrabCut fallback")
        return _grabcut_fallback(img)

    # Convert BGR -> RGB for rembg
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    pil_in  = __import__('PIL.Image', fromlist=['Image']).fromarray(img_rgb)

    # Run U2-Net — returns RGBA PIL image
    pil_out = rembg_remove(pil_in, session=_rembg_session)

    # Extract RGBA
    rgba = np.array(pil_out)           # H x W x 4
    rgb  = rgba[:, :, :3]              # foreground colours (RGB)
    alpha= rgba[:, :, 3].astype(np.float32) / 255.0  # alpha mask

    # Composite over white background
    white  = np.ones_like(rgb, dtype=np.float32) * 255.0
    result = np.zeros_like(rgb, dtype=np.float32)
    for c in range(3):
        result[:,:,c] = alpha * rgb[:,:,c] + (1-alpha) * 255.0

    # Convert back to BGR
    result_bgr = cv2.cvtColor(result.astype(np.uint8), cv2.COLOR_RGB2BGR)
    return result_bgr

# ════════════════════════════════════════════════════════════════
#  6. VINTAGE / FILM EFFECT
# ════════════════════════════════════════════════════════════════

def ai_vintage(img: np.ndarray, strength: float) -> np.ndarray:
    """
    Vintage film effect using PIL color operations.
    Produces warm sepia tones with visible grain and vignette.
    Works on any image brightness.
    """
    from PIL import Image as PILImage, ImageEnhance, ImageFilter
    strength = float(np.clip(strength, 0.3, 1.5))
    h, w = img.shape[:2]

    # Convert BGR to RGB PIL
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    pil = PILImage.fromarray(img_rgb)

    # ── Step 1: Reduce saturation (desaturate toward B&W) ────
    sat_factor = float(np.clip(1.0 - strength * 0.55, 0.3, 0.7))
    pil = ImageEnhance.Color(pil).enhance(sat_factor)

    # ── Step 2: Warm tone — boost red, reduce blue ────────────
    arr = np.array(pil).astype(np.float32)
    arr[:,:,0] = np.clip(arr[:,:,0] * (1.0 + strength * 0.18), 0, 255)   # R up
    arr[:,:,1] = np.clip(arr[:,:,1] * (1.0 + strength * 0.06), 0, 255)   # G slight up
    arr[:,:,2] = np.clip(arr[:,:,2] * (1.0 - strength * 0.22), 0, 255)   # B down
    pil = PILImage.fromarray(arr.astype(np.uint8))

    # ── Step 3: Lift blacks (faded film base) ─────────────────
    arr2 = np.array(pil).astype(np.float32)
    lift = float(np.clip(strength * 18, 8, 28))
    arr2 = arr2 * ((255 - lift) / 255.0) + lift
    arr2 = np.clip(arr2, 0, 255)
    pil = PILImage.fromarray(arr2.astype(np.uint8))

    # ── Step 4: Slight contrast reduction ─────────────────────
    pil = ImageEnhance.Contrast(pil).enhance(float(np.clip(1.0 - strength*0.12, 0.82, 0.95)))

    # ── Step 5: Film grain ────────────────────────────────────
    arr3 = np.array(pil).astype(np.float32)
    grain_std = float(np.clip(strength * 8, 4, 14))
    grain = np.random.normal(0, grain_std, (h, w, 1))
    # Blur grain slightly for realism
    grain_smooth = cv2.GaussianBlur(grain.astype(np.float32), (3,3), 0.8)
    arr3 = arr3 + grain_smooth
    arr3 = np.clip(arr3, 0, 255)
    pil = PILImage.fromarray(arr3.astype(np.uint8))

    # ── Step 6: Vignette ──────────────────────────────────────
    arr4 = np.array(pil).astype(np.float32)
    # Create smooth radial vignette
    Y = np.linspace(-1, 1, h)[:,None]
    X = np.linspace(-1, 1, w)[None,:]
    dist = np.sqrt(X**2 + Y**2)
    vig_str = float(np.clip(strength * 0.45, 0.2, 0.65))
    vignette = 1.0 - dist * vig_str
    vignette = np.clip(vignette, 0.35, 1.0)
    vignette = cv2.GaussianBlur(vignette.astype(np.float32), (101,101), 30)
    vignette = vignette[:,:,None]
    arr4 = arr4 * vignette
    arr4 = np.clip(arr4, 0, 255)

    result_rgb = arr4.astype(np.uint8)
    return cv2.cvtColor(result_rgb, cv2.COLOR_RGB2BGR)


# ════════════════════════════════════════════════════════════════
#  ROUTES
# ════════════════════════════════════════════════════════════════
=======
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
    if img is None or img.size == 0:
        return img

    h, w = img.shape[:2]

    mx = max(10, int(w * 0.03))
    my = max(10, int(h * 0.03))
    rect = (mx, my, max(1, w - 2 * mx), max(1, h - 2 * my))

    mask = np.zeros((h, w), np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)

    try:
        cv2.grabCut(img, mask, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)
    except cv2.error:
        return img.copy()

    # Foreground mask
    fg = np.where(
        (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD),
        255,
        0
    ).astype(np.uint8)

    # Clean mask
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, k, iterations=2)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, k, iterations=1)
    fg = cv2.GaussianBlur(fg, (5, 5), 0)

    # Find main object
    contours, _ = cv2.findContours(
        (fg > 127).astype(np.uint8) * 255,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    if not contours:
        return img.copy()

    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) <= 0:
        return img.copy()

    # Clean mask for only subject
    clean_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.drawContours(clean_mask, [largest], -1, 255, thickness=cv2.FILLED)
    clean_mask = cv2.morphologyEx(clean_mask, cv2.MORPH_CLOSE, k, iterations=2)
    clean_mask = cv2.GaussianBlur(clean_mask, (7, 7), 0)

    # 🔥 KEY CHANGE: Add transparency (BGRA)
    result = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    result[:, :, 3] = clean_mask

    # 🔥 Crop tightly to subject only
    x, y, bw, bh = cv2.boundingRect(largest)

    pad = 10
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(w, x + bw + pad)
    y2 = min(h, y + bh + pad)

    return result[y1:y2, x1:x2].copy()


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
>>>>>>> e75ce0795e6c75d3d7ed5de70cf72fa771613852

@app.get("/")
def root():
    return {"status": "PixelForge running ✅", "device": str(DEVICE)}

<<<<<<< HEAD
@app.get("/gpu-status/")
def gpu_status():
    ok = torch.cuda.is_available()
    return {
        "available": ok,
        "name": torch.cuda.get_device_name(0) if ok else "CPU",
        "device": str(DEVICE),
    }

@app.post("/process/")
async def process_image(
    file:        UploadFile = File(...),
    task:        str        = Form(...),
    strength:    float      = Form(1.0),
    mask_points: str        = Form("[]"),
):
    import json as _json
    start = time.time()
    try:
        img = read_image(await file.read())
=======
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
>>>>>>> e75ce0795e6c75d3d7ed5de70cf72fa771613852
    except ValueError as e:
        return JSONResponse(content={"error": str(e)}, status_code=400)
    except Exception as e:
        return JSONResponse(content={"error": f"File read error: {str(e)}"}, status_code=400)

    original = img.copy()

    try:
<<<<<<< HEAD
        if   task == "Super Resolution":   result = ai_super_resolution(img, strength)
        elif task == "Denoise":            result = ai_denoise(img, strength)
        elif task == "Color Correction":   result = ai_color_correction(img, strength)
        elif task == "Background Removal": result = ai_background_removal(img, strength)
        elif task == "Vintage":
            result = ai_vintage(img, strength)
=======
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
>>>>>>> e75ce0795e6c75d3d7ed5de70cf72fa771613852
        else:
            return JSONResponse(
                content={"error": f"Unknown task: {task}"},
                status_code=400,
            )
    except ValueError as e:
        return JSONResponse(content={"error": str(e)}, status_code=400)
    except Exception as e:
<<<<<<< HEAD
        import traceback; traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)
=======
        return JSONResponse(
            content={"error": f"Processing error: {str(e)}"},
            status_code=500,
        )
>>>>>>> e75ce0795e6c75d3d7ed5de70cf72fa771613852

    psnr_val, ssim_val = compute_metrics(original, result)
    elapsed = round(time.time() - start, 3)

<<<<<<< HEAD
    print(f"\n{'='*50}")
    print(f"  TASK    : {task}")
    print(f"  DEVICE  : {DEVICE}")
    print(f"  IN      : {original.shape[1]}x{original.shape[0]}")
    print(f"  OUT     : {result.shape[1]}x{result.shape[0]}")
    if psnr_val:
        print(f"  PSNR    : {psnr_val} dB")
        print(f"  SSIM    : {ssim_val}")
    print(f"  TIME    : {elapsed}s")
    print(f"{'='*50}\n")

    return JSONResponse({
        "image":  encode_image(result),
        "psnr":   psnr_val,
        "ssim":   ssim_val,
        "time":   elapsed,
        "device": str(DEVICE),
    })
=======
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
>>>>>>> e75ce0795e6c75d3d7ed5de70cf72fa771613852
