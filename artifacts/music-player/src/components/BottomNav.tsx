import React from "react";
import { Link, useLocation } from "wouter";
import { Home, Search, Heart, Library, Bot } from "lucide-react";

const items = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/search", icon: Search, label: "Search" },
  { path: "/favorites", icon: Heart, label: "Liked" },
  { path: "/playlists", icon: Library, label: "Library" },
  { path: "/ai", icon: Bot, label: "AI" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-white/8 flex items-center justify-around px-1 h-[60px]">
        {items.map(({ path, icon: Icon, label }) => {
          const active = location === path || (path !== "/" && location.startsWith(path));
          return (
            <Link
              key={path}
              href={path}
              className={`relative flex flex-col items-center justify-center gap-0.5 w-14 h-full transition-all duration-200 active:scale-90 select-none touch-manipulation`}
            >
              {active && (
                <span className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-[#1DB954]" />
              )}
              <Icon
                className={`w-5 h-5 transition-all duration-200 ${
                  active ? "text-white scale-110" : "text-white/40"
                }`}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span
                className={`text-[10px] font-medium transition-all duration-200 ${
                  active ? "text-white" : "text-white/40"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
