import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Search, Heart, Clock, Library, Plus, Bot, Download, LogOut, User, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { usePlayer } from "@/lib/PlayerContext";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";

const LOGO = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png";

export function Sidebar() {
  const [location, navigate] = useLocation();
  const { user, profile, signOut } = useAuth();
  const { queue } = usePlayer();
  const { theme, accentColor, lang } = useAppSettings();
  const [collapsed, setCollapsed] = useState(false);

  const isDark = theme === "dark";
  const sidebarBg = isDark ? "bg-[#121212] border-white/5" : "bg-white border-black/8";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";
  const activeClass = isDark ? "bg-white/10 text-white" : "bg-black/8 text-[#121212]";
  const inactiveClass = isDark ? "text-white/60 hover:text-white hover:bg-white/5" : "text-[#121212]/60 hover:text-[#121212] hover:bg-black/5";

  const navItems = [
    { path: "/", icon: Home, labelKey: "home" as const },
    { path: "/search", icon: Search, labelKey: "search" as const },
    { path: "/favorites", icon: Heart, labelKey: "favorites" as const },
    { path: "/history", icon: Clock, labelKey: "history" as const },
    { path: "/playlists", icon: Library, labelKey: "library" as const },
    { path: "/ai", icon: Bot, labelKey: "ai" as const },
    { path: "/download-app", icon: Download, labelKey: "download_app" as const },
  ];

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "✓ " + t(lang, "sign_out") });
    navigate("/");
  };

  return (
    <aside className={`hidden md:flex flex-col h-screen border-r transition-all duration-300 ${sidebarBg} ${collapsed ? "w-16" : "w-64"} flex-shrink-0`}>
      <div className={`flex items-center px-4 h-16 border-b ${isDark ? "border-white/5" : "border-black/8"} ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src={LOGO} alt="musika" className="h-7 w-7 object-contain" />
            <span className={`text-base font-black tracking-tight ${textP}`}>musi<span style={{ color: accentColor }}>ka</span></span>
          </div>
        )}
        <button onClick={() => setCollapsed(c => !c)} className={`${textS} hover:${textP === "text-white" ? "text-white" : "text-[#121212]"} p-1 rounded transition-colors`}>
          <ChevronRight className={`w-4 h-4 transition-transform ${collapsed ? "" : "rotate-180"}`} />
        </button>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide">
        {navItems.map(({ path, icon: Icon, labelKey }) => {
          const active = location === path || (path !== "/" && location.startsWith(path));
          return (
            <Link
              key={path}
              href={path}
              className={`flex items-center gap-4 px-4 py-3 mx-2 rounded-lg transition-all duration-150 cursor-pointer ${active ? activeClass : inactiveClass}`}
              title={collapsed ? t(lang, labelKey) : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" style={active ? { color: accentColor } : {}} />
              {!collapsed && <span className="text-sm font-medium">{t(lang, labelKey)}</span>}
            </Link>
          );
        })}

        {!collapsed && (
          <div className="mx-4 mt-4 mb-2">
            <div className={`flex items-center justify-between text-xs font-semibold uppercase tracking-wider px-2 mb-2 ${textS}`}>
              <span>{t(lang, "playlists")}</span>
              <button onClick={() => navigate("/playlists")} className={`hover:${textP === "text-white" ? "text-white" : "text-[#121212]"} transition-colors`}>
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <p className={`text-xs px-2 ${textS}`}>{queue.length === 0 ? (lang === "en" ? "Your playlists will appear here" : "Playlist kamu akan muncul di sini") : `${queue.length} ${lang === "en" ? "songs in queue" : "lagu dalam antrean"}`}</p>
          </div>
        )}
      </nav>

      <div className={`border-t ${isDark ? "border-white/5" : "border-black/8"} p-3`}>
        {user ? (
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="flex-shrink-0 w-8 h-8">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="avatar" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-black text-sm font-bold" style={{ background: accentColor }}>
                  {(profile?.username || user.email || "U")[0].toUpperCase()}
                </div>
              )}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${textP}`}>{profile?.username || user.email?.split("@")[0]}</p>
                  <p className={`text-xs truncate ${textS}`}>{user.email}</p>
                </div>
                <button onClick={handleSignOut} className={`${textS} hover:text-red-400 p-1 transition-colors flex-shrink-0`} title={t(lang, "sign_out")}>
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ) : (
          <Link href="/auth" className={`flex items-center gap-3 ${textS} hover:${textP === "text-white" ? "text-white" : "text-[#121212]"} transition-colors cursor-pointer ${collapsed ? "justify-center" : ""}`}>
            <User className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{t(lang, "sign_in")}</span>}
          </Link>
        )}
      </div>
    </aside>
  );
}
