import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/AuthContext";
import { useAppSettings } from "@/lib/AppSettingsContext";
import UserDashboard from "./UserDashboard";

const LOGO = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png";

function getInitial(email: string, username?: string) {
  const src = username || email;
  const ch = src.trim()[0];
  return ch ? ch.toUpperCase() : "?";
}

export function Header() {
  const { user, profile } = useAuth();
  const { lang, accentColor, theme } = useAppSettings();
  const [dashOpen, setDashOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = document.querySelector("main");
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 10);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const isDark = theme === "dark";
  const bg = isDark
    ? scrolled ? "bg-[#121212]/95 shadow-sm border-b border-white/8" : "bg-[#121212]/80"
    : scrolled ? "bg-white/95 shadow-sm border-b border-black/8" : "bg-white/80";

  const textClass = isDark ? "text-white" : "text-[#121212]";
  const subClass = isDark ? "text-white/40" : "text-[#121212]/40";

  return (
    <>
      {/* ONLY visible on mobile — desktop uses Sidebar */}
      <header
        className={`md:hidden fixed top-0 left-0 right-0 z-40 transition-all duration-300 backdrop-blur-md ${bg}`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <img src={LOGO} alt="Musika" className="h-7 w-7 object-contain" />
            <span className={`text-lg font-black tracking-tight ${textClass}`}>
              musi<span style={{ color: accentColor }}>ka</span>
            </span>
          </Link>

          <button
            onClick={() => setDashOpen(true)}
            className="flex items-center justify-center focus:outline-none active:scale-90 transition-transform"
            aria-label="Buka Dashboard"
          >
            {user ? (
              profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="avatar"
                  className="w-9 h-9 rounded-full object-cover border-2"
                  style={{ borderColor: accentColor }}
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-black text-sm font-bold shadow-lg"
                  style={{ background: accentColor }}
                >
                  {getInitial(user.email || "", profile?.username)}
                </div>
              )
            ) : (
              <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${isDark ? "border-white/20 bg-white/10" : "border-black/20 bg-black/5"}`}>
                <svg viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 ${subClass}`}>
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              </div>
            )}
          </button>
        </div>
      </header>

      <UserDashboard open={dashOpen} onClose={() => setDashOpen(false)} />
    </>
  );
}
