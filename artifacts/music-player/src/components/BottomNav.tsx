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
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#121212] border-t border-white/10 flex items-center justify-around px-2 z-50 md:hidden">
      {items.map(({ path, icon: Icon, label }) => {
        const active = location === path;
        return (
          <Link
            key={path}
            href={path}
            className={`flex flex-col items-center gap-1 px-3 py-1 transition-colors ${active ? "text-white" : "text-white/50"}`}
          >
            <Icon className={`w-5 h-5 ${active ? "text-[#1DB954]" : ""}`} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
