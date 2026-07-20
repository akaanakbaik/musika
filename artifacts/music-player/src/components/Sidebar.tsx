import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Home, Search, Heart, Clock, Library, Plus, Bot, Download, ChevronRight, Settings } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { usePlayer } from "@/lib/PlayerContext";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";
import UserDashboard from "./UserDashboard";

const LOGO = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png";

function isPWA() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://")
  );
}

function getInitial(email: string, username?: string) {
  const src = username || email;
  return src.trim()[0]?.toUpperCase() || "?";
}

export function Sidebar() {
  const [location, navigate] = useLocation();
  const { user, profile } = useAuth();
  const { queue } = usePlayer();
  const { theme, accentColor, lang } = useAppSettings();
  const [collapsed, setCollapsed] = useState(false);
  const [dashOpen, setDashOpen] = useState(false);
  const [pwa] = useState(() => isPWA());

  const isDark = theme === "dark";
  const sidebarBg = isDark ? "bg-[#0f0f0f] border-white/5" : "bg-white border-black/8";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";
  const activeClass = isDark ? "bg-white/10" : "bg-black/8";
  const inactiveClass = isDark ? "text-white/60 hover:text-white hover:bg-white/5" : "text-[#121212]/60 hover:text-[#121212] hover:bg-black/5";

  const navItems = [
    { path: "/", icon: Home, labelKey: "home" as const },
    { path: "/search", icon: Search, labelKey: "search" as const },
    { path: "/favorites", icon: Heart, labelKey: "favorites" as const },
    { path: "/history", icon: Clock, labelKey: "history" as const },
    { path: "/playlists", icon: Library, labelKey: "library" as const },
    { path: "/ai", icon: Bot, labelKey: "ai" as const },
    ...(!pwa ? [{ path: "/download-app", icon: Download, labelKey: "download_app" as const }] : []),
  ];

  return (
    <>
      <aside className={`hidden md:flex flex-col h-screen border-r transition-all duration-300 ${sidebarBg} ${collapsed ? "w-16" : "w-60"} flex-shrink-0`}>
        {/* Logo */}
        <div className={`flex items-center px-4 h-16 border-b ${isDark ? "border-white/5" : "border-black/8"} ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2 cursor-pointer">
              <img src={LOGO} alt="musika" className="h-7 w-7 object-contain" />
              <span className={`text-base font-black tracking-tight ${textP}`}>
                musi<span style={{ color: accentColor }}>ka</span>
              </span>
            </Link>
          )}
          <button onClick={() => setCollapsed(c => !c)} className={`${textS} hover:${isDark ? "text-white" : "text-[#121212]"} p-1.5 rounded-lg transition-colors`}>
            <ChevronRight className={`w-4 h-4 transition-transform ${collapsed ? "" : "rotate-180"}`} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto scrollbar-hide">
          {navItems.map(({ path, icon: Icon, labelKey }) => {
            const active = path === "/" ? location === "/" : location.startsWith(path);
            return (
              <Link
                key={path}
                href={path}
                className={`flex items-center gap-3.5 px-4 py-2.5 mx-2 rounded-xl transition-all duration-150 cursor-pointer mb-0.5 ${active ? `${activeClass} ${textP} font-semibold` : inactiveClass}`}
                title={collapsed ? t(lang, labelKey) : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" style={active ? { color: accentColor } : {}} />
                {!collapsed && <span className="text-sm">{t(lang, labelKey)}</span>}
              </Link>
            );
          })}

          {!collapsed && (
            <div className="mx-4 mt-4 mb-2">
              <div className={`flex items-center justify-between text-xs font-semibold uppercase tracking-wider px-1 mb-2 ${textS}`}>
                <span>{t(lang, "playlists")}</span>
                <button onClick={() => navigate("/playlists")} className="hover:opacity-100 opacity-70 transition-opacity">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className={`text-xs px-1 ${textS}`}>
                {queue.length === 0
                  ? (lang === "en" ? "Your playlists appear here" : "Playlist kamu di sini")
                  : `${queue.length} ${lang === "en" ? "in queue" : "dalam antrean"}`}
              </p>
            </div>
          )}
        </nav>

        {/* User section — opens UserDashboard */}
        <div className={`border-t ${isDark ? "border-white/5" : "border-black/8"} p-3`}>
          <button
            onClick={() => setDashOpen(true)}
            className={`flex items-center gap-3 w-full rounded-xl p-2 transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-black/5"} ${collapsed ? "justify-center" : ""}`}
            title={collapsed ? t(lang, "dashboard") : undefined}
          >
            {user ? (
              <>
                <div className="flex-shrink-0">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} className="w-8 h-8 rounded-full object-cover border-2" style={{ borderColor: accentColor }} alt="avatar" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-black text-sm font-bold" style={{ background: accentColor }}>
                      {getInitial(user.email || "", profile?.username)}
                    </div>
                  )}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`text-sm font-semibold truncate ${textP}`}>{profile?.username || user.email?.split("@")[0]}</p>
                    <p className={`text-xs truncate ${textS}`}>{user.email}</p>
                  </div>
                )}
                {!collapsed && <Settings className={`w-3.5 h-3.5 flex-shrink-0 ${textS}`} />}
              </>
            ) : (
              <>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? "bg-white/10" : "bg-black/10"}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 ${textS}`}>
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                  </svg>
                </div>
                {!collapsed && <span className={`text-sm font-medium ${textS}`}>{t(lang, "sign_in")}</span>}
              </>
            )}
          </button>
        </div>
      </aside>

      <UserDashboard open={dashOpen} onClose={() => setDashOpen(false)} />
    </>
  );
}
