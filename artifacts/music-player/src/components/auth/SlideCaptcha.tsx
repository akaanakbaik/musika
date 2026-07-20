import React, { useState, useRef, useCallback } from "react";

interface SlideCaptchaProps {
  onSuccess: () => void;
}

export function SlideCaptcha({ onSuccess }: SlideCaptchaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [sliderX, setSliderX] = useState(0);
  const [verified, setVerified] = useState(false);
  const [failed, setFailed] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const TARGET_PCT = 0.85;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (verified) return;
    setIsDragging(true);
    setFailed(false);
    startXRef.current = e.clientX - sliderX;
    document.addEventListener("mousemove", handleMouseMove as any);
    document.addEventListener("mouseup", handleMouseUp);
  }, [verified, sliderX]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (verified) return;
    setIsDragging(true);
    setFailed(false);
    startXRef.current = e.touches[0].clientX - sliderX;
    document.addEventListener("touchmove", handleTouchMove as any);
    document.addEventListener("touchend", handleTouchEnd);
  }, [verified, sliderX]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !trackRef.current) return;
    const trackWidth = trackRef.current.offsetWidth;
    const sliderWidth = 48;
    const maxX = trackWidth - sliderWidth;
    const newX = Math.max(0, Math.min(e.clientX - startXRef.current, maxX));
    setSliderX(newX);
  }, [isDragging]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || !trackRef.current) return;
    const trackWidth = trackRef.current.offsetWidth;
    const sliderWidth = 48;
    const maxX = trackWidth - sliderWidth;
    const newX = Math.max(0, Math.min(e.touches[0].clientX - startXRef.current, maxX));
    setSliderX(newX);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener("mousemove", handleMouseMove as any);
    document.removeEventListener("mouseup", handleMouseUp);
    checkSuccess();
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener("touchmove", handleTouchMove as any);
    document.removeEventListener("touchend", handleTouchEnd);
    checkSuccess();
  }, []);

  const checkSuccess = useCallback(() => {
    if (!trackRef.current) return;
    const trackWidth = trackRef.current.offsetWidth;
    const sliderWidth = 48;
    const maxX = trackWidth - sliderWidth;
    const pct = sliderX / maxX;
    if (pct >= TARGET_PCT) {
      setVerified(true);
      setSliderX(maxX);
      setTimeout(onSuccess, 400);
    } else {
      setFailed(true);
      setSliderX(0);
      setTimeout(() => setFailed(false), 1200);
    }
  }, [sliderX, onSuccess]);

  return (
    <div className="w-full">
      <p className="text-white/60 text-xs text-center mb-2">Slide to verify you're human</p>
      <div
        ref={trackRef}
        className={`relative h-12 rounded-full border-2 select-none overflow-hidden transition-colors ${
          verified ? "border-[#1DB954] bg-[#1DB954]/20" : failed ? "border-red-500 bg-red-500/10" : "border-white/20 bg-white/5"
        }`}
      >
        {/* Track fill */}
        <div
          className={`absolute top-0 left-0 h-full rounded-full transition-all ${verified ? "bg-[#1DB954]/40" : "bg-white/10"}`}
          style={{ width: `${sliderX + 48}px` }}
        />
        {/* Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={`text-xs font-medium transition-opacity ${sliderX > 60 ? "opacity-0" : "opacity-100"} ${verified ? "text-[#1DB954]" : failed ? "text-red-400" : "text-white/40"}`}>
            {verified ? "✓ Verified!" : failed ? "Try again" : "→ Slide to verify"}
          </span>
        </div>
        {/* Slider handle */}
        <div
          ref={sliderRef}
          className={`absolute top-1 w-10 h-10 rounded-full flex items-center justify-center text-lg cursor-grab active:cursor-grabbing shadow-lg transition-all duration-150 select-none ${
            verified ? "bg-[#1DB954] text-black" : "bg-white text-gray-800 hover:bg-gray-100"
          } ${isDragging ? "scale-105" : ""}`}
          style={{ left: `${sliderX + 4}px`, transition: isDragging ? "none" : "left 0.2s ease" }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {verified ? "✓" : "→"}
        </div>
      </div>
    </div>
  );
}
