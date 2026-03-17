import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

function App() {
  const canvasRef = useRef(null);

  const [inputPreview, setInputPreview] = useState(null);

  // AI output only
  const [resultImage, setResultImage] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState("basic");
  const [task, setTask] = useState("Crop");

  // AI params
  const [strength, setStrength] = useState(1.0);

  // Basic sliders
  const [brightness, setBrightness] = useState(100);
  const [contrast,   setContrast]   = useState(100);
  const [blurAmount, setBlurAmount] = useState(0);

  // Image info
  const [imgInfo, setImgInfo] = useState(null);

  // Text tool
  const [textValue, setTextValue] = useState("");
  const [textSize, setTextSize] = useState(30);
  const [textColor, setTextColor] = useState("#ffffff");

  // Draw tool
  const [brushSize, setBrushSize] = useState(8);
  const [brushColor, setBrushColor] = useState("#ff3b3b");

  // Undo/redo store full canvas snapshots
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const CANVAS_W = 400;
  const CANVAS_H = 400;

  // Crop state
  const cropStateRef = useRef({
    dragging: false,
    active: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });

  // Draw state
  const drawStateRef = useRef({ drawing: false });

  const API_URL = "http://127.0.0.1:8000/process/";

  const styles = {
    layout: { display: "flex", height: "100vh", fontFamily: "Arial, sans-serif" },
    sidebar: { width: "290px", padding: "20px", background: "#0f2d3a", color: "white", overflowY: "auto" },
    main: { flex: 1, padding: "30px", textAlign: "center", background: "#1f3b4d", color: "white", overflowY: "auto" },
    section: { marginBottom: "15px" },
    button: { padding: "8px 12px", marginTop: "5px", cursor: "pointer", background: "#1a8a6e", color: "white", border: "none", borderRadius: "4px" },
    input: { width: "100%", padding: "5px", boxSizing: "border-box" },
    uploadBox: { border: "2px dashed white", padding: "20px", marginBottom: "20px" },
    image: { maxWidth: "400px", maxHeight: "400px", objectFit: "contain" },
    imageRow: { display: "flex", justifyContent: "center", gap: "30px", marginTop: "20px", flexWrap: "wrap" },
    imageContainer: { textAlign: "center" },
    imageLabel: { marginTop: "6px", fontSize: "14px", color: "#cce" },
    topBar: { display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap", justifyContent: "center" },
    metricsInline: {
      display: "flex", gap: "24px", justifyContent: "center", marginTop: "14px",
      background: "#0f2d3a", padding: "10px 20px", borderRadius: "8px",
      fontSize: "14px", fontWeight: "bold", color: "#7ef7c8",
    },
    label: { display: "block", marginTop: "8px", fontSize: "13px" },
    loadingBadge: { display: "inline-block", padding: "6px 14px", background: "#e8a838", borderRadius: "4px", color: "#000", fontWeight: "bold", marginTop: "10px" },
    hint: { fontSize: 12, color: "#bcd", marginTop: 6, lineHeight: 1.3 },
    canvasWrap: { position: "relative", display: "inline-block" },
    // ✅ FIX: NO width/height here — let the canvas element control its own size
    canvas: {
      display: "block",
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.15)",
      cursor: "crosshair",
      maxWidth: "400px",
      maxHeight: "400px",
    },
  };

  const getCtx = () => canvasRef.current?.getContext("2d");

  // Draw image "contain" into the fixed canvas
  const drawContain = (ctx, img) => {
    const W = CANVAS_W;
    const H = CANVAS_H;
    ctx.clearRect(0, 0, W, H);
    const scale = Math.min(W / img.width, H / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const offX = (W - drawW) / 2;
    const offY = (H - drawH) / 2;
    ctx.drawImage(img, offX, offY, drawW, drawH);
  };

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHistory((prev) => [...prev, canvas.toDataURL("image/png")]);
    setRedoStack([]);
  };

  const restoreFromDataURL = (dataURL) => {
    const img = new Image();
    img.src = dataURL;
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx) return;
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      drawContain(ctx, img);
    };
  };

  const undo = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    const last = newHistory.pop();
    setRedoStack((prev) => [...prev, last]);
    setHistory(newHistory);
    restoreFromDataURL(newHistory[newHistory.length - 1]);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setHistory((prev) => [...prev, last]);
    restoreFromDataURL(last);
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "edited-image.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const canvasToFile = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null);
        resolve(new File([blob], "canvas.png", { type: "image/png" }));
      }, "image/png");
    });
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setResultImage(null);
    setMetrics(null);
    // store file info for display
    const sizeKB = (selected.size / 1024).toFixed(1);
    const img = new Image();
    const url = URL.createObjectURL(selected);
    img.onload = () => {
      const fmt = selected.type.replace('image/', '').toUpperCase();
      const sizeMB = selected.size >= 1024 * 1024 ? (selected.size / (1024*1024)).toFixed(2) + ' MB' : sizeKB + ' KB';
      const aspect = (() => { const g = (a,b) => b ? g(b, a%b) : a; const gc = g(img.naturalWidth, img.naturalHeight); return (img.naturalWidth/gc) + ':' + (img.naturalHeight/gc); })();
      setImgInfo({ name: selected.name, w: img.naturalWidth, h: img.naturalHeight, size: sizeMB, format: fmt, aspect });
      URL.revokeObjectURL(url);
    };
    img.src = url;
    const reader = new FileReader();
    reader.onload = () => setInputPreview(reader.result);
    reader.readAsDataURL(selected);
  };

  // ✅ FIX: Load image into canvas properly
  useEffect(() => {
    if (!inputPreview) return;
    const img = new Image();
    img.src = inputPreview;
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx) return;

      // Set actual canvas resolution to fixed size
      canvas.width  = CANVAS_W;
      canvas.height = CANVAS_H;

      drawContain(ctx, img);

      const first = canvas.toDataURL("image/png");
      setHistory([first]);
      setRedoStack([]);
      cropStateRef.current.active   = false;
      cropStateRef.current.dragging = false;
    };
  }, [inputPreview]);

  // Mouse → canvas coords (works correctly because canvas size = CANVAS_W x CANVAS_H)
  const getCanvasXY = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left)  / rect.width)  * canvas.width);
    const y = Math.round(((e.clientY - rect.top)   / rect.height) * canvas.height);
    return { x, y };
  };

  const redrawWithCropOverlay = () => {
    if (history.length === 0) return;
    restoreFromDataURL(history[history.length - 1]);
    setTimeout(() => {
      const ctx = getCtx();
      if (!ctx) return;
      const s = cropStateRef.current;
      if (!s.active && !s.dragging) return;
      const x = Math.min(s.startX, s.endX);
      const y = Math.min(s.startY, s.endY);
      const w = Math.abs(s.endX - s.startX);
      const h = Math.abs(s.endY - s.startY);
      ctx.save();
      ctx.strokeStyle = "rgba(0,255,255,0.95)";
      ctx.lineWidth   = 3;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "rgba(0,255,255,0.08)";
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }, 0);
  };

  // Canvas interactions
  const onCanvasMouseDown = (e) => {
    if (!inputPreview) return;
    const { x, y } = getCanvasXY(e);

    if (mode === "basic" && task === "Add Text") {
      if (!textValue.trim()) { alert("Type text first, then click on image to place it."); return; }
      const ctx = getCtx();
      if (!ctx) return;
      saveState();
      ctx.font        = `bold ${textSize}px Arial`;
      ctx.fillStyle   = textColor;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth   = 2;
      ctx.strokeText(textValue, x, y);
      ctx.fillText(textValue, x, y);
      saveState();
      return;
    }

    if (mode === "basic" && task === "Free Draw") {
      const ctx = getCtx();
      if (!ctx) return;
      drawStateRef.current.drawing = true;
      saveState();
      ctx.beginPath();
      ctx.moveTo(x, y);
      return;
    }

    if (mode === "basic" && task === "Crop") {
      cropStateRef.current.dragging = true;
      cropStateRef.current.active   = true;
      cropStateRef.current.startX   = x;
      cropStateRef.current.startY   = y;
      cropStateRef.current.endX     = x;
      cropStateRef.current.endY     = y;
      redrawWithCropOverlay();
      return;
    }
  };

  const onCanvasMouseMove = (e) => {
    if (!inputPreview) return;
    const { x, y } = getCanvasXY(e);

    if (mode === "basic" && task === "Free Draw" && drawStateRef.current.drawing) {
      const ctx = getCtx();
      if (!ctx) return;
      ctx.strokeStyle = brushColor;
      ctx.lineWidth   = brushSize;
      ctx.lineCap     = "round";
      ctx.lineJoin    = "round";
      ctx.lineTo(x, y);
      ctx.stroke();
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
      saveState();
    }
    if (cropStateRef.current.dragging) {
      cropStateRef.current.dragging = false;
      redrawWithCropOverlay();
    }
  };

  const applyCrop = () => {
    const s = cropStateRef.current;
    if (!s.active) return alert("Drag on the image to select crop area first.");
    const x = Math.min(s.startX, s.endX);
    const y = Math.min(s.startY, s.endY);
    const w = Math.abs(s.endX - s.startX);
    const h = Math.abs(s.endY - s.startY);
    if (w < 5 || h < 5) return alert("Crop area too small.");

    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    // Read clean pixels from last history snapshot (no overlay)
    const baseImg = new Image();
    baseImg.src = history[history.length - 1];
    baseImg.onload = () => {
      const tmp = document.createElement("canvas");
      tmp.width  = CANVAS_W;
      tmp.height = CANVAS_H;
      drawContain(tmp.getContext("2d"), baseImg);
      const cropped = tmp.getContext("2d").getImageData(x, y, w, h);

      canvas.width  = CANVAS_W;
      canvas.height = CANVAS_H;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      const tmp2 = document.createElement("canvas");
      tmp2.width  = w;
      tmp2.height = h;
      tmp2.getContext("2d").putImageData(cropped, 0, 0);

      const scale = Math.min(CANVAS_W / w, CANVAS_H / h);
      const drawW = w * scale;
      const drawH = h * scale;
      const offX  = (CANVAS_W - drawW) / 2;
      const offY  = (CANVAS_H - drawH) / 2;
      ctx.drawImage(tmp2, offX, offY, drawW, drawH);

      cropStateRef.current.active   = false;
      cropStateRef.current.dragging = false;
      saveState();
    };
  };

  const applyBrightness = () => {
    if (history.length === 0) return;
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const img = new Image();
    img.src = history[history.length - 1];
    img.onload = () => {
      canvas.width  = CANVAS_W;
      canvas.height = CANVAS_H;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      drawContain(ctx, img);
      ctx.filter = "none";
      saveState();
    };
  };

  const applyBlur = () => {
    if (history.length === 0) return;
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const img = new Image();
    img.src = history[history.length - 1];
    img.onload = () => {
      canvas.width  = CANVAS_W;
      canvas.height = CANVAS_H;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.filter = `blur(${blurAmount}px)`;
      drawContain(ctx, img);
      ctx.filter = "none";
      saveState();
    };
  };

  const enableEraser = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    let drawing = false;
    canvas.style.cursor = "crosshair";
    canvas.onmousedown = (e) => { drawing = true; saveState(); const { x, y } = getCanvasXY(e); ctx.beginPath(); ctx.moveTo(x, y); };
    canvas.onmouseup   = () => { drawing = false; ctx.beginPath(); saveState(); };
    canvas.onmousemove = (e) => {
      if (!drawing) return;
      const { x, y } = getCanvasXY(e);
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 20;
      ctx.lineCap   = "round";
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
    };
  };

  const applyAI = async () => {
    if (!inputPreview) return alert("Upload an image first");
    setLoading(true);
    setResultImage(null);
    setMetrics(null);
    try {
      const uploadFile = await canvasToFile();
      if (!uploadFile) throw new Error("Could not export canvas");
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("task", task);
      formData.append("strength", strength);
      const res = await axios.post(API_URL, formData);
      let b64 = res.data?.image;
      if (!b64) { alert("Backend did not return an image"); return; }
      if (!b64.startsWith("data:image")) b64 = `data:image/png;base64,${b64}`;
      setResultImage(b64);
      setMetrics({ psnr: res.data.psnr, ssim: res.data.ssim, time: res.data.time });
    } catch (err) {
      console.error(err);
      alert("AI processing failed. Make sure backend is running at http://127.0.0.1:8000");
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIX: was setLoading(true) — should be setLoading(false)
  useEffect(() => {
    if (mode === "basic") {
      setLoading(false);
      setMetrics(null);
    }
  }, [mode]);

  return (
    <div style={styles.layout}>
      <div style={styles.sidebar}>

        {/* ── Image Details ── */}
        {imgInfo ? (
          <div style={{ marginBottom: "16px", fontSize: "13px", color: "#aee", lineHeight: "1.8" }}>
            <div style={{ fontWeight: "bold", color: "#7ef7c8", marginBottom: "6px", fontSize: "13px" }}>📄 Image Details</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{color:"#7bc"}}>Name</span><span style={{wordBreak:"break-all", maxWidth:"140px", textAlign:"right"}}>{imgInfo.name}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{color:"#7bc"}}>Resolution</span><span>{imgInfo.w} × {imgInfo.h} px</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{color:"#7bc"}}>Format</span><span>{imgInfo.format}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{color:"#7bc"}}>Size</span><span>{imgInfo.size}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{color:"#7bc"}}>Aspect Ratio</span><span>{imgInfo.aspect}</span></div>
          </div>
        ) : (
          <div style={{ marginBottom: "16px", fontSize: "13px", color: "#556" }}>
            📄 Upload an image to see details
          </div>
        )}

        {/* ── Brightness & Contrast ── */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontWeight: "bold", color: "#7ef7c8", marginBottom: "10px", fontSize: "13px" }}>Brightness / Contrast</div>
          <label style={styles.label}>Brightness: {brightness}%</label>
          <input type="range" min="10" max="200" value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            style={{ width: "100%", marginBottom: "8px" }} />
          <label style={styles.label}>Contrast: {contrast}%</label>
          <input type="range" min="10" max="200" value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
            style={{ width: "100%", marginBottom: "8px" }} />
          <button style={{ ...styles.button, width: "100%" }} onClick={applyBrightness}>
            Apply
          </button>
        </div>

        <h2>Mode Selection</h2>

        <div style={styles.section}>
          <label style={{ display: "block", marginBottom: "4px" }}>
            <input type="radio" checked={mode === "basic"}
              onChange={() => { setMode("basic"); setTask("Crop"); setResultImage(null); setMetrics(null); }} />
            {" "}Basic Editing
          </label>
          <label>
            <input type="radio" checked={mode === "ai"}
              onChange={() => { setMode("ai"); setTask("Enhance"); }} />
            {" "}AI Editing
          </label>
        </div>

        {mode === "basic" && (
          <>
            <h3>Basic Editing</h3>
            <select value={task} onChange={(e) => setTask(e.target.value)} style={styles.input}>
              <option>Crop</option>
              <option>Add Text</option>
              <option>Free Draw</option>
              <option>Blur</option>
            </select>

            {task === "Crop" && (
              <div style={styles.section}>
                <div style={styles.hint}>Drag on the image to select</div>
                <button style={{ ...styles.button, width: "100%" }} onClick={applyCrop}>Apply Crop</button>
              </div>
            )}

            {task === "Add Text" && (
              <div style={styles.section}>
                <label style={styles.label}>Text</label>
                <input style={styles.input} value={textValue}
                  onChange={(e) => setTextValue(e.target.value)} placeholder="Type text, then click on image…" />
                <label style={styles.label}>Size: {textSize}px</label>
                <input type="range" min="10" max="120" value={textSize}
                  onChange={(e) => setTextSize(Number(e.target.value))} style={{ width: "100%" }} />
                <label style={styles.label}>Color</label>
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
                <div style={styles.hint}>Click on the image to place the text.</div>
              </div>
            )}

            {task === "Free Draw" && (
              <div style={styles.section}>
                <div style={styles.hint}>Drag on the image to draw.</div>
                <label style={styles.label}>Brush size: {brushSize}</label>
                <input type="range" min="1" max="40" value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))} style={{ width: "100%" }} />
                <label style={styles.label}>Brush color</label>
                <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} />
              </div>
            )}

            {task === "Blur" && (
              <div style={styles.section}>
                <label style={styles.label}>Blur: {blurAmount}px</label>
                <input type="range" min="0" max="20" value={blurAmount}
                  onChange={(e) => setBlurAmount(Number(e.target.value))} style={{ width: "100%" }} />
                <button style={{ ...styles.button, width: "100%" }} onClick={applyBlur}>Apply Blur</button>
              </div>
            )}
          </>
        )}

        {mode === "ai" && (
          <>
            <h3>AI Editing</h3>
            <select value={task} onChange={(e) => setTask(e.target.value)} style={styles.input}>
              <option>Enhance</option>
              <option>Denoise</option>
              <option>Color Correction</option>
              <option>Super Resolution</option>
            </select>

            <label style={styles.label}>Strength: {strength}</label>
            <input type="range" min="0.5" max="2.0" step="0.1" value={strength}
              onChange={(e) => setStrength(parseFloat(e.target.value))} style={{ width: "100%" }} />

            <button style={{ ...styles.button, marginTop: "10px", width: "100%" }}
              onClick={applyAI} disabled={loading || !inputPreview}>
              {loading ? "Processing…" : "Apply AI"}
            </button>
          </>
        )}
      </div>

      <div style={styles.main}>
        <h1>AI IMAGE EDITOR</h1>

        <div style={styles.topBar}>
          <button style={styles.button} onClick={undo}>↩ Undo</button>
          <button style={styles.button} onClick={redo}>↪ Redo</button>
          <button style={styles.button} onClick={enableEraser}>✏ Eraser</button>
          <button style={styles.button} onClick={downloadImage}>⬇ Download</button>
        </div>

        <div style={styles.uploadBox}>
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </div>

        {inputPreview && (
          <>
            {mode === "ai" ? (
              <div style={styles.imageRow}>
                <div style={styles.imageContainer}>
                  <div style={styles.canvasWrap}>
                    <canvas ref={canvasRef} style={styles.canvas}
                      onMouseDown={onCanvasMouseDown}
                      onMouseMove={onCanvasMouseMove}
                      onMouseUp={onCanvasMouseUp}
                      onMouseLeave={onCanvasMouseUp} />
                  </div>
                  <p style={styles.imageLabel}>📷Original Image</p>
                </div>

                <div style={styles.imageContainer}>
                  {resultImage ? (
                    <>
                      <img src={resultImage} style={styles.image} alt="AI Result"
                        onError={(e) => { console.log("Image load error"); e.target.style.display = "none"; }} />
                      <p style={styles.imageLabel}>Output Image</p>
                    </>
                  ) : (
                    !loading && <p style={{ ...styles.imageLabel, marginTop: 60 }}></p>
                  )}
                  {loading && <div style={styles.loadingBadge}>⏳Running…</div>}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: "20px" }}>
                <div style={styles.canvasWrap}>
                  <canvas ref={canvasRef} style={styles.canvas}
                    onMouseDown={onCanvasMouseDown}
                    onMouseMove={onCanvasMouseMove}
                    onMouseUp={onCanvasMouseUp}
                    onMouseLeave={onCanvasMouseUp} />
                </div>
                <p style={styles.imageLabel}>📷Original Image</p>
              </div>
            )}
          </>
        )}

        {mode === "ai" && resultImage && metrics && (
          <>
            <div style={styles.metricsInline}>
              <span>PSNR: {metrics.psnr} dB</span>
              <span>SSIM: {metrics.ssim}</span>
              <span>Time: {metrics.time} sec</span>
            </div>
            <div style={{ marginTop: "14px" }}>
              <a href={resultImage} download="ai-result.png"
                style={{ ...styles.button, textDecoration: "none", padding: "8px 16px", display: "inline-block" }}>
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;