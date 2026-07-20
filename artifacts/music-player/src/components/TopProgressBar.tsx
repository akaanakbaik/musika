import { useEffect, useRef, useState } from "react";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { useLocation } from "wouter";

let _start: (() => void) | null = null;
let _done: (() => void) | null = null;

export function startProgress() { _start?.(); }
export function doneProgress() { _done?.(); }

export function TopProgressBar() {
  const { accentColor } = useAppSettings();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [location] = useLocation();
  const prevLocation = useRef(location);

  function start() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(true);
    setWidth(0);
    requestAnimationFrame(() => { setWidth(65); });
    timerRef.current = setTimeout(() => setWidth(80), 500);
  }

  function done() {
    setWidth(100);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 350);
  }

  // Register callbacks so they can be called from anywhere
  useEffect(() => {
    _start = start;
    _done = done;
    return () => { _start = null; _done = null; };
  }, []);

  // Auto-trigger on route changes
  useEffect(() => {
    if (location !== prevLocation.current) {
      prevLocation.current = location;
      start();
      const t = setTimeout(done, 400);
      return () => clearTimeout(t);
    }
  }, [location]);

  if (!visible && width === 0) return null;

  return (
    <div
      id="musika-progress-bar"
      style={{
        width: `${width}%`,
        background: accentColor,
        color: accentColor,
        opacity: visible ? 1 : 0,
        transition: width === 100 ? "width 0.2s ease, opacity 0.35s ease 0.2s" : "width 0.4s ease",
      }}
    />
  );
}
