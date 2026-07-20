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

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 md:hidden ${isDark ? "glass-nav" : "glass-nav-light"}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around px-1 h-[60px]">
        {items.map(({ path, icon: Icon, labelKey }) => {
          const active = location === path || (path !== "/" && location.startsWith(path));
          const textClass = active
            ? (isDark ? "text-white" : "text-[#121212]")
            : (isDark ? "text-white/38" : "text-[#121212]/38");
          return (
            <Link
              key={path}
              href={path}
              className="relative flex flex-col items-center justify-center gap-0.5 w-14 h-full transition-all duration-200 active:scale-85 select-none touch-manipulation"
            >
              {/* Active indicator pill */}
              {active && (
                <span
                  className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full"
                  style={{ background: accentColor, boxShadow: `0 0 8px ${accentColor}88` }}
                />
              )}

              {/* Icon with glass bubble on active */}
              <div className={`relative flex items-center justify-center w-8 h-8 rounded-2xl transition-all duration-200 ${active ? "glass-btn" : ""}`}>
                <Icon
                  className={`w-5 h-5 transition-all duration-200 ${textClass}`}
                  strokeWidth={active ? 2.5 : 1.7}
                  style={active ? { color: isDark ? "white" : "#121212" } : {}}
                />
              </div>

              <span className={`text-[10px] font-medium transition-all duration-200 ${textClass} ${active ? "font-semibold" : ""}`}>
                {t(lang, labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
