import React from "react";
import { Link, useLocation } from "wouter";
import { Home, Search, Heart, Library, Bot } from "lucide-react";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";

export function BottomNav() {
  const [location] = useLocation();
  const { theme, accentColor, lang } = useAppSettings();
  const isDark = theme === "dark";

  const items = [
    { path: "/", icon: Home, labelKey: "home" as const },
    { path: "/search", icon: Search, labelKey: "search" as const },
    { path: "/favorites", icon: Heart, labelKey: "favorites" as const },
    { path: "/playlists", icon: Library, labelKey: "library" as const },
    { path: "/ai", icon: Bot, labelKey: "ai" as const },
  ];

  const navBg = isDark
    ? "bg-[#0A0A0A]/95 border-white/8"
    : "bg-white/95 border-black/10";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className={`${navBg} backdrop-blur-xl border-t flex items-center justify-around px-1 h-[60px]`}>
        {items.map(({ path, icon: Icon, labelKey }) => {
          const active = location === path || (path !== "/" && location.startsWith(path));
          const textClass = active ? (isDark ? "text-white" : "text-[#121212]") : (isDark ? "text-white/40" : "text-[#121212]/40");
          return (
            <Link
              key={path}
              href={path}
              className="relative flex flex-col items-center justify-center gap-0.5 w-14 h-full transition-all duration-200 active:scale-90 select-none touch-manipulation"
            >
              {active && (
                <span className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full" style={{ background: accentColor }} />
              )}
              <Icon className={`w-5 h-5 transition-all duration-200 ${textClass}`} strokeWidth={active ? 2.5 : 1.8} style={active ? { color: isDark ? "white" : "#121212" } : {}} />
              <span className={`text-[10px] font-medium transition-all duration-200 ${textClass}`}>
                {t(lang, labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
