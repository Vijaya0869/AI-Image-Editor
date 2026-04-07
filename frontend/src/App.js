import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

function App() {
  const canvasRef = useRef(null);
  const lastObjectUrlRef = useRef(null);

  const [inputPreview, setInputPreview] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [mode, setMode] = useState("basic");
  const [task, setTask] = useState("Crop");

  const [strength, setStrength] = useState(1.0);

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [sharpness, setSharpness] = useState(0);
  const [blurAmount, setBlurAmount] = useState(0);

  const [resizeWidth, setResizeWidth] = useState(400);
  const [resizeHeight, setResizeHeight] = useState(400);
  const [rotateAngle, setRotateAngle] = useState(0);

  const [maskX, setMaskX] = useState(50);
  const [maskY, setMaskY] = useState(50);
  const [maskWidth, setMaskWidth] = useState(120);
  const [maskHeight, setMaskHeight] = useState(120);

  const [layerAlpha, setLayerAlpha] = useState(0.5);
  const [overlayFile, setOverlayFile] = useState(null);

  const [srcX, setSrcX] = useState(20);
  const [srcY, setSrcY] = useState(20);
  const [srcW, setSrcW] = useState(80);
  const [srcH, setSrcH] = useState(80);
  const [dstX, setDstX] = useState(180);
  const [dstY, setDstY] = useState(180);

  const [imgInfo, setImgInfo] = useState(null);

  const [textValue, setTextValue] = useState("");
  const [textSize, setTextSize] = useState(30);
  const [textColor, setTextColor] = useState("#ffffff");

  const [brushSize, setBrushSize] = useState(8);
  const [brushColor, setBrushColor] = useState("#ff3b3b");
  const [eraserEnabled, setEraserEnabled] = useState(false);

  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const historyRef = useRef([]);
  const redoStackRef = useRef([]);

  const [exportFormat, setExportFormat] = useState("png");
  const [jpegQuality, setJpegQuality] = useState(0.95);

  const CANVAS_W = 400;
  const CANVAS_H = 400;

  const API_URL = "http://127.0.0.1:8000/process/";

  const cropStateRef = useRef({
    dragging: false,
    active: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });

  const drawStateRef = useRef({
    drawing: false,
    hasSavedStart: false,
  });

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    redoStackRef.current = redoStack;
  }, [redoStack]);

  const styles = {
    layout: {
      display: "flex",
      height: "100vh",
      fontFamily: "Arial, sans-serif",
    },
    sidebar: {
      width: "320px",
      padding: "20px",
      background: "#0f2d3a",
      color: "white",
      overflowY: "auto",
    },
    main: {
      flex: 1,
      padding: "30px",
      textAlign: "center",
      background: "#1f3b4d",
      color: "white",
      overflowY: "auto",
    },
    section: { marginBottom: "16px" },
    button: {
      padding: "8px 12px",
      marginTop: "6px",
      cursor: "pointer",
      background: "#1a8a6e",
      color: "white",
      border: "none",
      borderRadius: "4px",
    },
    buttonSecondary: {
      padding: "8px 12px",
      marginTop: "6px",
      cursor: "pointer",
      background: "#355466",
      color: "white",
      border: "none",
      borderRadius: "4px",
    },
    input: {
      width: "100%",
      padding: "6px",
      boxSizing: "border-box",
      marginTop: "4px",
    },
    uploadBox: {
      border: "2px dashed white",
      padding: "20px",
      marginBottom: "20px",
    },
    image: {
      maxWidth: "400px",
      maxHeight: "400px",
      objectFit: "contain",
      borderRadius: "8px",
      border: "1px solid rgba(255,255,255,0.15)",
      background: "#fff",
    },
    imageRow: {
      display: "flex",
      justifyContent: "center",
      gap: "30px",
      marginTop: "20px",
      flexWrap: "wrap",
      alignItems: "flex-start",
    },
    imageContainer: { textAlign: "center" },
    imageLabel: {
      marginTop: "6px",
      fontSize: "14px",
      color: "#cce",
    },
    topBar: {
      display: "flex",
      gap: "10px",
      marginBottom: "10px",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
    },
    metricsInline: {
      display: "flex",
      gap: "24px",
      justifyContent: "center",
      marginTop: "14px",
      background: "#0f2d3a",
      padding: "10px 20px",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "bold",
      color: "#7ef7c8",
      flexWrap: "wrap",
    },
    label: { display: "block", marginTop: "8px", fontSize: "13px" },
    loadingBadge: {
      display: "inline-block",
      padding: "6px 14px",
      background: "#e8a838",
      borderRadius: "4px",
      color: "#000",
      fontWeight: "bold",
      marginTop: "10px",
    },
    hint: {
      fontSize: 12,
      color: "#bcd",
      marginTop: 6,
      lineHeight: 1.3,
    },
    canvasWrap: {
      position: "relative",
      display: "inline-block",
    },
    canvas: {
      display: "block",
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.15)",
      cursor: "crosshair",
      maxWidth: "400px",
      maxHeight: "400px",
      background: "#fff",
    },
    subTitle: {
      fontWeight: "bold",
      color: "#7ef7c8",
      marginBottom: "8px",
      fontSize: "13px",
    },
    row2: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "8px",
    },
  };

  const getCtx = () => canvasRef.current?.getContext("2d");

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const clearCropState = () => {
    cropStateRef.current.active = false;
    cropStateRef.current.dragging = false;
    cropStateRef.current.startX = 0;
    cropStateRef.current.startY = 0;
    cropStateRef.current.endX = 0;
    cropStateRef.current.endY = 0;
  };

  const pushHistoryFromCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const snapshot = canvas.toDataURL("image/png");

    setHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === snapshot) return prev;
      return [...prev, snapshot];
    });

    setRedoStack([]);
  };

  const drawContain = (ctx, source, options = {}) => {
    const { clear = true, alpha = 1 } = options;
    const W = CANVAS_W;
    const H = CANVAS_H;

    if (clear) {
      ctx.clearRect(0, 0, W, H);
    }

    const sourceW = source.width;
    const sourceH = source.height;
    if (!sourceW || !sourceH) return;

    const scale = Math.min(W / sourceW, H / sourceH);
    const drawW = sourceW * scale;
    const drawH = sourceH * scale;
    const offX = (W - drawW) / 2;
    const offY = (H - drawH) / 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(source, offX, offY, drawW, drawH);
    ctx.restore();
  };

  const loadDataUrlToCanvas = (dataURL, withCropOverlay = false) => {
    const img = new Image();

    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx) return;

      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      drawContain(ctx, img, { clear: true });

      if (withCropOverlay) {
        const s = cropStateRef.current;
        if (s.active || s.dragging) {
          const x = Math.min(s.startX, s.endX);
          const y = Math.min(s.startY, s.endY);
          const w = Math.abs(s.endX - s.startX);
          const h = Math.abs(s.endY - s.startY);

          ctx.save();
          ctx.strokeStyle = "rgba(0,255,255,0.95)";
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 6]);
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = "rgba(0,255,255,0.08)";
          ctx.fillRect(x, y, w, h);
          ctx.restore();
        }
      }
    };

    img.onerror = () => {
      console.error("Failed to load image into canvas");
    };

    img.src = dataURL;
  };

  const restoreFromDataURL = (dataURL) => {
    loadDataUrlToCanvas(dataURL, false);
  };

  const undo = () => {
    const currentHistory = historyRef.current;
    if (currentHistory.length <= 1) return;

    const newHistory = [...currentHistory];
    const last = newHistory.pop();
    const previousSnapshot = newHistory[newHistory.length - 1];

    setHistory(newHistory);
    setRedoStack((prev) => [...prev, last]);

    if (previousSnapshot) {
      restoreFromDataURL(previousSnapshot);
    }

    clearCropState();
    drawStateRef.current.drawing = false;
    drawStateRef.current.hasSavedStart = false;
  };

  const redo = () => {
    const currentRedo = redoStackRef.current;
    if (currentRedo.length === 0) return;

    const last = currentRedo[currentRedo.length - 1];
    const newRedo = currentRedo.slice(0, -1);

    setRedoStack(newRedo);
    setHistory((prev) => [...prev, last]);
    restoreFromDataURL(last);

    clearCropState();
    drawStateRef.current.drawing = false;
    drawStateRef.current.hasSavedStart = false;
  };

  const downloadImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setDownloading(true);

    try {
      const normalizedFormat = String(exportFormat || "png").toLowerCase();

      const mimeMap = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        bmp: "image/bmp",
        tiff: "image/tiff",
        tif: "image/tiff",
      };

      const extensionMap = {
        png: "png",
        jpg: "jpg",
        jpeg: "jpeg",
        bmp: "bmp",
        tiff: "tiff",
        tif: "tiff",
      };

      const fileMime = mimeMap[normalizedFormat] || "image/png";
      const fileExt = extensionMap[normalizedFormat] || "png";

      const safeMime =
        normalizedFormat === "bmp" ||
        normalizedFormat === "tiff" ||
        normalizedFormat === "tif"
          ? "image/png"
          : fileMime;

      const quality = safeMime === "image/jpeg" ? jpegQuality : undefined;

      const blob = await new Promise((resolve) => {
        canvas.toBlob((fileBlob) => resolve(fileBlob), safeMime, quality);
      });

      if (!blob) {
        alert("Could not prepare image for download.");
        return;
      }

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download =
        safeMime === "image/png" &&
        (normalizedFormat === "bmp" ||
          normalizedFormat === "tiff" ||
          normalizedFormat === "tif")
          ? "edited-image.png"
          : `edited-image.${fileExt}`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Download error:", err);
      alert("Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const canvasToFile = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        resolve(new File([blob], "canvas.png", { type: "image/png" }));
      }, "image/png");
    });
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (lastObjectUrlRef.current) {
      URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = null;
    }

    setResultImage(null);
    setMetrics(null);
    setOverlayFile(null);
    clearCropState();
    setEraserEnabled(false);

    const img = new Image();
    const url = URL.createObjectURL(selected);
    lastObjectUrlRef.current = url;

    img.onload = () => {
      const fmt = selected.type?.replace("image/", "").toUpperCase() || "UNKNOWN";
      const sizeKB = (selected.size / 1024).toFixed(1);
      const sizeText =
        selected.size >= 1024 * 1024
          ? `${(selected.size / (1024 * 1024)).toFixed(2)} MB`
          : `${sizeKB} KB`;

      const gcd = (a, b) => (b ? gcd(b, a % b) : a);
      const gc = gcd(img.naturalWidth, img.naturalHeight);
      const aspect = `${img.naturalWidth / gc}:${img.naturalHeight / gc}`;

      setImgInfo({
        name: selected.name,
        w: img.naturalWidth,
        h: img.naturalHeight,
        size: sizeText,
        format: fmt,
        aspect,
      });

      setResizeWidth(img.naturalWidth);
      setResizeHeight(img.naturalHeight);
    };

    img.onerror = () => {
      alert("Failed to load image.");
    };

    img.src = url;

    const reader = new FileReader();
    reader.onload = () => setInputPreview(reader.result);
    reader.readAsDataURL(selected);
  };

  useEffect(() => {
    if (!inputPreview) return;

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx) return;

      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      drawContain(ctx, img, { clear: true });

      const first = canvas.toDataURL("image/png");
      setHistory([first]);
      setRedoStack([]);
      clearCropState();
    };
    img.src = inputPreview;
  }, [inputPreview]);

  useEffect(() => {
    return () => {
      if (lastObjectUrlRef.current) {
        URL.revokeObjectURL(lastObjectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mode === "basic") {
      setLoading(false);
      setMetrics(null);
      setResultImage(null);
    }
  }, [mode]);

  const getCanvasXY = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);

    return {
      x: clamp(x, 0, canvas.width),
      y: clamp(y, 0, canvas.height),
    };
  };

  const redrawWithCropOverlay = () => {
    if (historyRef.current.length === 0) return;
    loadDataUrlToCanvas(historyRef.current[historyRef.current.length - 1], true);
  };

  const onCanvasMouseDown = (e) => {
    if (!inputPreview) return;
    const { x, y } = getCanvasXY(e);
    const ctx = getCtx();
    if (!ctx) return;

    if (eraserEnabled) {
      drawStateRef.current.drawing = true;
      drawStateRef.current.hasSavedStart = false;

      pushHistoryFromCanvas();
      drawStateRef.current.hasSavedStart = true;

      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, brushSize / 2), 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.restore();
      return;
    }

    if (mode === "basic" && task === "Add Text") {
      if (!textValue.trim()) {
        alert("Type text first, then click on the image to place it.");
        return;
      }

      ctx.save();
      ctx.font = `bold ${textSize}px Arial`;
      ctx.fillStyle = textColor;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 2;
      ctx.strokeText(textValue, x, y);
      ctx.fillText(textValue, x, y);
      ctx.restore();

      pushHistoryFromCanvas();
      return;
    }

    if (mode === "basic" && task === "Free Draw") {
      drawStateRef.current.drawing = true;
      drawStateRef.current.hasSavedStart = false;

      pushHistoryFromCanvas();
      drawStateRef.current.hasSavedStart = true;

      ctx.save();
      ctx.fillStyle = brushColor;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, brushSize / 2), 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.restore();
      return;
    }

    if (mode === "basic" && task === "Crop") {
      cropStateRef.current.dragging = true;
      cropStateRef.current.active = true;
      cropStateRef.current.startX = x;
      cropStateRef.current.startY = y;
      cropStateRef.current.endX = x;
      cropStateRef.current.endY = y;
      redrawWithCropOverlay();
    }
  };

  const onCanvasMouseMove = (e) => {
    if (!inputPreview) return;
    const { x, y } = getCanvasXY(e);
    const ctx = getCtx();
    if (!ctx) return;

    if (eraserEnabled && drawStateRef.current.drawing) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.restore();
      return;
    }

    if (mode === "basic" && task === "Free Draw" && drawStateRef.current.drawing) {
      ctx.save();
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.restore();
      return;
    }

    if (mode === "basic" && task === "Crop" && cropStateRef.current.dragging) {
      cropStateRef.current.endX = x;
      cropStateRef.current.endY = y;
      redrawWithCropOverlay();
    }
  };

  const onCanvasMouseUp = () => {
    if (drawStateRef.current.drawing) {
      drawStateRef.current.drawing = false;

      if (drawStateRef.current.hasSavedStart) {
        pushHistoryFromCanvas();
      }

      drawStateRef.current.hasSavedStart = false;
    }

    if (cropStateRef.current.dragging) {
      cropStateRef.current.dragging = false;
      redrawWithCropOverlay();
    }
  };

  const applyCrop = () => {
    const s = cropStateRef.current;
    if (!s.active) {
      alert("Drag on the image to select crop area first.");
      return;
    }

    const x = Math.min(s.startX, s.endX);
    const y = Math.min(s.startY, s.endY);
    const w = Math.abs(s.endX - s.startX);
    const h = Math.abs(s.endY - s.startY);

    if (w < 5 || h < 5) {
      alert("Crop area too small.");
      return;
    }

    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas || historyRef.current.length === 0) return;

    const baseImg = new Image();
    baseImg.onload = () => {
      const tmp = document.createElement("canvas");
      tmp.width = CANVAS_W;
      tmp.height = CANVAS_H;

      const tmpCtx = tmp.getContext("2d");
      if (!tmpCtx) return;

      drawContain(tmpCtx, baseImg, { clear: true });
      const cropped = tmpCtx.getImageData(x, y, w, h);

      const tmp2 = document.createElement("canvas");
      tmp2.width = w;
      tmp2.height = h;
      const tmp2Ctx = tmp2.getContext("2d");
      if (!tmp2Ctx) return;

      tmp2Ctx.putImageData(cropped, 0, 0);

      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      const scale = Math.min(CANVAS_W / w, CANVAS_H / h);
      const drawW = w * scale;
      const drawH = h * scale;
      const offX = (CANVAS_W - drawW) / 2;
      const offY = (CANVAS_H - drawH) / 2;

      ctx.drawImage(tmp2, offX, offY, drawW, drawH);

      clearCropState();
      pushHistoryFromCanvas();
    };
    baseImg.src = historyRef.current[historyRef.current.length - 1];
  };

  const applySharpness = (imageData, amount = 1) => {
    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);

    const centerBoost = 5 + amount;
    const kernel = [
      0, -1, 0,
      -1, centerBoost, -1,
      0, -1, 0,
    ];

    const getIndex = (x, y) => (y * width + x) * 4;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          let k = 0;

          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const px = x + kx;
              const py = y + ky;
              const idx = getIndex(px, py);
              sum += data[idx + c] * kernel[k++];
            }
          }

          const outIdx = getIndex(x, y);
          output[outIdx + c] = Math.max(0, Math.min(255, sum));
        }

        const alphaIdx = getIndex(x, y) + 3;
        output[alphaIdx] = data[alphaIdx];
      }
    }

    return new ImageData(output, width, height);
  };

  const applyBrightnessContrast = () => {
    if (historyRef.current.length === 0) return;

    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      drawContain(ctx, img, { clear: false });
      ctx.filter = "none";

      if (sharpness > 0) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const sharpened = applySharpness(imageData, sharpness);
        ctx.putImageData(sharpened, 0, 0);
      }

      pushHistoryFromCanvas();
    };
    img.src = historyRef.current[historyRef.current.length - 1];
  };

  const applyBlur = () => {
    if (historyRef.current.length === 0) return;

    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.filter = `blur(${blurAmount}px)`;
      drawContain(ctx, img, { clear: false });
      ctx.filter = "none";
      pushHistoryFromCanvas();
    };
    img.src = historyRef.current[historyRef.current.length - 1];
  };

  const applyResizeBasic = () => {
    if (historyRef.current.length === 0) return;
    if (resizeWidth <= 0 || resizeHeight <= 0) {
      alert("Width and height must be greater than 0.");
      return;
    }

    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const img = new Image();
    img.onload = () => {
      const tmp = document.createElement("canvas");
      tmp.width = resizeWidth;
      tmp.height = resizeHeight;

      const tmpCtx = tmp.getContext("2d");
      if (!tmpCtx) return;

      tmpCtx.drawImage(img, 0, 0, resizeWidth, resizeHeight);

      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      drawContain(ctx, tmp, { clear: false });
      pushHistoryFromCanvas();
    };
    img.src = historyRef.current[historyRef.current.length - 1];
  };

  const applyRotateBasic = () => {
    if (historyRef.current.length === 0) return;

    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const img = new Image();
    img.onload = () => {
      const temp = document.createElement("canvas");
      temp.width = CANVAS_W;
      temp.height = CANVAS_H;
      const tctx = temp.getContext("2d");
      if (!tctx) return;

      tctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      tctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);

      const imageData = tctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
      const { data, width, height } = imageData;

      let minX = width, minY = height, maxX = -1, maxY = -1;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          const isBackground = a === 0 || (r > 245 && g > 245 && b > 245);

          if (!isBackground) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX < minX || maxY < minY) {
        alert("No visible image area found to rotate.");
        return;
      }

      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext("2d");
      if (!cropCtx) return;

      cropCtx.drawImage(temp, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const rad = (rotateAngle * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));

      const rotatedBoxW = cropW * cos + cropH * sin;
      const rotatedBoxH = cropW * sin + cropH * cos;

      const fitScale = Math.min(CANVAS_W / rotatedBoxW, CANVAS_H / rotatedBoxH, 1);

      ctx.save();
      ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
      ctx.rotate(rad);
      ctx.scale(fitScale, fitScale);
      ctx.drawImage(cropCanvas, -cropW / 2, -cropH / 2, cropW, cropH);
      ctx.restore();

      pushHistoryFromCanvas();
    };

    img.src = historyRef.current[historyRef.current.length - 1];
  };

  const applyMaskBasic = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const x = clamp(maskX, 0, canvas.width);
    const y = clamp(maskY, 0, canvas.height);
    const w = Math.max(1, maskWidth);
    const h = Math.max(1, maskHeight);

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    pushHistoryFromCanvas();
  };

  const applyLayerBasic = () => {
    if (!overlayFile) {
      alert("Please choose an overlay image.");
      return;
    }

    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const overlayImg = new Image();
    const url = URL.createObjectURL(overlayFile);

    overlayImg.onload = () => {
      drawContain(ctx, overlayImg, {
        clear: false,
        alpha: layerAlpha,
      });

      URL.revokeObjectURL(url);
      pushHistoryFromCanvas();
    };

    overlayImg.onerror = () => {
      URL.revokeObjectURL(url);
      alert("Failed to load overlay image.");
    };

    overlayImg.src = url;
  };

  const applyCloneBasic = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    try {
      const safeSrcX = clamp(srcX, 0, canvas.width - 1);
      const safeSrcY = clamp(srcY, 0, canvas.height - 1);
      const safeSrcW = clamp(srcW, 1, canvas.width - safeSrcX);
      const safeSrcH = clamp(srcH, 1, canvas.height - safeSrcY);
      const safeDstX = clamp(dstX, 0, canvas.width - safeSrcW);
      const safeDstY = clamp(dstY, 0, canvas.height - safeSrcH);

      const imageData = ctx.getImageData(safeSrcX, safeSrcY, safeSrcW, safeSrcH);
      ctx.putImageData(imageData, safeDstX, safeDstY);
      pushHistoryFromCanvas();
    } catch (err) {
      console.error(err);
      alert("Clone failed. Check source/destination values.");
    }
  };

  const toggleEraser = () => {
    setEraserEnabled((prev) => !prev);
  };

  const applyAI = async () => {
    if (!inputPreview) {
      alert("Upload an image first.");
      return;
    }

    setLoading(true);
    setResultImage(null);
    setMetrics(null);

    try {
      const uploadFile = await canvasToFile();
      if (!uploadFile) throw new Error("Could not export canvas.");

      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("task", task);
      formData.append("strength", String(strength));

      if (task === "Resize Image") {
        formData.append("width", String(resizeWidth));
        formData.append("height", String(resizeHeight));
      }

      if (task === "Rotate Image") {
        formData.append("angle", String(rotateAngle));
      }

      if (task === "Masking") {
        formData.append("x", String(maskX));
        formData.append("y", String(maskY));
        formData.append("mask_width", String(maskWidth));
        formData.append("mask_height", String(maskHeight));
      }

      if (task === "Layer Management") {
        if (!overlayFile) {
          alert("Please choose an overlay image.");
          setLoading(false);
          return;
        }
        formData.append("overlay_file", overlayFile);
        formData.append("alpha", String(layerAlpha));
      }

      if (task === "Clone Tool") {
        formData.append("src_x", String(srcX));
        formData.append("src_y", String(srcY));
        formData.append("src_w", String(srcW));
        formData.append("src_h", String(srcH));
        formData.append("dst_x", String(dstX));
        formData.append("dst_y", String(dstY));
      }

      const res = await axios.post(API_URL, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 120000,
      });

      let b64 = res.data?.image;

      if (!b64) {
        alert(res.data?.error || "Backend did not return an image.");
        return;
      }

      if (!String(b64).startsWith("data:image")) {
        b64 = `data:image/png;base64,${b64}`;
      }

      setResultImage(b64);
      setMetrics({
        psnr: res.data?.psnr ?? "N/A",
        ssim: res.data?.ssim ?? "N/A",
        time: res.data?.time ?? "N/A",
      });

      clearCropState();
    } catch (err) {
      console.error(err);
      const backendError = err?.response?.data?.error;
      alert(
        backendError ||
          `AI processing failed. Make sure backend is running at ${API_URL}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.layout}>
      <div style={styles.sidebar}>
        {imgInfo ? (
          <div
            style={{
              marginBottom: "16px",
              fontSize: "13px",
              color: "#aee",
              lineHeight: "1.8",
            }}
          >
            <div style={styles.subTitle}>📄 Image Details</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#7bc" }}>Name</span>
              <span
                style={{
                  wordBreak: "break-all",
                  maxWidth: "140px",
                  textAlign: "right",
                }}
              >
                {imgInfo.name}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#7bc" }}>Resolution</span>
              <span>
                {imgInfo.w} × {imgInfo.h} px
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#7bc" }}>Format</span>
              <span>{imgInfo.format}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#7bc" }}>Size</span>
              <span>{imgInfo.size}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#7bc" }}>Aspect Ratio</span>
              <span>{imgInfo.aspect}</span>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: "16px", fontSize: "13px", color: "#556" }}>
            📄 Upload an image to see details
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <div style={styles.subTitle}>Brightness / Contrast</div>

          <label style={styles.label}>Brightness: {brightness}%</label>
          <input
            type="range"
            min="10"
            max="200"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            style={{ width: "100%", marginBottom: "8px" }}
          />

          <label style={styles.label}>Contrast: {contrast}%</label>
          <input
            type="range"
            min="10"
            max="200"
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
            style={{ width: "100%", marginBottom: "8px" }}
          />

          <label style={styles.label}>Saturation: {saturation}%</label>
          <input
            type="range"
            min="0"
            max="200"
            value={saturation}
            onChange={(e) => setSaturation(Number(e.target.value))}
            style={{ width: "100%", marginBottom: "8px" }}
          />

          <label style={styles.label}>Sharpness: {sharpness}</label>
          <input
            type="range"
            min="0"
            max="5"
            step="1"
            value={sharpness}
            onChange={(e) => setSharpness(Number(e.target.value))}
            style={{ width: "100%", marginBottom: "8px" }}
          />

          <button
            style={{ ...styles.button, width: "100%" }}
            onClick={applyBrightnessContrast}
            disabled={!inputPreview}
          >
            Apply
          </button>
        </div>

        <h2>Mode Selection</h2>

        <div style={styles.section}>
          <label style={{ display: "block", marginBottom: "4px" }}>
            <input
              type="radio"
              checked={mode === "basic"}
              onChange={() => {
                setMode("basic");
                setTask("Crop");
              }}
            />{" "}
            Basic Editing
          </label>

          <label>
            <input
              type="radio"
              checked={mode === "ai"}
              onChange={() => {
                setMode("ai");
                setTask("Enhance");
              }}
            />{" "}
            AI / Advanced Editing
          </label>
        </div>

        {mode === "basic" && (
          <>
            <h3>Basic Editing</h3>

            <select
              value={task}
              onChange={(e) => setTask(e.target.value)}
              style={styles.input}
            >
              <option>Crop</option>
              <option>Add Text</option>
              <option>Free Draw</option>
              <option>Blur</option>
              <option>Resize Image</option>
              <option>Rotate Image</option>
              <option>Masking</option>
              <option>Layer Management</option>
              <option>Clone Tool</option>
            </select>

            {task === "Crop" && (
              <div style={styles.section}>
                <div style={styles.hint}>Drag on the image to select.</div>
                <button
                  style={{ ...styles.button, width: "100%" }}
                  onClick={applyCrop}
                >
                  Apply Crop
                </button>
              </div>
            )}

            {task === "Add Text" && (
              <div style={styles.section}>
                <label style={styles.label}>Text</label>
                <input
                  style={styles.input}
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder="Type text, then click on image..."
                />

                <label style={styles.label}>Size: {textSize}px</label>
                <input
                  type="range"
                  min="10"
                  max="120"
                  value={textSize}
                  onChange={(e) => setTextSize(Number(e.target.value))}
                  style={{ width: "100%" }}
                />

                <label style={styles.label}>Color</label>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                />

                <div style={styles.hint}>Click on the image to place the text.</div>
              </div>
            )}

            {task === "Free Draw" && (
              <div style={styles.section}>
                <div style={styles.hint}>Drag on the image to draw.</div>

                <label style={styles.label}>Brush size: {brushSize}</label>
                <input
                  type="range"
                  min="1"
                  max="40"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  style={{ width: "100%" }}
                />

                <label style={styles.label}>Brush color</label>
                <input
                  type="color"
                  value={brushColor}
                  onChange={(e) => setBrushColor(e.target.value)}
                />
              </div>
            )}

            {task === "Blur" && (
              <div style={styles.section}>
                <label style={styles.label}>Blur: {blurAmount}px</label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={blurAmount}
                  onChange={(e) => setBlurAmount(Number(e.target.value))}
                  style={{ width: "100%" }}
                />

                <button
                  style={{ ...styles.button, width: "100%" }}
                  onClick={applyBlur}
                >
                  Apply Blur
                </button>
              </div>
            )}

            {task === "Resize Image" && (
              <div style={styles.section}>
                <div style={styles.row2}>
                  <div>
                    <label style={styles.label}>Width</label>
                    <input
                      type="number"
                      value={resizeWidth}
                      onChange={(e) => setResizeWidth(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Height</label>
                    <input
                      type="number"
                      value={resizeHeight}
                      onChange={(e) => setResizeHeight(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                </div>

                <button
                  style={{ ...styles.button, width: "100%" }}
                  onClick={applyResizeBasic}
                >
                  Apply Resize
                </button>
              </div>
            )}

            {task === "Rotate Image" && (
              <div style={styles.section}>
                <label style={styles.label}>Angle: {rotateAngle}°</label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={rotateAngle}
                  onChange={(e) => setRotateAngle(Number(e.target.value))}
                  style={{ width: "100%" }}
                />

                <button
                  style={{ ...styles.button, width: "100%" }}
                  onClick={applyRotateBasic}
                >
                  Apply Rotate
                </button>
              </div>
            )}

            {task === "Masking" && (
              <div style={styles.section}>
                <div style={styles.row2}>
                  <div>
                    <label style={styles.label}>X</label>
                    <input
                      type="number"
                      value={maskX}
                      onChange={(e) => setMaskX(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Y</label>
                    <input
                      type="number"
                      value={maskY}
                      onChange={(e) => setMaskY(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Width</label>
                    <input
                      type="number"
                      value={maskWidth}
                      onChange={(e) => setMaskWidth(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Height</label>
                    <input
                      type="number"
                      value={maskHeight}
                      onChange={(e) => setMaskHeight(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                </div>

                <button
                  style={{ ...styles.button, width: "100%" }}
                  onClick={applyMaskBasic}
                >
                  Apply Mask
                </button>
              </div>
            )}

            {task === "Layer Management" && (
              <div style={styles.section}>
                <label style={styles.label}>Overlay Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setOverlayFile(e.target.files?.[0] || null)}
                  style={styles.input}
                />

                <label style={styles.label}>Alpha: {layerAlpha}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={layerAlpha}
                  onChange={(e) => setLayerAlpha(parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />

                <button
                  style={{ ...styles.button, width: "100%" }}
                  onClick={applyLayerBasic}
                >
                  Apply Layer
                </button>
              </div>
            )}

            {task === "Clone Tool" && (
              <div style={styles.section}>
                <div style={styles.row2}>
                  <div>
                    <label style={styles.label}>Src X</label>
                    <input
                      type="number"
                      value={srcX}
                      onChange={(e) => setSrcX(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Src Y</label>
                    <input
                      type="number"
                      value={srcY}
                      onChange={(e) => setSrcY(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Src W</label>
                    <input
                      type="number"
                      value={srcW}
                      onChange={(e) => setSrcW(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Src H</label>
                    <input
                      type="number"
                      value={srcH}
                      onChange={(e) => setSrcH(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Dst X</label>
                    <input
                      type="number"
                      value={dstX}
                      onChange={(e) => setDstX(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Dst Y</label>
                    <input
                      type="number"
                      value={dstY}
                      onChange={(e) => setDstY(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                </div>

                <button
                  style={{ ...styles.button, width: "100%" }}
                  onClick={applyCloneBasic}
                >
                  Apply Clone
                </button>
              </div>
            )}
          </>
        )}

        {mode === "ai" && (
          <>
            <h3>AI / Advanced Editing</h3>

            <select
              value={task}
              onChange={(e) => setTask(e.target.value)}
              style={styles.input}
            >
              <option>Enhance</option>
              <option>Denoise</option>
              <option>Background Removal</option>
              <option>Color Correction</option>
              <option>Super Resolution</option>
              <option>Edge Enhance</option>
              <option>Resize Image</option>
              <option>Rotate Image</option>
              <option>Masking</option>
              <option>Layer Management</option>
              <option>Clone Tool</option>
            </select>

            {[
              "Enhance",
              "Denoise",
              "Color Correction",
              "Super Resolution",
              "Edge Enhance",
              "Resize Image",
              "Rotate Image",
              "Masking",
              "Layer Management",
              "Clone Tool",
            ].includes(task) && (
              <>
                <label style={styles.label}>Strength: {strength}</label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={strength}
                  onChange={(e) => setStrength(parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />
              </>
            )}

            {task === "Resize Image" && (
              <div style={styles.section}>
                <div style={styles.row2}>
                  <div>
                    <label style={styles.label}>Width</label>
                    <input
                      type="number"
                      value={resizeWidth}
                      onChange={(e) => setResizeWidth(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Height</label>
                    <input
                      type="number"
                      value={resizeHeight}
                      onChange={(e) => setResizeHeight(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                </div>
              </div>
            )}

            {task === "Rotate Image" && (
              <div style={styles.section}>
                <label style={styles.label}>Angle: {rotateAngle}°</label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={rotateAngle}
                  onChange={(e) => setRotateAngle(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            )}

            {task === "Masking" && (
              <div style={styles.section}>
                <div style={styles.row2}>
                  <div>
                    <label style={styles.label}>X</label>
                    <input
                      type="number"
                      value={maskX}
                      onChange={(e) => setMaskX(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Y</label>
                    <input
                      type="number"
                      value={maskY}
                      onChange={(e) => setMaskY(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Width</label>
                    <input
                      type="number"
                      value={maskWidth}
                      onChange={(e) => setMaskWidth(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Height</label>
                    <input
                      type="number"
                      value={maskHeight}
                      onChange={(e) => setMaskHeight(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                </div>
              </div>
            )}

            {task === "Layer Management" && (
              <div style={styles.section}>
                <label style={styles.label}>Overlay Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setOverlayFile(e.target.files?.[0] || null)}
                  style={styles.input}
                />

                <label style={styles.label}>Alpha: {layerAlpha}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={layerAlpha}
                  onChange={(e) => setLayerAlpha(parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            )}

            {task === "Clone Tool" && (
              <div style={styles.section}>
                <div style={styles.row2}>
                  <div>
                    <label style={styles.label}>Src X</label>
                    <input
                      type="number"
                      value={srcX}
                      onChange={(e) => setSrcX(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Src Y</label>
                    <input
                      type="number"
                      value={srcY}
                      onChange={(e) => setSrcY(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Src W</label>
                    <input
                      type="number"
                      value={srcW}
                      onChange={(e) => setSrcW(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Src H</label>
                    <input
                      type="number"
                      value={srcH}
                      onChange={(e) => setSrcH(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Dst X</label>
                    <input
                      type="number"
                      value={dstX}
                      onChange={(e) => setDstX(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Dst Y</label>
                    <input
                      type="number"
                      value={dstY}
                      onChange={(e) => setDstY(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              style={{ ...styles.button, marginTop: "10px", width: "100%" }}
              onClick={applyAI}
              disabled={loading || !inputPreview}
            >
              {loading ? "Processing..." : "Apply AI"}
            </button>
          </>
        )}
      </div>

      <div style={styles.main}>
        <h1>AI IMAGE EDITOR</h1>

        <div style={styles.topBar}>
          <button style={styles.button} onClick={undo} disabled={history.length <= 1}>
            ↩ Undo
          </button>

          <button style={styles.button} onClick={redo} disabled={redoStack.length === 0}>
            ↪ Redo
          </button>

          <button
            style={eraserEnabled ? styles.buttonSecondary : styles.button}
            onClick={toggleEraser}
            disabled={!inputPreview}
          >
            {eraserEnabled ? "🧽 Eraser On" : "🧽 Eraser"}
          </button>

          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            style={{ ...styles.input, width: "130px", marginTop: 0 }}
            disabled={!inputPreview || downloading}
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="bmp">BMP</option>
            <option value="tiff">TIFF</option>
          </select>

          {(exportFormat === "jpeg" || exportFormat === "jpg") && (
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={jpegQuality}
              onChange={(e) => setJpegQuality(Number(e.target.value))}
              style={{ width: "120px" }}
              title={`JPEG Quality: ${jpegQuality}`}
            />
          )}

          <button
            style={styles.button}
            onClick={downloadImage}
            disabled={!inputPreview || downloading}
          >
            {downloading ? "⏳ Exporting..." : "⬇ Download"}
          </button>
        </div>

        <div style={styles.uploadBox}>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            onClick={(e) => {
              e.target.value = null;
            }}
          />
        </div>

        {inputPreview && (
          <>
            {mode === "ai" ? (
              <div style={styles.imageRow}>
                <div style={styles.imageContainer}>
                  <div style={styles.canvasWrap}>
                    <canvas
                      ref={canvasRef}
                      style={styles.canvas}
                      onMouseDown={onCanvasMouseDown}
                      onMouseMove={onCanvasMouseMove}
                      onMouseUp={onCanvasMouseUp}
                      onMouseLeave={onCanvasMouseUp}
                    />
                  </div>
                  <p style={styles.imageLabel}>📷 Original / Working Canvas</p>
                </div>

                <div style={styles.imageContainer}>
                  {resultImage ? (
                    <>
                      <img
                        src={resultImage}
                        style={styles.image}
                        alt="AI Result"
                        onError={(e) => {
                          console.log("Result image load error");
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      <p style={styles.imageLabel}>🖼 Output Image</p>
                    </>
                  ) : (
                    !loading && (
                      <div
                        style={{
                          width: 400,
                          height: 400,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px dashed rgba(255,255,255,0.3)",
                          borderRadius: 8,
                          color: "#bcd",
                        }}
                      >
                        No output yet
                      </div>
                    )
                  )}

                  {loading && <div style={styles.loadingBadge}>⏳ Running...</div>}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: "20px" }}>
                <div style={styles.canvasWrap}>
                  <canvas
                    ref={canvasRef}
                    style={styles.canvas}
                    onMouseDown={onCanvasMouseDown}
                    onMouseMove={onCanvasMouseMove}
                    onMouseUp={onCanvasMouseUp}
                    onMouseLeave={onCanvasMouseUp}
                  />
                </div>
                <p style={styles.imageLabel}>📷 Original / Working Canvas</p>
              </div>
            )}
          </>
        )}

        {mode === "ai" && resultImage && metrics && (
          <div style={styles.metricsInline}>
            <span>PSNR: {metrics.psnr} dB</span>
            <span>SSIM: {metrics.ssim}</span>
            <span>Time: {metrics.time} sec</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;