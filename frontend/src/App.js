import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

const API_URL = "http://127.0.0.1:8001/process/";

// ── Two-color system: Deep Teal + Electric Violet ─────────────
// Primary: #0d9488 (teal)   — structure, active states, sliders
// Secondary: #7c3aed (violet) — CTA buttons, highlights, accents
const T = "#0d9488";   // teal
const V = "#7c3aed";   // violet
const TL = "#14b8a6";  // teal light
const VL = "#a78bfa";  // violet light

const C = {
  bg:      "#0a0c0f",
  panel:   "#0f1217",
  card:    "#141920",
  card2:   "#191f28",
  border:  "#1e2530",
  border2: "#263040",
  T, V, TL, VL,
  tdim:    "rgba(13,148,136,0.12)",
  vdim:    "rgba(124,58,237,0.12)",
  tborder: "rgba(13,148,136,0.35)",
  vborder: "rgba(124,58,237,0.35)",
  text:    "#e8edf5",
  text2:   "#6b7a94",
  text3:   "#333d50",
  white:   "#ffffff",
  canvas:  "#080a0d",
};

const CANVAS_W = 460;
const CANVAS_H = 460;

// ── Flat single-color buttons ─────────────────────────────────
const btn = (extra={}) => ({
  padding:"8px 16px", cursor:"pointer", border:"none", borderRadius:"6px",
  fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:"13px",
  letterSpacing:"0.01em", transition:"opacity 0.15s, transform 0.12s", ...extra,
});

// Teal — primary action (Apply, Crop, Rotate, Blur…)
const tealBtn  = { ...btn(), background:T,  color:C.white };
// Violet — CTA (Run, Download, AI mode)
const violetBtn= { ...btn(), background:V,  color:C.white };
// Ghost teal
const ghostT   = { ...btn(), background:"transparent", color:TL, border:`1px solid ${C.tborder}` };
// Ghost violet
const ghostV   = { ...btn(), background:"transparent", color:VL, border:`1px solid ${C.vborder}` };
// Danger
const dangerBtn= { ...btn(), background:"transparent", color:"#e05b5b", border:"1px solid rgba(224,91,91,0.3)" };

const lbl = {
  display:"block", fontSize:"10px", fontWeight:700, color:C.text3,
  marginBottom:"5px", marginTop:"12px",
  letterSpacing:"0.1em", textTransform:"uppercase",
};

const sliderT = { width:"100%", accentColor:T, cursor:"pointer", height:"4px" };
const sliderV = { width:"100%", accentColor:V, cursor:"pointer", height:"4px" };

const secHead = {
  fontSize:"10px", fontWeight:700, letterSpacing:"0.14em", color:C.text3,
  textTransform:"uppercase", marginBottom:"10px", paddingBottom:"8px",
  borderBottom:`1px solid ${C.border}`,
};

// ── Icons ─────────────────────────────────────────────────────
const Icon = ({ name, size=16, color="#fff" }) => {
  const s = { width:size, height:size, display:"block", flexShrink:0 };
  const sw = "1.8";
  const icons = {
    crop:    <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><path d="M3 1v11h11M1 3h11v11"/></svg>,
    rotate:  <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><path d="M13 8A5 5 0 1 1 8 3"/><path d="M8 1l3 2-3 2"/></svg>,
    text:    <svg style={s} viewBox="0 0 16 16" fill={color}><path d="M2 3h12v2H9v8H7V5H2V3z"/></svg>,
    draw:    <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><path d="M2 14l2-2 8-8-2-2-8 8-2 2 2 2z"/><path d="M10 4l2 2"/></svg>,
    blur:    <svg style={s} viewBox="0 0 16 16" fill={color}><circle cx="8" cy="8" r="2.5"/><circle cx="3.5" cy="8" r="1.5" opacity="0.45"/><circle cx="12.5" cy="8" r="1.5" opacity="0.45"/><circle cx="8" cy="3.5" r="1.5" opacity="0.45"/><circle cx="8" cy="12.5" r="1.5" opacity="0.45"/></svg>,
    eraser:  <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><path d="M2 14h12M9 2l5 5-7 7H2V9l7-7z"/></svg>,
    sr:      <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><rect x="1" y="1" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/><path d="M9 4h3M12 4v3M4 9v3M4 12h3"/></svg>,
    denoise: <svg style={s} viewBox="0 0 16 16" fill={color}><rect x="1" y="1" width="2" height="2" opacity="0.25"/><rect x="5" y="3" width="2" height="2" opacity="0.6"/><rect x="9" y="1" width="2" height="2" opacity="0.25"/><rect x="3" y="7" width="2" height="2" opacity="0.5"/><rect x="7" y="5" width="2" height="2"/><rect x="11" y="7" width="2" height="2" opacity="0.5"/><rect x="1" y="11" width="2" height="2" opacity="0.25"/><rect x="5" y="9" width="2" height="2" opacity="0.6"/><rect x="9" y="13" width="2" height="2" opacity="0.25"/></svg>,
    colorc:  <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><circle cx="8" cy="8" r="6"/><path d="M5 8a3 3 0 0 1 6 0"/><path d="M8 5v6"/></svg>,
    bgrem:   <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><rect x="1" y="1" width="14" height="14" rx="2" strokeDasharray="3 2"/><circle cx="8" cy="8" r="3"/></svg>,
    download:<svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><path d="M8 2v8M5 7l3 3 3-3"/><path d="M2 12h12v2H2z"/></svg>,
    upload:  <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><path d="M8 10V2M5 5l3-3 3 3"/><path d="M2 12h12v2H2z"/></svg>,
    eye:     <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>,
    trash:   <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/></svg>,
    chevron: <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><path d="M4 6l4 4 4-4"/></svg>,
    undo:    <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><path d="M3 8a5 5 0 1 1 .5 4"/><path d="M3 4v4H7"/></svg>,
    redo:    <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><path d="M13 8a5 5 0 1 0-.5 4"/><path d="M13 4v4H9"/></svg>,
    history: <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><circle cx="8" cy="8" r="6"/><path d="M8 4v4l3 2"/></svg>,
    adjust:  <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><path d="M2 4h12M2 8h12M2 12h12"/><circle cx="5" cy="4" r="1.5" fill={color}/><circle cx="10" cy="8" r="1.5" fill={color}/><circle cx="6" cy="12" r="1.5" fill={color}/></svg>,
    inpaint: <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><path d="M2 14l8-8M7 3l6 6"/><circle cx="4" cy="12" r="2" fill={color} fillOpacity="0.3"/><path d="M12 2l2 2-6 6-2-2z"/></svg>,
    clone:   <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><rect x="1" y="1" width="8" height="8" rx="1"/><rect x="7" y="7" width="8" height="8" rx="1" fill={color} fillOpacity="0.15"/><path d="M7 4h5M4 7v5"/></svg>,
    resize:  <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><path d="M1 1h6v6H1zM9 9h6v6H9z"/><path d="M7 4h2M4 7v2M12 7v2M7 12h2" strokeDasharray="2 1"/></svg>,
    vintage: <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw}><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="2"/><path d="M3 3l2 2M11 3l-2 2M3 13l2-2M11 13l-2-2"/></svg>,
  };
  return icons[name] || null;
};

// ── Collapsible ───────────────────────────────────────────────
function Collapse({ title, icon, children, defaultOpen=false, useViolet=false }) {
  const [open, setOpen] = useState(defaultOpen);
  const ac = useViolet ? V : T;
  const dim = useViolet ? C.vdim : C.tdim;
  const border = useViolet ? C.vborder : C.tborder;
  const light = useViolet ? VL : TL;
  return (
    <div style={{marginBottom:"7px"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        width:"100%", display:"flex", alignItems:"center", gap:"8px",
        justifyContent:"space-between",
        background: open ? dim : C.card,
        border:`1px solid ${open ? border : C.border}`,
        borderRadius: open?"6px 6px 0 0":"6px",
        padding:"9px 12px", cursor:"pointer",
        fontFamily:"'DM Sans',sans-serif", fontWeight:600,
        fontSize:"13px", color: open ? C.text : C.text2,
        transition:"all 0.15s",
      }}>
        <span style={{display:"flex",alignItems:"center",gap:"8px"}}>
          {icon && <Icon name={icon} size={14} color={open ? light : C.text3}/>}
          {title}
        </span>
        <span style={{display:"inline-block",transform:open?"rotate(180deg)":"rotate(0)",transition:"transform 0.2s"}}>
          <Icon name="chevron" size={13} color={C.text3}/>
        </span>
      </button>
      {open && (
        <div style={{
          background:C.card2, border:`1px solid ${border}`,
          borderTop:"none", borderRadius:"0 0 6px 6px", padding:"11px 12px",
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Tool card ─────────────────────────────────────────────────
function ToolCard({ icon, label, desc, active, onClick, useViolet=false }) {
  const ac = useViolet ? V : T;
  const light = useViolet ? VL : TL;
  const dim = useViolet ? C.vdim : C.tdim;
  const border = useViolet ? C.vborder : C.tborder;
  return (
    <div onClick={onClick} style={{
      display:"flex", alignItems:"center", gap:"11px",
      padding:"9px 11px", marginBottom:"3px", cursor:"pointer",
      borderRadius:"6px", transition:"all 0.15s",
      background: active ? dim : "transparent",
      border:`1px solid ${active ? border : "transparent"}`,
    }}>
      <div style={{
        width:32, height:32, borderRadius:"7px", flexShrink:0,
        background: active ? `rgba(${useViolet?"124,58,237":"13,148,136"},0.2)` : C.card2,
        border:`1px solid ${active ? border : C.border2}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        transition:"all 0.15s",
      }}>
        <Icon name={icon} size={16} color={active ? light : C.text3}/>
      </div>
      <div style={{minWidth:0}}>
        <div style={{fontSize:"13px",fontWeight:600,color:active?light:C.text}}>{label}</div>
        {desc&&<div style={{fontSize:"10px",color:C.text3,marginTop:"1px",lineHeight:"1.4"}}>{desc}</div>}
      </div>
    </div>
  );
}

// ── Metrics Dropdown ──────────────────────────────────────────
function MetricsDropdown({ metrics }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  React.useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);
  return (
    <div ref={ref} style={{position:"relative",flexShrink:0}}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        ...ghostT, padding:"10px 14px",
        display:"flex", alignItems:"center", gap:"7px",
        whiteSpace:"nowrap",
      }}>
        Metrics
        <span style={{display:"inline-block",transform:open?"rotate(180deg)":"rotate(0)",transition:"transform 0.2s"}}>
          <Icon name="chevron" size={12} color={C.text3}/>
        </span>
      </button>
      {open&&(
        <div style={{
          position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:300,
          background:C.panel, border:`1px solid ${C.border2}`,
          borderRadius:"8px", overflow:"hidden",
          boxShadow:"0 12px 36px rgba(0,0,0,0.6)",
          minWidth:"240px",
        }}>
          {[["PSNR", metrics.psnr!=null?`${metrics.psnr} dB`:"N/A", TL],
            ["SSIM", metrics.ssim!=null?String(metrics.ssim):"N/A", VL],
            ["Time", `${metrics.time}s`, TL]].map(([k,v,col],i)=>(
            <div key={k} style={{
              display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"12px 18px", whiteSpace:"nowrap", gap:"32px",
              borderBottom:i<2?`1px solid ${C.border}`:"none",
            }}>
              <span style={{fontSize:"13px",color:C.text2,fontWeight:500}}>{k}</span>
              <span style={{fontSize:"13px",color:col,fontFamily:"monospace",fontWeight:700}}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const AI_TASKS = [
  {id:"Super Resolution",   icon:"sr",      desc:"2× upscaling via GPU back-projection"},
  {id:"Denoise",            icon:"denoise", desc:"Wavelet pyramid noise removal"},
  {id:"Color Correction",   icon:"colorc",  desc:"Retinex + white balance on GPU"},
  {id:"Background Removal", icon:"bgrem",   desc:"U2-Net deep learning segmentation"},
  {id:"Vintage",            icon:"vintage", desc:"Kodak film look: warm tones, grain, vignette"},
];

const BASIC_TASKS = [
  {id:"Crop",      icon:"crop",   desc:"Select and crop region"},
  {id:"Rotate",    icon:"rotate", desc:"Rotate 90° clockwise"},
  {id:"Add Text",  icon:"text",   desc:"Place text on image"},
  {id:"Free Draw", icon:"draw",   desc:"Freehand brush"},
  {id:"Blur",      icon:"blur",   desc:"Gaussian blur"},
  {id:"Eraser",    icon:"eraser", desc:"Erase pixels"},
];

export default function App() {
  const canvasRef = useRef(null);
  const [inputPreview, setInputPreview] = useState(null);
  const [resultImage,  setResultImage]  = useState(null);
  const [metrics,      setMetrics]      = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [mode,         setMode]         = useState("basic");
  const [task,         setTask]         = useState("Crop");
  const [strength,     setStrength]     = useState(0.8);
  const [brightness,   setBrightness]   = useState(100);
  const [contrast,     setContrast]     = useState(100);
  const [saturation,   setSaturation]   = useState(100);
  const [opacity,      setOpacity]      = useState(100);
  const [blurVal,      setBlurVal]      = useState(0);
  const [resizeW,      setResizeW]      = useState("");
  const [resizeH,      setResizeH]      = useState("");
  const [resizeLock,   setResizeLock]   = useState(true);  // lock aspect ratio
  const [promptText,   setPromptText]   = useState("");
  const [imgInfo,      setImgInfo]      = useState(null);
  const [textValue,    setTextValue]    = useState("");
  const [textSize,     setTextSize]     = useState(28);
  const [textColor,    setTextColor]    = useState("#ffffff");
  const [brushSize,    setBrushSize]    = useState(8);
  const [brushColor,   setBrushColor]   = useState(T);
  const [canvasHist,   setCanvasHist]   = useState([]);
  const [redoStack,    setRedoStack]    = useState([]);
  const [eraserActive, setEraserActive] = useState(false);
  const [editHistory,  setEditHistory]  = useState([]);
  const [histOpen,     setHistOpen]     = useState(true);
  const [viewItem,     setViewItem]     = useState(null);

  const [maskPoints,   setMaskPoints]   = useState([]);
  const [maskDrawing,  setMaskDrawing]   = useState(false);

  const cropRef   = useRef({dragging:false,active:false,startX:0,startY:0,endX:0,endY:0});
  const drawRef   = useRef({drawing:false});
  const eraserRef = useRef({drawing:false});
  const maskRef   = useRef({drawing:false, points:[]});

  const getCtx=()=>canvasRef.current?.getContext("2d");
  const drawContain=(ctx,img)=>{ctx.clearRect(0,0,CANVAS_W,CANVAS_H);const sc=Math.min(CANVAS_W/img.width,CANVAS_H/img.height);ctx.drawImage(img,(CANVAS_W-img.width*sc)/2,(CANVAS_H-img.height*sc)/2,img.width*sc,img.height*sc);};
  const saveState=()=>{const c=canvasRef.current;if(!c)return;setCanvasHist(p=>[...p,c.toDataURL()]);setRedoStack([]);};
  const restoreURL=url=>{const img=new Image();img.src=url;img.onload=()=>{const c=canvasRef.current;const ctx=getCtx();if(!c||!ctx)return;c.width=CANVAS_W;c.height=CANVAS_H;drawContain(ctx,img);};};
  const undo=()=>{if(canvasHist.length<=1)return;const h=[...canvasHist];const last=h.pop();setRedoStack(p=>[...p,last]);setCanvasHist(h);restoreURL(h[h.length-1]);};
  const redo=()=>{if(!redoStack.length)return;const last=redoStack[redoStack.length-1];setRedoStack(p=>p.slice(0,-1));setCanvasHist(p=>[...p,last]);restoreURL(last);};
  const dlCanvas=()=>{const c=canvasRef.current;if(!c)return;const a=document.createElement("a");a.download="pixelforge.png";a.href=c.toDataURL();a.click();};
  const canvasToFile=()=>new Promise(res=>{canvasRef.current?.toBlob(b=>res(b?new File([b],"canvas.png",{type:"image/png"}):null),"image/png");});
  const getXY=e=>{const c=canvasRef.current;const r=c.getBoundingClientRect();return{x:Math.round(((e.clientX-r.left)/r.width)*c.width),y:Math.round(((e.clientY-r.top)/r.height)*c.height)};};

  useEffect(()=>{
    if(!inputPreview)return;
    const img=new Image();img.src=inputPreview;
    img.onload=()=>{const c=canvasRef.current;const ctx=getCtx();if(!c||!ctx)return;c.width=CANVAS_W;c.height=CANVAS_H;drawContain(ctx,img);setCanvasHist([c.toDataURL()]);setRedoStack([]);cropRef.current={dragging:false,active:false,startX:0,startY:0,endX:0,endY:0};};
  },[inputPreview]);

  const handleFile=e=>{
    const f=e.target.files?.[0];if(!f)return;
    setResultImage(null);setMetrics(null);
    const img=new Image();const url=URL.createObjectURL(f);
    img.onload=()=>{const g=(a,b)=>b?g(b,a%b):a;const gc=g(img.naturalWidth,img.naturalHeight);setImgInfo({name:f.name,w:img.naturalWidth,h:img.naturalHeight,size:f.size>=1048576?(f.size/1048576).toFixed(2)+" MB":(f.size/1024).toFixed(1)+" KB",format:f.type.replace("image/","").toUpperCase(),aspect:`${img.naturalWidth/gc}:${img.naturalHeight/gc}`});URL.revokeObjectURL(url);};
    img.src=url;
    const r=new FileReader();r.onload=()=>setInputPreview(r.result);r.readAsDataURL(f);
  };

  const redrawCrop=()=>{
    if(!canvasHist.length)return;restoreURL(canvasHist[canvasHist.length-1]);
    setTimeout(()=>{const ctx=getCtx();if(!ctx)return;const s=cropRef.current;if(!s.active&&!s.dragging)return;const x=Math.min(s.startX,s.endX),y=Math.min(s.startY,s.endY),w=Math.abs(s.endX-s.startX),h=Math.abs(s.endY-s.startY);ctx.save();ctx.strokeStyle=T;ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeRect(x,y,w,h);ctx.fillStyle="rgba(13,148,136,0.08)";ctx.fillRect(x,y,w,h);ctx.restore();},0);
  };

  const onDown=e=>{
    if(!inputPreview)return;const{x,y}=getXY(e);
    if(eraserActive){eraserRef.current.drawing=true;saveState();const ctx=getCtx();ctx.beginPath();ctx.moveTo(x,y);return;}
    if(mode==="basic"&&task==="Add Text"){if(!textValue.trim())return alert("Enter text first.");const ctx=getCtx();saveState();ctx.font=`600 ${textSize}px 'DM Sans',sans-serif`;ctx.fillStyle=textColor;ctx.shadowColor="rgba(0,0,0,0.6)";ctx.shadowBlur=4;ctx.fillText(textValue,x,y);ctx.shadowBlur=0;saveState();addHist("Add Text",canvasRef.current.toDataURL());return;}
    if(mode==="basic"&&task==="Free Draw"){drawRef.current.drawing=true;saveState();const ctx=getCtx();ctx.beginPath();ctx.moveTo(x,y);return;}
    if(mode==="basic"&&task==="Crop"){Object.assign(cropRef.current,{dragging:true,active:true,startX:x,startY:y,endX:x,endY:y});redrawCrop();}
    // Mask painting for Inpainting and Cloning
    if(mode==="ai"&&(task==="Inpainting"||task==="Cloning")){
      maskRef.current.drawing=true;
      if(task==="Cloning"){
        // Cloning: first click=source, second click=destination
        maskRef.current.points.push([x,y]);
        const ctx=getCtx();
        ctx.save();
        ctx.fillStyle=maskRef.current.points.length===1?"rgba(20,184,166,0.8)":"rgba(124,58,237,0.8)";
        ctx.beginPath();ctx.arc(x,y,14,0,Math.PI*2);ctx.fill();
        ctx.fillStyle="#fff";ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
        ctx.fillText(maskRef.current.points.length===1?"S":"D",x,y);
        ctx.restore();
      } else {
        // Inpainting: paint continuously
        maskRef.current.points.push([x,y]);
        const ctx=getCtx();
        ctx.save();
        ctx.globalCompositeOperation="source-over";
        ctx.fillStyle="rgba(124,58,237,0.55)";
        ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.fill();
        ctx.restore();
      }
    }
  };
  const onMove=e=>{
    if(!inputPreview)return;const{x,y}=getXY(e);
    if(eraserActive&&eraserRef.current.drawing){const ctx=getCtx();ctx.save();ctx.globalCompositeOperation="destination-out";ctx.lineWidth=22;ctx.lineCap="round";ctx.lineTo(x,y);ctx.stroke();ctx.restore();return;}
    if(mode==="basic"&&task==="Free Draw"&&drawRef.current.drawing){const ctx=getCtx();ctx.strokeStyle=brushColor;ctx.lineWidth=brushSize;ctx.lineCap="round";ctx.lineJoin="round";ctx.lineTo(x,y);ctx.stroke();return;}
    if(mode==="basic"&&task==="Crop"&&cropRef.current.dragging){cropRef.current.endX=x;cropRef.current.endY=y;redrawCrop();}
    if(mode==="ai"&&task==="Inpainting"&&maskRef.current.drawing){
      maskRef.current.points.push([x,y]);
      const ctx=getCtx();
      ctx.save();
      ctx.globalCompositeOperation="source-over";
      ctx.fillStyle="rgba(124,58,237,0.55)";
      ctx.beginPath();
      if(maskRef.current.points.length>1){
        const prev=maskRef.current.points[maskRef.current.points.length-2];
        ctx.lineWidth=22;ctx.lineCap="round";ctx.strokeStyle="rgba(124,58,237,0.55)";
        ctx.moveTo(prev[0],prev[1]);ctx.lineTo(x,y);ctx.stroke();
      }
      ctx.arc(x,y,11,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
  };
  const onUp=()=>{
    if(eraserRef.current.drawing){eraserRef.current.drawing=false;saveState();addHist("Eraser",canvasRef.current.toDataURL());}
    if(drawRef.current.drawing){drawRef.current.drawing=false;saveState();addHist("Free Draw",canvasRef.current.toDataURL());}
    if(cropRef.current.dragging){cropRef.current.dragging=false;redrawCrop();}
    if(maskRef.current.drawing){maskRef.current.drawing=false;}
  };

  const applyCrop=()=>{
    const s=cropRef.current;if(!s.active)return alert("Drag to select area first.");
    const x=Math.min(s.startX,s.endX),y=Math.min(s.startY,s.endY),w=Math.abs(s.endX-s.startX),h=Math.abs(s.endY-s.startY);
    if(w<5||h<5)return alert("Selection too small.");
    const base=new Image();base.src=canvasHist[canvasHist.length-1];
    base.onload=()=>{const tmp=document.createElement("canvas");tmp.width=CANVAS_W;tmp.height=CANVAS_H;drawContain(tmp.getContext("2d"),base);const px=tmp.getContext("2d").getImageData(x,y,w,h);const c=canvasRef.current;const ctx=getCtx();c.width=CANVAS_W;c.height=CANVAS_H;ctx.clearRect(0,0,CANVAS_W,CANVAS_H);const t2=document.createElement("canvas");t2.width=w;t2.height=h;t2.getContext("2d").putImageData(px,0,0);const sc=Math.min(CANVAS_W/w,CANVAS_H/h);ctx.drawImage(t2,(CANVAS_W-w*sc)/2,(CANVAS_H-h*sc)/2,w*sc,h*sc);cropRef.current.active=false;saveState();addHist("Crop",c.toDataURL());};
  };
  const applyRotate=()=>{
    if(!canvasHist.length)return;const img=new Image();img.src=canvasHist[canvasHist.length-1];
    img.onload=()=>{const c=canvasRef.current;const ctx=getCtx();c.width=CANVAS_W;c.height=CANVAS_H;ctx.clearRect(0,0,CANVAS_W,CANVAS_H);ctx.save();ctx.translate(CANVAS_W/2,CANVAS_H/2);ctx.rotate(Math.PI/2);const sc=Math.min(CANVAS_W/img.width,CANVAS_H/img.height);ctx.drawImage(img,-img.width*sc/2,-img.height*sc/2,img.width*sc,img.height*sc);ctx.restore();saveState();addHist("Rotate",c.toDataURL());};
  };
  const applyAdj=()=>{
    if(!canvasHist.length)return;const img=new Image();img.src=canvasHist[canvasHist.length-1];
    img.onload=()=>{const c=canvasRef.current;const ctx=getCtx();c.width=CANVAS_W;c.height=CANVAS_H;ctx.filter=`brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) opacity(${opacity}%)`;drawContain(ctx,img);ctx.filter="none";saveState();addHist("Adjustments",c.toDataURL());};
  };
  const applyBlur=()=>{
    if(!canvasHist.length)return;const img=new Image();img.src=canvasHist[canvasHist.length-1];
    img.onload=()=>{const c=canvasRef.current;const ctx=getCtx();c.width=CANVAS_W;c.height=CANVAS_H;ctx.filter=`blur(${blurVal}px)`;drawContain(ctx,img);ctx.filter="none";saveState();addHist("Blur",c.toDataURL());};
  };

  const addHist=(label,thumbnail,aiResult=null,m=null)=>{
    setEditHistory(prev=>[{id:Date.now(),label,thumbnail,aiResult,metrics:m,timestamp:new Date().toLocaleTimeString(),isAI:aiResult!==null},...prev]);
  };

  const applyResizeBasic=async()=>{
    if(!inputPreview)return alert("Upload an image first");
    const tw = parseInt(resizeW);
    const th = parseInt(resizeH);
    if(!tw||!th||tw<1||th<1) return alert("Enter valid width and height.");
    if(tw>8000||th>8000) return alert("Maximum dimension is 8000px.");
    setLoading(true);
    try{
      const file=await canvasToFile();if(!file)throw new Error("Export failed");
      const fd=new FormData();
      fd.append("file",file);
      fd.append("task","Resize");
      fd.append("strength",strength);
      fd.append("resize_w",String(tw));
      fd.append("resize_h",String(th));
      const res=await axios.post(API_URL,fd);
      let b64=res.data?.image;if(!b64)throw new Error("No image");
      if(!b64.startsWith("data:image"))b64=`data:image/png;base64,${b64}`;
      const img=new Image();img.src=b64;
      img.onload=()=>{
        const c=canvasRef.current;const ctx=getCtx();if(!c||!ctx)return;
        c.width=CANVAS_W;c.height=CANVAS_H;drawContain(ctx,img);
        saveState();addHist(`Resize ${tw}×${th}`,c.toDataURL());
        setResizeW(String(tw)); setResizeH(String(th));
      };
    }catch(err){console.error(err);alert("Resize failed. Check backend.");}
    finally{setLoading(false);}
  };

  const clearMask=()=>{
    maskRef.current.points=[];
    setMaskPoints([]);
    // Redraw canvas without mask overlay
    if(canvasHist.length) restoreURL(canvasHist[canvasHist.length-1]);
  };

  const applyAI=async()=>{
    if(!inputPreview)return alert("Upload an image first");
    setLoading(true);setResultImage(null);setMetrics(null);
    const snap=canvasRef.current?.toDataURL();
    try{
      const file=await canvasToFile();if(!file)throw new Error("Export failed");
      const fd=new FormData();
      fd.append("file",file);fd.append("task",task);fd.append("strength",strength);
      const res=await axios.post(API_URL,fd);
      let b64=res.data?.image;if(!b64)throw new Error("No image");
      if(!b64.startsWith("data:image"))b64=`data:image/png;base64,${b64}`;
      setResultImage(b64);
      const m={psnr:res.data.psnr,ssim:res.data.ssim,time:res.data.time};
      setMetrics(m);addHist(task,snap,b64,m);
    }catch(err){console.error(err);alert("AI processing failed. Check backend on port 8001.");}
    finally{setLoading(false);}
  };

  const dlItem=item=>{const src=item.aiResult||item.thumbnail;const a=document.createElement("a");a.download=`${item.label.replace(/\s/g,"_")}.png`;a.href=src;a.click();};

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:${C.bg};color:${C.text};font-family:'DM Sans',sans-serif;font-size:13px;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:${C.panel}}
        ::-webkit-scrollbar-thumb{background:${C.border2};border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:${T};}
        input[type=range]{height:4px;border-radius:2px;outline:none;cursor:pointer;}
        input[type=text]{background:${C.card};border:1px solid ${C.border2};border-radius:6px;padding:8px 11px;color:${C.text};font-family:'DM Sans',sans-serif;font-size:13px;width:100%;transition:all 0.15s;}
        input[type=text]:focus{outline:none;border-color:${T};box-shadow:0 0 0 3px rgba(13,148,136,0.18);}
        button:hover{opacity:0.88;transform:translateY(-1px);}
        button:active{transform:scale(0.97) translateY(0);}
        .tool-hover:hover{background:${C.tdim}!important;}
        .hist-card{background:${C.card};border:1px solid ${C.border};border-radius:8px;padding:8px;margin-bottom:6px;transition:all 0.15s;}
        .hist-card:hover{border-color:${C.border2};}
        @keyframes spin{to{transform:rotate(360deg)}}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:1000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);}
        .modal-box{background:${C.panel};border:1px solid ${C.border2};border-radius:12px;padding:22px;max-width:92vw;max-height:90vh;overflow:auto;box-shadow:0 24px 80px rgba(0,0,0,0.7);}
      `}</style>

      {/* Modal */}
      {viewItem&&(
        <div className="modal-bg" onClick={()=>setViewItem(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"18px"}}>
              <div>
                <div style={{fontSize:"18px",fontWeight:800,color:C.text}}>{viewItem.label}</div>
                <div style={{fontSize:"11px",color:C.text3,marginTop:"3px"}}>{viewItem.timestamp} · {viewItem.isAI?"AI":"Basic"}</div>
              </div>
              <div style={{display:"flex",gap:"8px"}}>
                <button onClick={()=>dlItem(viewItem)} style={{...violetBtn,display:"flex",alignItems:"center",gap:"6px"}}>
                  <Icon name="download" size={15} color={C.white}/> Download
                </button>
                <button onClick={()=>setViewItem(null)} style={{...btn(),background:C.card2,color:C.text2,border:`1px solid ${C.border2}`}}>✕</button>
              </div>
            </div>
            {viewItem.isAI?(
              <div style={{display:"flex",gap:"16px",flexWrap:"wrap"}}>
                {[["Original",viewItem.thumbnail],["Result",viewItem.aiResult]].map(([label,src])=>(
                  <div key={label}>
                    <div style={{fontSize:"10px",color:C.text3,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"8px",fontWeight:700}}>{label}</div>
                    <img src={src} alt={label} style={{maxWidth:"400px",maxHeight:"400px",objectFit:"contain",borderRadius:"8px",border:`1px solid ${C.border2}`}}/>
                  </div>
                ))}
              </div>
            ):(
              <img src={viewItem.thumbnail} alt="canvas" style={{maxWidth:"600px",maxHeight:"500px",objectFit:"contain",borderRadius:"8px",border:`1px solid ${C.border2}`}}/>
            )}
            {viewItem.metrics?.psnr&&(
              <div style={{display:"flex",gap:"10px",marginTop:"16px",justifyContent:"center"}}>
                {[["PSNR",viewItem.metrics.psnr+" dB",TL],["SSIM",viewItem.metrics.ssim,VL],["Time",viewItem.metrics.time+"s",TL]].map(([k,v,col])=>(
                  <div key={k} style={{background:C.card2,border:`1px solid ${C.border2}`,borderRadius:"7px",padding:"10px 18px",textAlign:"center"}}>
                    <div style={{fontSize:"10px",color:C.text3,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700}}>{k}</div>
                    <div style={{fontSize:"18px",fontWeight:700,color:col,fontFamily:"monospace",marginTop:"3px"}}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>

        {/* ══ LEFT SIDEBAR ════════════════════════════════════════ */}
        <div style={{width:"296px",flexShrink:0,background:C.panel,borderRight:`1px solid ${C.border}`,overflowY:"auto",padding:"16px"}}>

          {/* Logo */}
          <div style={{marginBottom:"18px",paddingBottom:"15px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:"21px",fontWeight:800,letterSpacing:"-0.02em"}}>
              <span style={{color:TL}}>Pic</span><span style={{color:VL}}>Fix</span>
            </div>
            <div style={{fontSize:"10px",color:C.text3,marginTop:"3px",letterSpacing:"0.12em",textTransform:"uppercase"}}>An AI Image Editor</div>
          </div>

          {/* Image Info */}
          <Collapse title="Image Info" icon="adjust" defaultOpen={false} useViolet={false}>
            {imgInfo?(
              <div style={{fontSize:"12px",lineHeight:"2"}}>
                {[["File",imgInfo.name],["Dimensions",`${imgInfo.w} × ${imgInfo.h}`],
                  ["Format",imgInfo.format],["Size",imgInfo.size],["Aspect",imgInfo.aspect]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",gap:"8px"}}>
                    <span style={{color:C.text3,flexShrink:0,fontSize:"11px"}}>{k}</span>
                    <span style={{color:C.text2,textAlign:"right",wordBreak:"break-all"}}>{v}</span>
                  </div>
                ))}
              </div>
            ):<div style={{fontSize:"12px",color:C.text3}}>No image loaded yet.</div>}
          </Collapse>

          {/* Adjustments */}
          <Collapse title="Adjustments" icon="adjust" defaultOpen={true} useViolet={false}>
            {[["Brightness",brightness,setBrightness,10,200,"%"],
              ["Contrast",  contrast,  setContrast,  10,200,"%"],
              ["Saturation",saturation,setSaturation,0, 200,"%"],
              ["Opacity",   opacity,   setOpacity,   10,100,"%"]].map(([n,v,s,mn,mx,u])=>(
              <div key={n}>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:"11px",marginBottom:"5px"}}>
                  <span style={{fontSize:"10px",color:C.text3,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:700}}>{n}</span>
                  <span style={{fontSize:"12px",color:TL,fontFamily:"monospace",fontWeight:700}}>{v}{u}</span>
                </div>
                <input type="range" min={mn} max={mx} value={v} onChange={e=>s(+e.target.value)} style={sliderT}/>
              </div>
            ))}
            <button style={{...tealBtn,width:"100%",marginTop:"14px",padding:"9px"}} onClick={applyAdj}>Apply</button>
          </Collapse>

          {/* Mode toggle */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",margin:"12px 0"}}>
            <button
              onClick={()=>{setMode("basic");setTask("Crop");setResultImage(null);setMetrics(null);setEraserActive(false);}}
              style={{...btn(),padding:"10px",
                background:mode==="basic"?T:"transparent",
                color:mode==="basic"?C.white:C.text3,
                border:`1px solid ${mode==="basic"?T:C.border}`,
              }}>
              Basic
            </button>
            <button
              onClick={()=>{setMode("ai");setTask("Super Resolution");setResultImage(null);setMetrics(null);setEraserActive(false);}}
              style={{...btn(),padding:"10px",
                background:mode==="ai"?V:"transparent",
                color:mode==="ai"?C.white:C.text3,
                border:`1px solid ${mode==="ai"?V:C.border}`,
              }}>
              AI Mode
            </button>
          </div>

          {/* BASIC TOOLS */}
          {mode==="basic"&&(
            <>
              <div style={secHead}>Tools</div>
              {BASIC_TASKS.map(t=>(
                <div key={t.id} className="tool-hover" style={{borderRadius:"6px"}}>
                  <ToolCard icon={t.icon} label={t.id} desc={t.desc}
                    active={task===t.id} useViolet={false}
                    onClick={()=>{setTask(t.id);setEraserActive(t.id==="Eraser");}}/>
                </div>
              ))}
              <div style={{marginTop:"11px",paddingTop:"11px",borderTop:`1px solid ${C.border}`}}>
                {task==="Crop"&&(<>
                  <div style={{fontSize:"11px",color:C.text3,marginBottom:"9px"}}>Drag on image to select area.</div>
                  <button style={{...tealBtn,width:"100%"}} onClick={applyCrop}>Apply Crop</button>
                </>)}
                {task==="Rotate"&&(<>
                  <div style={{fontSize:"11px",color:C.text3,marginBottom:"9px"}}>Rotate canvas 90° clockwise.</div>
                  <button style={{...tealBtn,width:"100%"}} onClick={applyRotate}>Rotate 90°</button>
                </>)}
                {task==="Add Text"&&(<>
                  <span style={lbl}>Text</span>
                  <input type="text" value={textValue} onChange={e=>setTextValue(e.target.value)} placeholder="Enter text..."/>
                  <span style={lbl}>Size — {textSize}px</span>
                  <input type="range" min="10" max="120" value={textSize} onChange={e=>setTextSize(+e.target.value)} style={sliderT}/>
                  <span style={lbl}>Color</span>
                  <input type="color" value={textColor} onChange={e=>setTextColor(e.target.value)}
                    style={{width:"100%",height:"34px",cursor:"pointer",border:`1px solid ${C.border2}`,borderRadius:"6px",background:"none",marginTop:"2px"}}/>
                  <div style={{fontSize:"11px",color:C.text3,marginTop:"8px"}}>Click on canvas to place.</div>
                </>)}
                {task==="Free Draw"&&(<>
                  <span style={lbl}>Size — {brushSize}px</span>
                  <input type="range" min="1" max="40" value={brushSize} onChange={e=>setBrushSize(+e.target.value)} style={sliderT}/>
                  <span style={lbl}>Color</span>
                  <input type="color" value={brushColor} onChange={e=>setBrushColor(e.target.value)}
                    style={{width:"100%",height:"34px",cursor:"pointer",border:`1px solid ${C.border2}`,borderRadius:"6px",background:"none",marginTop:"2px"}}/>
                </>)}
                {task==="Blur"&&(<>
                  <span style={lbl}>Amount — {blurVal}px</span>
                  <input type="range" min="0" max="20" value={blurVal} onChange={e=>setBlurVal(+e.target.value)} style={sliderT}/>
                  <button style={{...tealBtn,width:"100%",marginTop:"12px"}} onClick={applyBlur}>Apply Blur</button>
                </>)}

                {task==="Eraser"&&<div style={{fontSize:"11px",color:C.text3}}>Drag on canvas to erase pixels.</div>}
              </div>
            </>
          )}

          {/* AI TOOLS */}
          {mode==="ai"&&(
            <>
              <div style={secHead}>Techniques</div>
              {AI_TASKS.map(t=>(
                <div key={t.id} className="tool-hover" style={{borderRadius:"6px"}}>
                  <ToolCard icon={t.icon} label={t.id} desc={t.desc}
                    active={task===t.id} useViolet={true}
                    onClick={()=>setTask(t.id)}/>
                </div>
              ))}
              <div style={{marginTop:"11px",paddingTop:"11px",borderTop:`1px solid ${C.border}`}}>
                {true&&(<>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
                    <span style={{fontSize:"10px",color:C.text3,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>Strength</span>
                    <span style={{fontSize:"12px",color:VL,fontFamily:"monospace",fontWeight:700}}>{strength}</span>
                  </div>
                  <input type="range" min="0.3" max="1.5" step="0.1" value={strength}
                    onChange={e=>setStrength(parseFloat(e.target.value))} style={sliderV}/>
                  <div style={{fontSize:"10px",color:C.text3,marginTop:"4px",textAlign:"right"}}>Lower = better results</div>
                </>)}

                <button style={{...violetBtn,width:"100%",marginTop:"14px",padding:"12px",fontSize:"14px",fontWeight:700}}
                  onClick={applyAI} disabled={loading||!inputPreview}>
                  {loading?(
                    <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
                      <span style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>
                      Processing…
                    </span>
                  ):"Run"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ══ MAIN PANEL ══════════════════════════════════════════ */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:C.canvas}}>

          {/* Toolbar */}
          <div style={{display:"flex",alignItems:"center",gap:"8px",padding:"10px 20px",borderBottom:`1px solid ${C.border}`,background:C.panel,flexShrink:0}}>
            <button style={{...ghostT,padding:"8px 13px",display:"flex",alignItems:"center",gap:"6px"}} onClick={undo}>
              <Icon name="undo" size={16} color={TL}/> Undo
            </button>
            <button style={{...ghostT,padding:"8px 13px",display:"flex",alignItems:"center",gap:"6px"}} onClick={redo}>
              <Icon name="redo" size={16} color={TL}/> Redo
            </button>

            <div style={{width:"1px",height:"24px",background:C.border,margin:"0 4px"}}/>

            <button onClick={()=>setHistOpen(o=>!o)} style={{
              ...ghostT, padding:"8px 13px",
              display:"flex", alignItems:"center", gap:"6px",
              background:histOpen?C.tdim:"transparent",
              borderColor:histOpen?T:C.tborder,
            }}>
              <Icon name="history" size={16} color={TL}/> History
            </button>

            <div style={{flex:1}}/>

            <button onClick={dlCanvas} style={{...violetBtn,padding:"8px 18px",display:"flex",alignItems:"center",gap:"7px",fontSize:"13px"}}>
              <Icon name="download" size={16} color={C.white}/> Download
            </button>
          </div>

          {/* Canvas area */}
          <div style={{flex:1,overflowY:"auto",padding:"22px",display:"flex",flexDirection:"column",alignItems:"center",gap:"18px"}}>

            {/* Upload + Metrics */}
            <div style={{display:"flex",gap:"10px",width:"100%",maxWidth:"980px",alignItems:"center"}}>
              <label style={{flex:1,cursor:"pointer",minWidth:0}}>
                <div style={{
                  border:`1px dashed ${T}`,borderRadius:"9px",
                  padding:"12px 18px", background:C.tdim,
                  display:"flex", alignItems:"center", gap:"12px",
                  transition:"all 0.2s",
                }}>
                  <div style={{width:38,height:38,borderRadius:"7px",flexShrink:0,background:"rgba(13,148,136,0.2)",border:`1px solid ${C.tborder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <Icon name="upload" size={20} color={TL}/>
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:"14px",fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {inputPreview?imgInfo?.name||"Image loaded":"Upload an Image"}
                    </div>
                    <div style={{fontSize:"11px",color:C.text2,marginTop:"2px"}}>
                      {inputPreview?`${imgInfo?.w}×${imgInfo?.h} · ${imgInfo?.format} · ${imgInfo?.size}`:""}
                    </div>
                  </div>
                  {inputPreview&&<div style={{marginLeft:"auto",fontSize:"11px",color:TL,fontWeight:600,flexShrink:0}}>Change</div>}
                </div>
                <input type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
              </label>
              {metrics&&<MetricsDropdown metrics={metrics}/>}
            </div>

            {/* Canvases */}
            {inputPreview&&(
              <div style={{display:"flex",gap:"22px",flexWrap:"wrap",justifyContent:"center",width:"100%",maxWidth:"1000px"}}>
                <div>
                  <div style={{fontSize:"10px",color:C.text3,marginBottom:"8px",textAlign:"center",textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700}}>
                    {mode==="ai"?"Original":"Canvas"}
                  </div>
                  <div style={{borderRadius:"10px",overflow:"hidden",border:`2px solid ${C.border2}`,display:"inline-block",boxShadow:"0 6px 24px rgba(0,0,0,0.5)"}}>
                    <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
                      style={{display:"block",cursor:eraserActive?"cell":"crosshair",maxWidth:"100%"}}
                      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}/>
                  </div>
                </div>

                {mode==="ai"&&(
                  <div>
                    <div style={{fontSize:"10px",color:C.text3,marginBottom:"8px",textAlign:"center",textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700}}>Result</div>
                    <div style={{width:CANVAS_W,height:CANVAS_H,border:`2px solid ${C.vborder}`,borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",background:C.card,overflow:"hidden",boxShadow:`0 6px 24px rgba(124,58,237,0.12), 0 4px 14px rgba(0,0,0,0.4)`}}>
                      {loading&&(
                        <div style={{textAlign:"center"}}>
                          <div style={{width:36,height:36,border:`3px solid rgba(124,58,237,0.2)`,borderTopColor:V,borderRadius:"50%",margin:"0 auto 12px",animation:"spin 0.75s linear infinite"}}/>
                          <div style={{fontSize:"13px",color:VL,fontWeight:600}}>{task}</div>
                          <div style={{fontSize:"11px",color:C.text3,marginTop:"4px"}}>Processing on GPU…</div>
                        </div>
                      )}
                      {!loading&&resultImage&&<img src={resultImage} alt="Result" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>}
                      {!loading&&!resultImage&&(
                        <div style={{textAlign:"center",padding:"30px"}}>
                          <div style={{width:52,height:52,borderRadius:"12px",background:C.vdim,border:`1px dashed ${C.vborder}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>
                            <Icon name={AI_TASKS.find(t=>t.id===task)?.icon||"sr"} size={24} color={`rgba(124,58,237,0.5)`}/>
                          </div>
                          <div style={{fontSize:"13px",color:C.text3,lineHeight:"1.8"}}>Select a technique<br/>and click Run</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!inputPreview&&(
              <div style={{textAlign:"center",marginTop:"70px"}}>
                <div style={{width:80,height:80,borderRadius:"18px",margin:"0 auto 18px",background:C.tdim,border:`1px dashed ${C.tborder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Icon name="upload" size={36} color={`rgba(13,148,136,0.5)`}/>
                </div>
                <div style={{fontSize:"16px",fontWeight:700,color:C.text2,marginBottom:"6px"}}>Upload an image to get started</div>
                <div style={{fontSize:"12px",color:C.text3}}></div>
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT — HISTORY ═════════════════════════════════════ */}
        {histOpen&&(
          <div style={{width:"214px",flexShrink:0,background:C.panel,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column"}}>
            <div style={{padding:"12px 13px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
              <div>
                <div style={{fontSize:"14px",fontWeight:800,color:C.text}}>History</div>
                <div style={{fontSize:"10px",color:C.text3,marginTop:"1px"}}>{editHistory.length} edit{editHistory.length!==1?"s":""}</div>
              </div>
              <div style={{display:"flex",gap:"5px"}}>
                {editHistory.length>0&&(
                  <button onClick={()=>setEditHistory([])} style={{...dangerBtn,padding:"5px 8px",display:"flex",alignItems:"center"}}>
                    <Icon name="trash" size={13} color="#e05b5b"/>
                  </button>
                )}
                <button onClick={()=>setHistOpen(false)} style={{...ghostT,padding:"5px 9px",fontSize:"13px"}}>✕</button>
              </div>
            </div>

            <div style={{flex:1,overflowY:"auto",padding:"8px"}}>
              {editHistory.length===0&&(
                <div style={{textAlign:"center",padding:"28px 10px"}}>
                  <div style={{width:42,height:42,borderRadius:"9px",margin:"0 auto 10px",background:C.tdim,border:`1px dashed ${C.tborder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <Icon name="history" size={20} color={`rgba(13,148,136,0.4)`}/>
                  </div>
                  <div style={{fontSize:"11px",color:C.text3,lineHeight:"1.7"}}>All edits appear here</div>
                </div>
              )}

              {editHistory.map(item=>(
                <div key={item.id} className="hist-card">
                  <img src={item.isAI?item.aiResult:item.thumbnail} alt={item.label}
                    style={{width:"100%",height:"66px",objectFit:"cover",borderRadius:"5px",display:"block",marginBottom:"7px",cursor:"pointer",border:`1px solid ${item.isAI?C.vborder:C.tborder}`}}
                    onClick={()=>setViewItem(item)}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3px"}}>
                    <span style={{fontSize:"12px",fontWeight:700,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"115px"}}>{item.label}</span>
                    <span style={{fontSize:"9px",padding:"2px 6px",borderRadius:"4px",flexShrink:0,fontWeight:700,
                      background:item.isAI?C.vdim:C.tdim,color:item.isAI?VL:TL}}>
                      {item.isAI?"AI":"—"}
                    </span>
                  </div>
                  <div style={{fontSize:"10px",color:C.text3,marginBottom:"7px"}}>{item.timestamp}</div>
                  {item.metrics?.psnr&&(
                    <div style={{display:"flex",gap:"3px",marginBottom:"7px"}}>
                      {[["PSNR",item.metrics.psnr,TL],["SSIM",item.metrics.ssim,VL]].map(([k,v,col])=>(
                        <div key={k} style={{flex:1,background:C.bg,borderRadius:"4px",padding:"3px",textAlign:"center",border:`1px solid ${C.border}`}}>
                          <div style={{fontSize:"8px",color:C.text3,fontWeight:700,textTransform:"uppercase"}}>{k}</div>
                          <div style={{fontSize:"10px",color:col,fontWeight:700,fontFamily:"monospace"}}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{display:"flex",gap:"4px"}}>
                    <button onClick={()=>setViewItem(item)} title="View"
                      style={{...btn(),flex:1,padding:"5px",background:C.tdim,color:TL,border:`1px solid ${C.tborder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <Icon name="eye" size={14} color={TL}/>
                    </button>
                    <button onClick={()=>dlItem(item)} title="Download"
                      style={{...btn(),flex:1,padding:"5px",background:C.vdim,color:VL,border:`1px solid ${C.vborder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <Icon name="download" size={14} color={VL}/>
                    </button>
                    <button onClick={()=>setEditHistory(p=>p.filter(h=>h.id!==item.id))} title="Delete"
                      style={{...dangerBtn,flex:1,padding:"5px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <Icon name="trash" size={14} color="#e05b5b"/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}