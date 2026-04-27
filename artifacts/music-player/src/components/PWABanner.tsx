import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { X, Download } from "lucide-react";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";

function isPWA() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://")
  );
}

export function PWABanner() {
  const { theme, accentColor, lang } = useAppSettings();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isPWA()) return;
    const dismissed = sessionStorage.getItem("musika-pwa-banner");
    if (!dismissed) setShow(true);
  }, []);

  if (!show) return null;

  const isDark = theme === "dark";

  function dismiss() {
    sessionStorage.setItem("musika-pwa-banner", "1");
    setShow(false);
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-sm ${isDark ? "bg-[#1a1a1a] border-b border-white/8" : "bg-white border-b border-black/8"}`}>
      <span className="text-lg flex-shrink-0">📱</span>
      <p className={`flex-1 text-xs ${isDark ? "text-white/70" : "text-[#121212]/70"}`}>
        {lang === "en"
          ? "Install Musika for the best experience"
          : "Pasang Musika di HP untuk pengalaman terbaik"}
      </p>
      <Link
        href="/download-app"
        className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full text-black active:scale-95 transition-transform"
        style={{ background: accentColor }}
      >
        {lang === "en" ? "Install" : "Pasang"}
      </Link>
      <button onClick={dismiss} className={`flex-shrink-0 p-1 rounded-full ${isDark ? "hover:bg-white/10 text-white/50" : "hover:bg-black/10 text-black/50"} transition-colors`}>
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
