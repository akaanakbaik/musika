import React, { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Check, X } from "lucide-react";

interface AvatarCropperProps {
  file: File;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
  accentColor?: string;
}

export default function AvatarCropper({ file, onConfirm, onCancel, accentColor = "#1DB954" }: AvatarCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);
  const [objectUrl, setObjectUrl] = useState("");

  const SIZE = 280;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Center image, fit to size
      const fitScale = Math.max(SIZE / img.width, SIZE / img.height);
      setScale(fitScale);
      setPos({ x: 0, y: 0 });
      setImgLoaded(true);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, SIZE, SIZE);

    const w = img.width * scale;
    const h = img.height * scale;
    const cx = (SIZE - w) / 2 + pos.x;
    const cy = (SIZE - h) / 2 + pos.y;
    ctx.drawImage(img, cx, cy, w, h);

    // Circular mask
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }, [scale, pos, imgLoaded]);

  useEffect(() => { draw(); }, [draw]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handlePointerUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.max(0.3, Math.min(4, s - e.deltaY * 0.002)));
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (blob) onConfirm(blob);
    }, "image/jpeg", 0.92);
  };

  const reset = () => {
    const img = imgRef.current;
    if (!img) return;
    const fitScale = Math.max(SIZE / img.width, SIZE / img.height);
    setScale(fitScale);
    setPos({ x: 0, y: 0 });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
      <div className="bg-[#1a1a1a] rounded-3xl p-6 w-full max-w-sm mx-4 shadow-2xl border border-white/10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold text-base">Sesuaikan Foto Profil</h3>
          <button onClick={onCancel} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-white/40 text-xs mb-4 text-center">Seret untuk mengatur posisi • Scroll/pinch untuk zoom</p>

        {/* Canvas */}
        <div className="flex justify-center mb-5" ref={containerRef}>
          <div
            className={`relative rounded-full overflow-hidden border-4 cursor-grab active:cursor-grabbing select-none`}
            style={{ width: SIZE, height: SIZE, borderColor: accentColor, touchAction: "none" }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              className="block"
            />
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: accentColor }} />
              </div>
            )}
          </div>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-3 mb-5 px-2">
          <button onClick={() => setScale(s => Math.max(0.3, s - 0.1))} className="text-white/60 hover:text-white transition-colors">
            <ZoomOut className="w-5 h-5" />
          </button>
          <input
            type="range"
            min="30"
            max="400"
            value={Math.round(scale * 100)}
            onChange={e => setScale(Number(e.target.value) / 100)}
            className="flex-1 accent-current h-1"
            style={{ accentColor }}
          />
          <button onClick={() => setScale(s => Math.min(4, s + 0.1))} className="text-white/60 hover:text-white transition-colors">
            <ZoomIn className="w-5 h-5" />
          </button>
          <button onClick={reset} className="text-white/40 hover:text-white transition-colors ml-1">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl font-semibold text-sm text-white/70 bg-white/8 hover:bg-white/12 transition-colors border border-white/10"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={!imgLoaded}
            className="flex-1 py-3 rounded-2xl font-bold text-sm text-black flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            style={{ background: accentColor }}
          >
            <Check className="w-4 h-4" />
            Gunakan Foto
          </button>
        </div>
      </div>
    </div>
  );
}
