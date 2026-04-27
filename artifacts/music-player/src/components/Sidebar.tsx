import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Search, Heart, Clock, Library, Plus, Bot, Download, LogOut, User, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { usePlayer } from "@/lib/PlayerContext";
import { toast } from "@/hooks/use-toast";

const LOGO_DARK = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png";

const navItems = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/search", icon: Search, label: "Search" },
  { path: "/favorites", icon: Heart, label: "Liked Songs" },
  { path: "/history", icon: Clock, label: "History" },
  { path: "/playlists", icon: Library, label: "Your Library" },
  { path: "/ai", icon: Bot, label: "Musika AI" },
  { path: "/download-app", icon: Download, label: "Download App" },
];

export function Sidebar() {
  const [location, navigate] = useLocation();
  const { user, profile, signOut } = useAuth();
  const { queue } = usePlayer();
  const [collapsed, setCollapsed] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Signed out successfully" });
    navigate("/");
  };

  return (
    <aside
      className={`hidden md:flex flex-col h-screen bg-[#121212] border-r border-white/5 transition-all duration-300 ${collapsed ? "w-16" : "w-64"} flex-shrink-0`}
    >
      {/* Logo */}
      <div className={`flex items-center px-4 h-16 border-b border-white/5 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <img src={LOGO_DARK} alt="musika" className="h-8 object-contain" />
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-white/50 hover:text-white p-1 rounded transition-colors"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${collapsed ? "" : "rotate-180"}`} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide">
        {navItems.map(({ path, icon: Icon, label }) => {
          const active = location === path;
          return (
            <Link
              key={path}
              href={path}
              className={`flex items-center gap-4 px-4 py-3 mx-2 rounded-lg transition-all duration-150 cursor-pointer
                ${active ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"}`}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{label}</span>}
            </Link>
          );
        })}

        {/* Playlists section */}
        {!collapsed && (
          <div className="mx-4 mt-4 mb-2">
            <div className="flex items-center justify-between text-white/40 text-xs font-semibold uppercase tracking-wider px-2 mb-2">
              <span>Playlists</span>
              <button
                onClick={() => navigate("/playlists")}
                className="hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {queue.length === 0 ? (
              <p className="text-white/30 text-xs px-2">Your playlists will appear here</p>
            ) : (
              <p className="text-white/30 text-xs px-2">{queue.length} songs in queue</p>
            )}
          </div>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-white/5 p-3">
        {user ? (
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <button onClick={() => navigate("/profile")} className="flex-shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="avatar" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center text-black text-sm font-bold">
                  {(profile?.username || user.email || "U")[0].toUpperCase()}
                </div>
              )}
            </button>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{profile?.username || user.email?.split("@")[0]}</p>
                  <p className="text-white/40 text-xs truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-white/40 hover:text-white p-1 transition-colors flex-shrink-0"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ) : (
          <Link
            href="/auth"
            className={`flex items-center gap-3 text-white/60 hover:text-white transition-colors cursor-pointer ${collapsed ? "justify-center" : ""}`}
          >
            <User className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Sign In</span>}
          </Link>
        )}
      </div>
    </aside>
  );
}
