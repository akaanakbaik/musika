import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  X, Sun, Moon, LogOut, Trash2, Camera, User, FileText, Shield,
  ChevronRight, Clock, Heart, Search as SearchIcon, Music, Settings,
  Globe, Palette, Check, ArrowLeft, Info, Lock
} from "lucide-react";

const LOGO = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png";
const VERSION = "2.1.0";

const PRESET_COLORS = [
  { hex: "#1DB954", name: "Musika Green" },
  { hex: "#FF0000", name: "YouTube Red" },
  { hex: "#FF4E6B", name: "Rose" },
  { hex: "#FF5500", name: "SoundCloud Orange" },
];

type Panel = "main" | "account" | "history" | "app" | "history-likes" | "history-watch" | "history-search" | "about" | "privacy" | "terms";

interface HistoryItem {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  played_at?: string;
  liked_at?: string;
  query?: string;
}

function getInitial(email: string, username?: string) {
  const src = username || email;
  return src.trim()[0]?.toUpperCase() || "?";
}

export default function UserDashboard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile, signOut, updateProfile, uploadAvatar } = useAuth();
  const { theme, accentColor, lang, setTheme, setAccentColor, setLang } = useAppSettings();
  const [, navigate] = useLocation();
  const [panel, setPanel] = useState<Panel>("main");
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm" | "otp">("idle");
  const [deleteOtp, setDeleteOtp] = useState("");
  const [deletingSent, setDeletingSent] = useState(false);
  const [customColor, setCustomColor] = useState("");
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setTimeout(() => setPanel("main"), 300); }
    else {
      setEditName(profile?.username || "");
      setEditBio(profile?.bio || "");
      loadSearchHistory();
    }
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open, onClose]);

  function loadSearchHistory() {
    try {
      const raw = localStorage.getItem("musika-search-history");
      setSearchHistory(raw ? JSON.parse(raw) : []);
    } catch {}
  }

  async function loadWatchHistory() {
    if (!user) return;
    setHistoryLoading(true);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("play_history")
      .select("id,title,artist,duration,thumbnail,played_at")
      .eq("user_id", user.id)
      .gte("played_at", since)
      .order("played_at", { ascending: false })
      .limit(200);
    setHistoryItems((data || []) as HistoryItem[]);
    setHistoryLoading(false);
  }

  async function loadLikeHistory() {
    if (!user) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from("favorites")
      .select("id,title,artist,duration,thumbnail,liked_at")
      .eq("user_id", user.id)
      .order("liked_at", { ascending: false })
      .limit(100);
    setHistoryItems((data || []) as HistoryItem[]);
    setHistoryLoading(false);
  }

  function goPanel(p: Panel) {
    if (p === "history-watch") loadWatchHistory();
    if (p === "history-likes") loadLikeHistory();
    setPanel(p);
  }

  async function handleSaveProfile() {
    setSaving(true);
    const { error } = await updateProfile({ username: editName.trim(), bio: editBio.trim() });
    setSaving(false);
    if (error) toast({ title: "Gagal menyimpan", description: error, variant: "destructive" });
    else toast({ title: "✓ " + t(lang, "success"), description: "Profil diperbarui" });
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    toast({ title: "Mengunggah foto…" });
    const { error } = await uploadAvatar(file);
    if (error) toast({ title: "Gagal", description: error, variant: "destructive" });
    else toast({ title: "✓ Foto diperbarui!" });
  }

  async function handleResetAvatar() {
    const { error } = await updateProfile({ avatar_url: "" });
    if (!error) toast({ title: "✓ Foto direset ke default" });
  }

  async function handleSendDeleteOtp() {
    if (!user?.email) return;
    setDeletingSent(true);
    const res = await fetch(`${import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}/api/auth/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email })
    });
    const j = await res.json();
    if (j.success) {
      setDeleteStep("otp");
      toast({ title: "✉️ Kode OTP dikirim ke email" });
    } else {
      toast({ title: "Gagal", description: j.error, variant: "destructive" });
      setDeletingSent(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user?.email || !deleteOtp.trim()) return;
    const res = await fetch(`${import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}/api/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, code: deleteOtp.trim() })
    });
    const j = await res.json();
    if (!j.success) {
      toast({ title: "Kode salah", description: j.error, variant: "destructive" });
      return;
    }
    await supabase.from("favorites").delete().eq("user_id", user.id);
    await supabase.from("play_history").delete().eq("user_id", user.id);
    await supabase.from("playlists").delete().eq("user_id", user.id);
    await supabase.from("user_profiles").delete().eq("id", user.id);
    await signOut();
    onClose();
    toast({ title: "✓ " + t(lang, "account_deleted") });
  }

  function clearSearchHistory() {
    localStorage.removeItem("musika-search-history");
    setSearchHistory([]);
    toast({ title: "✓ Riwayat pencarian dihapus" });
  }

  async function clearWatchHistory() {
    if (!user) return;
    await supabase.from("play_history").delete().eq("user_id", user.id);
    setHistoryItems([]);
    toast({ title: "✓ Riwayat tonton dihapus" });
  }

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#121212]" : "bg-[#F5F5F5]";
  const cardBg = isDark ? "bg-[#1a1a1a]" : "bg-white";
  const borderC = isDark ? "border-white/8" : "border-black/8";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-black/5";

  function Row({ icon, label, sub, onClick, accent }: { icon: React.ReactNode; label: string; sub?: string; onClick?: () => void; accent?: boolean }) {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-3 w-full px-4 py-3.5 ${hoverBg} transition-colors text-left`}
      >
        <span className={accent ? "" : textS}>{icon}</span>
        <span className="flex-1 min-w-0">
          <span className={`block text-sm font-medium ${accent ? "" : textP}`} style={accent ? { color: accentColor } : {}}>{label}</span>
          {sub && <span className={`block text-xs mt-0.5 ${textS}`}>{sub}</span>}
        </span>
        <ChevronRight className={`w-4 h-4 flex-shrink-0 ${textS}`} />
      </button>
    );
  }

  const renderPanel = () => {
    if (panel === "account") {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PanelHeader title={t(lang, "account_settings")} onBack={() => setPanel("main")} onClose={onClose} isDark={isDark} textP={textP} textS={textS} accentColor={accentColor} />
          <div className="flex flex-col items-center py-6 gap-3 px-4">
            <div className="relative">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-20 h-20 rounded-full object-cover border-2" style={{ borderColor: accentColor }} alt="avatar" />
              ) : (
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-black text-2xl font-black shadow-lg" style={{ background: accentColor }}>
                  {getInitial(user?.email || "", profile?.username)}
                </div>
              )}
              <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#282828] border border-white/20 flex items-center justify-center">
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            {profile?.avatar_url && (
              <button onClick={handleResetAvatar} className={`text-xs ${textS} underline`}>{t(lang, "use_default")}</button>
            )}
          </div>

          <div className={`mx-4 rounded-xl overflow-hidden border ${borderC} ${cardBg} mb-4`}>
            <div className={`px-4 py-3 border-b ${borderC}`}>
              <label className={`text-xs font-semibold uppercase tracking-wider ${textS}`}>{t(lang, "username_label")}</label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Your name"
                className={`w-full bg-transparent mt-1 text-sm outline-none ${textP} placeholder:text-white/30`}
              />
            </div>
            <div className="px-4 py-3">
              <label className={`text-xs font-semibold uppercase tracking-wider ${textS}`}>{t(lang, "bio_label")}</label>
              <textarea
                value={editBio}
                onChange={e => setEditBio(e.target.value)}
                placeholder="Tell something about yourself…"
                rows={3}
                className={`w-full bg-transparent mt-1 text-sm outline-none resize-none ${textP} placeholder:text-white/30`}
              />
            </div>
          </div>

          <div className="px-4 mb-6">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full py-3 rounded-full font-bold text-sm transition-all active:scale-95 disabled:opacity-50 text-black"
              style={{ background: accentColor }}
            >
              {saving ? t(lang, "loading") : t(lang, "save")}
            </button>
          </div>

          <div className={`mx-4 mb-4 rounded-xl overflow-hidden border ${borderC} ${cardBg}`}>
            <div className={`px-4 py-3 border-b ${borderC}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${textS}`}>Email</p>
              <p className={`text-sm mt-1 ${textP}`}>{user?.email}</p>
            </div>
            <div className="px-4 py-3">
              <p className={`text-xs font-semibold uppercase tracking-wider ${textS}`}>Member Since</p>
              <p className={`text-sm mt-1 ${textP}`}>{user?.created_at ? new Date(user.created_at).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" }) : "-"}</p>
            </div>
          </div>

          {deleteStep === "idle" && (
            <div className="px-4 mb-6">
              <button onClick={() => setDeleteStep("confirm")} className="w-full py-3 rounded-full font-bold text-sm text-red-500 border border-red-500/30 hover:bg-red-500/10 transition-colors">
                {t(lang, "delete_account")}
              </button>
            </div>
          )}
          {deleteStep === "confirm" && (
            <div className="px-4 mb-6 space-y-2">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <p className="text-red-400 font-semibold text-sm mb-1">{t(lang, "confirm_delete")}</p>
                <p className="text-red-400/70 text-xs">{t(lang, "delete_warning")}</p>
              </div>
              <button onClick={handleSendDeleteOtp} disabled={deletingSent} className="w-full py-3 rounded-full font-bold text-sm bg-red-500 text-white disabled:opacity-50">
                {deletingSent ? t(lang, "loading") : "Kirim OTP Konfirmasi"}
              </button>
              <button onClick={() => setDeleteStep("idle")} className={`w-full py-2 text-sm ${textS}`}>{t(lang, "cancel")}</button>
            </div>
          )}
          {deleteStep === "otp" && (
            <div className="px-4 mb-6 space-y-2">
              <p className={`text-sm text-center ${textS}`}>{t(lang, "enter_otp")}</p>
              <input
                value={deleteOtp}
                onChange={e => setDeleteOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className={`w-full text-center text-2xl font-mono tracking-widest py-3 rounded-xl border ${borderC} ${cardBg} ${textP} bg-transparent outline-none`}
                maxLength={6}
              />
              <button onClick={handleDeleteAccount} disabled={deleteOtp.length < 6} className="w-full py-3 rounded-full font-bold text-sm bg-red-500 text-white disabled:opacity-50">
                {t(lang, "confirm")} &amp; {t(lang, "delete_account")}
              </button>
              <button onClick={() => { setDeleteStep("idle"); setDeleteOtp(""); setDeletingSent(false); }} className={`w-full py-2 text-sm ${textS}`}>{t(lang, "cancel")}</button>
            </div>
          )}
        </div>
      );
    }

    if (panel === "history") {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PanelHeader title={t(lang, "history")} onBack={() => setPanel("main")} onClose={onClose} isDark={isDark} textP={textP} textS={textS} accentColor={accentColor} />
          <div className={`rounded-xl mx-4 mt-4 overflow-hidden border ${borderC} ${cardBg}`}>
            <Row icon={<Heart className="w-5 h-5" />} label={t(lang, "liked_history")} onClick={() => goPanel("history-likes")} />
            <div className={`border-t ${borderC}`} />
            <Row icon={<Clock className="w-5 h-5" />} label={t(lang, "watch_history")} sub="30 hari terakhir" onClick={() => goPanel("history-watch")} />
            <div className={`border-t ${borderC}`} />
            <Row icon={<SearchIcon className="w-5 h-5" />} label={t(lang, "search_history")} onClick={() => goPanel("history-search")} />
          </div>
        </div>
      );
    }

    if (panel === "history-watch") {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PanelHeader title={t(lang, "watch_history")} onBack={() => setPanel("history")} onClose={onClose} isDark={isDark} textP={textP} textS={textS} accentColor={accentColor}
            action={historyItems.length > 0 ? { label: t(lang, "clear_all"), onClick: clearWatchHistory } : undefined}
          />
          {historyLoading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: accentColor }} /></div>
          ) : historyItems.length === 0 ? (
            <p className={`text-center py-12 ${textS} text-sm`}>{t(lang, "no_history")}</p>
          ) : (
            <div className="px-4 pb-6 space-y-2 mt-4">
              {historyItems.map((item, i) => (
                <div key={item.id || i} className={`flex items-center gap-3 p-3 rounded-xl ${cardBg} border ${borderC}`}>
                  <img src={item.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${textP}`}>{item.title}</p>
                    <p className={`text-xs truncate ${textS}`}>{item.artist}</p>
                    <p className={`text-xs mt-0.5 ${textS}`}>
                      {item.played_at ? new Date(item.played_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                      {item.duration ? ` · ${item.duration}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (panel === "history-likes") {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PanelHeader title={t(lang, "liked_history")} onBack={() => setPanel("history")} onClose={onClose} isDark={isDark} textP={textP} textS={textS} accentColor={accentColor} />
          {historyLoading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: accentColor }} /></div>
          ) : historyItems.length === 0 ? (
            <p className={`text-center py-12 ${textS} text-sm`}>{t(lang, "no_favorites")}</p>
          ) : (
            <div className="px-4 pb-6 space-y-2 mt-4">
              {historyItems.map((item, i) => (
                <div key={item.id || i} className={`flex items-center gap-3 p-3 rounded-xl ${cardBg} border ${borderC}`}>
                  <img src={item.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${textP}`}>{item.title}</p>
                    <p className={`text-xs truncate ${textS}`}>{item.artist}</p>
                    {item.liked_at && <p className={`text-xs mt-0.5 ${textS}`}>{new Date(item.liked_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</p>}
                  </div>
                  <Heart className="w-4 h-4 flex-shrink-0 fill-red-500 text-red-500" />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (panel === "history-search") {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PanelHeader title={t(lang, "search_history")} onBack={() => setPanel("history")} onClose={onClose} isDark={isDark} textP={textP} textS={textS} accentColor={accentColor}
            action={searchHistory.length > 0 ? { label: t(lang, "clear_all"), onClick: clearSearchHistory } : undefined}
          />
          {searchHistory.length === 0 ? (
            <p className={`text-center py-12 ${textS} text-sm`}>{t(lang, "no_history")}</p>
          ) : (
            <div className="px-4 pb-6 space-y-1.5 mt-4">
              {searchHistory.map((q, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${cardBg} border ${borderC}`}>
                  <SearchIcon className={`w-4 h-4 flex-shrink-0 ${textS}`} />
                  <p className={`text-sm ${textP}`}>{q}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (panel === "app") {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PanelHeader title={t(lang, "app_settings")} onBack={() => setPanel("main")} onClose={onClose} isDark={isDark} textP={textP} textS={textS} accentColor={accentColor} />

          <div className="px-4 mt-4 space-y-4 pb-6">
            {/* Theme */}
            <div className={`rounded-xl border ${borderC} ${cardBg} overflow-hidden`}>
              <div className={`px-4 py-2.5 border-b ${borderC}`}>
                <p className={`text-xs font-semibold uppercase tracking-wider ${textS}`}>{t(lang, "theme")}</p>
              </div>
              <div className="p-4 flex gap-3">
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${theme === "dark" ? "border-current" : `border-transparent ${isDark ? "bg-white/5" : "bg-black/5"}`}`}
                  style={theme === "dark" ? { borderColor: accentColor } : {}}
                >
                  <div className="relative w-8 h-8">
                    <MoonAnimated active={theme === "dark"} accentColor={accentColor} />
                  </div>
                  <span className={`text-xs font-medium ${textP}`}>{t(lang, "dark")}</span>
                </button>
                <button
                  onClick={() => setTheme("light")}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${theme === "light" ? "border-current" : `border-transparent ${isDark ? "bg-white/5" : "bg-black/5"}`}`}
                  style={theme === "light" ? { borderColor: accentColor } : {}}
                >
                  <div className="relative w-8 h-8">
                    <SunAnimated active={theme === "light"} accentColor={accentColor} />
                  </div>
                  <span className={`text-xs font-medium ${textP}`}>{t(lang, "light")}</span>
                </button>
              </div>
            </div>

            {/* Accent color */}
            <div className={`rounded-xl border ${borderC} ${cardBg} overflow-hidden`}>
              <div className={`px-4 py-2.5 border-b ${borderC}`}>
                <p className={`text-xs font-semibold uppercase tracking-wider ${textS}`}>{t(lang, "accent_color")}</p>
              </div>
              <div className="p-4 grid grid-cols-4 gap-3 mb-3">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => setAccentColor(c.hex)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-90 shadow-lg"
                      style={{ background: c.hex, transform: accentColor === c.hex ? "scale(1.15)" : "scale(1)", boxShadow: accentColor === c.hex ? `0 0 0 2px white, 0 0 0 4px ${c.hex}` : undefined }}
                    >
                      {accentColor === c.hex && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <span className={`text-xs ${textS} text-center leading-tight`}>{c.name}</span>
                  </button>
                ))}
              </div>
              <div className={`border-t ${borderC} px-4 py-3 flex items-center gap-2`}>
                <div className="w-7 h-7 rounded-full border-2 border-white/20 overflow-hidden flex-shrink-0" style={{ background: /^#[0-9A-Fa-f]{6}$/.test(customColor) ? customColor : accentColor }}>
                  <input type="color" value={/^#[0-9A-Fa-f]{6}$/.test(customColor) ? customColor : accentColor} onChange={e => { setCustomColor(e.target.value); setAccentColor(e.target.value); }} className="opacity-0 w-full h-full cursor-pointer" />
                </div>
                <input
                  value={customColor}
                  onChange={e => { setCustomColor(e.target.value); if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) setAccentColor(e.target.value); }}
                  placeholder="#1DB954"
                  className={`flex-1 bg-transparent text-sm outline-none font-mono ${textP} placeholder:${textS}`}
                  maxLength={7}
                />
              </div>
            </div>

            {/* Language */}
            <div className={`rounded-xl border ${borderC} ${cardBg} overflow-hidden`}>
              <div className={`px-4 py-2.5 border-b ${borderC}`}>
                <p className={`text-xs font-semibold uppercase tracking-wider ${textS}`}>{t(lang, "language")}</p>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                {([["id", "🇮🇩 Indonesia"], ["en", "🇬🇧 English"]] as [string, string][]).map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => setLang(code as any)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${lang === code ? "text-black font-bold" : `${textS} border-transparent ${isDark ? "bg-white/5" : "bg-black/5"}`}`}
                    style={lang === code ? { background: accentColor, borderColor: accentColor } : {}}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* About */}
            <div className={`rounded-xl border ${borderC} ${cardBg} overflow-hidden`}>
              <Row icon={<Info className="w-5 h-5" />} label={t(lang, "about")} sub={`Musika v${VERSION}`} onClick={() => setPanel("about")} />
              <div className={`border-t ${borderC}`} />
              <Row icon={<Shield className="w-5 h-5" />} label={t(lang, "privacy")} onClick={() => setPanel("privacy")} />
              <div className={`border-t ${borderC}`} />
              <Row icon={<FileText className="w-5 h-5" />} label={t(lang, "terms")} onClick={() => setPanel("terms")} />
            </div>
          </div>
        </div>
      );
    }

    if (panel === "about") {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PanelHeader title={t(lang, "about")} onBack={() => setPanel("app")} onClose={onClose} isDark={isDark} textP={textP} textS={textS} accentColor={accentColor} />
          <div className="flex flex-col items-center py-8 px-6 gap-4">
            <img src={LOGO} alt="Musika" className="w-16 h-16 object-contain" />
            <div className="text-center">
              <p className={`text-2xl font-black ${textP}`}>musi<span style={{ color: accentColor }}>ka</span></p>
              <p className={`text-sm mt-1 ${textS}`}>Your music, everywhere</p>
            </div>
            <div className={`w-full rounded-xl border ${borderC} ${cardBg} divide-y divide-white/5`}>
              {[["Version", VERSION], ["Build", "Stable"], ["Platform", "Web / PWA"], ["Developer", "Aka Nakbaik"], ["Contact", "akaanakbaik17@proton.me"]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-3">
                  <span className={`text-sm ${textS}`}>{k}</span>
                  <span className={`text-sm font-medium ${textP}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (panel === "privacy") {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PanelHeader title={t(lang, "privacy")} onBack={() => setPanel("app")} onClose={onClose} isDark={isDark} textP={textP} textS={textS} accentColor={accentColor} />
          <div className={`px-4 py-6 text-sm leading-relaxed ${textS} space-y-3`}>
            <p className={`font-semibold ${textP}`}>Kebijakan Privasi Musika</p>
            <p>Musika menghargai privasi Anda. Data yang kami kumpulkan hanya digunakan untuk memberikan pengalaman terbaik dalam mendengarkan musik.</p>
            <p>Kami tidak menjual atau membagikan data pribadi Anda kepada pihak ketiga tanpa persetujuan Anda.</p>
            <p>Data riwayat putar, playlist, dan preferensi disimpan secara aman di server Supabase yang terenkripsi.</p>
            <p>Anda dapat menghapus akun dan semua data terkait kapan saja melalui Pengaturan Akun.</p>
            <p className={`font-semibold ${textP}`}>Data yang Dikumpulkan</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Alamat email untuk autentikasi</li>
              <li>Riwayat lagu yang diputar</li>
              <li>Lagu favorit dan playlist</li>
              <li>Preferensi tema dan bahasa</li>
            </ul>
          </div>
        </div>
      );
    }

    if (panel === "terms") {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PanelHeader title={t(lang, "terms")} onBack={() => setPanel("app")} onClose={onClose} isDark={isDark} textP={textP} textS={textS} accentColor={accentColor} />
          <div className={`px-4 py-6 text-sm leading-relaxed ${textS} space-y-3`}>
            <p className={`font-semibold ${textP}`}>Syarat dan Ketentuan Musika</p>
            <p>Dengan menggunakan Musika, Anda setuju untuk mematuhi syarat dan ketentuan berikut ini.</p>
            <p>Musika menyediakan layanan streaming dan pencarian musik dari berbagai sumber termasuk YouTube, Spotify, Apple Music, dan SoundCloud.</p>
            <p>Pengguna dilarang menggunakan layanan ini untuk tujuan komersial tanpa izin tertulis dari pengembang.</p>
            <p>Musika tidak bertanggung jawab atas konten yang diberikan oleh pihak ketiga (YouTube, Spotify, dll).</p>
            <p>Kami berhak mengubah syarat dan ketentuan ini sewaktu-waktu dengan pemberitahuan sebelumnya.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className={`flex items-center justify-between px-4 py-4 border-b ${borderC}`}>
          <p className={`text-base font-bold ${textP}`}>{t(lang, "dashboard")}</p>
          <button onClick={onClose} className={`p-1.5 rounded-full ${isDark ? "hover:bg-white/10" : "hover:bg-black/10"} transition-colors`}>
            <X className={`w-5 h-5 ${textS}`} />
          </button>
        </div>

        {user ? (
          <>
            <div className="flex items-center gap-3 px-4 py-4">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-14 h-14 rounded-full object-cover border-2" style={{ borderColor: accentColor }} alt="avatar" />
              ) : (
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-black text-xl font-black shadow-lg" style={{ background: accentColor }}>
                  {getInitial(user.email || "", profile?.username)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-base truncate ${textP}`}>{profile?.username || user.email?.split("@")[0]}</p>
                <p className={`text-xs truncate ${textS}`}>{user.email}</p>
                {profile?.bio && <p className={`text-xs mt-0.5 truncate ${textS} italic`}>{profile.bio}</p>}
              </div>
            </div>

            <div className={`rounded-xl mx-4 mt-1 mb-4 overflow-hidden border ${borderC} ${cardBg}`}>
              <Row icon={<User className="w-5 h-5" />} label={t(lang, "account_settings")} sub={t(lang, "edit_name") + ", " + t(lang, "edit_photo") + ", " + t(lang, "edit_bio")} onClick={() => setPanel("account")} />
              <div className={`border-t ${borderC}`} />
              <Row icon={<Clock className="w-5 h-5" />} label={t(lang, "history")} sub={t(lang, "liked_history") + " · " + t(lang, "watch_history") + " · " + t(lang, "search_history")} onClick={() => setPanel("history")} />
              <div className={`border-t ${borderC}`} />
              <Row icon={<Settings className="w-5 h-5" />} label={t(lang, "app_settings")} sub={t(lang, "theme") + " · " + t(lang, "accent_color") + " · " + t(lang, "language")} onClick={() => setPanel("app")} />
            </div>

            <div className="px-4">
              <button
                onClick={async () => { await signOut(); onClose(); toast({ title: "✓ " + t(lang, "sign_out") }); }}
                className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium py-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {t(lang, "sign_out")}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-6 gap-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isDark ? "bg-white/10" : "bg-black/10"}`}>
              <User className={`w-10 h-10 ${textS}`} />
            </div>
            <div className="text-center">
              <p className={`font-bold text-lg ${textP}`}>{t(lang, "sign_in")}</p>
              <p className={`text-sm mt-1 ${textS}`}>{t(lang, "sign_in_desc")}</p>
            </div>
            <button
              onClick={() => { onClose(); navigate("/auth"); }}
              className="w-full max-w-xs py-3 rounded-full font-bold text-sm text-black active:scale-95 transition-all"
              style={{ background: accentColor }}
            >
              {t(lang, "sign_in_free")}
            </button>
            <div className={`mt-4 rounded-xl border ${borderC} ${cardBg} overflow-hidden w-full`}>
              <Row icon={<Settings className="w-5 h-5" />} label={t(lang, "app_settings")} onClick={() => setPanel("app")} />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm shadow-2xl transition-transform duration-300 ease-out flex flex-col ${bg}`}
        style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
        onClick={e => e.stopPropagation()}
      >
        {renderPanel()}
      </div>
    </>
  );
}

function PanelHeader({ title, onBack, onClose, isDark, textP, textS, accentColor, action }: {
  title: string; onBack: () => void; onClose: () => void; isDark: boolean; textP: string; textS: string; accentColor: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className={`flex items-center gap-2 px-4 py-4 border-b ${isDark ? "border-white/8" : "border-black/8"} flex-shrink-0`}>
      <button onClick={onBack} className={`p-1.5 rounded-full ${isDark ? "hover:bg-white/10" : "hover:bg-black/10"} transition-colors`}>
        <ArrowLeft className={`w-5 h-5 ${textS}`} />
      </button>
      <p className={`flex-1 text-base font-bold ${textP}`}>{title}</p>
      {action && (
        <button onClick={action.onClick} className="text-xs font-medium" style={{ color: accentColor }}>{action.label}</button>
      )}
      <button onClick={onClose} className={`p-1.5 rounded-full ${isDark ? "hover:bg-white/10" : "hover:bg-black/10"} transition-colors`}>
        <X className={`w-5 h-5 ${textS}`} />
      </button>
    </div>
  );
}

function MoonAnimated({ active, accentColor }: { active: boolean; accentColor: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8 transition-all duration-500" style={{ filter: active ? `drop-shadow(0 0 6px ${accentColor})` : "none" }}>
      <path d="M26 18.5A11 11 0 0 1 13.5 6a10 10 0 1 0 12.5 12.5z" fill={active ? accentColor : "#555"} className="transition-colors duration-500" />
      <circle cx="22" cy="8" r="1.5" fill={active ? accentColor : "#444"} className="transition-all duration-500" style={{ opacity: active ? 1 : 0 }} />
      <circle cx="26" cy="12" r="1" fill={active ? accentColor : "#444"} className="transition-all duration-500" style={{ opacity: active ? 0.7 : 0 }} />
    </svg>
  );
}

function SunAnimated({ active, accentColor }: { active: boolean; accentColor: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8" style={{ filter: active ? `drop-shadow(0 0 8px ${accentColor})` : "none" }}>
      <circle cx="16" cy="16" r="6" fill={active ? accentColor : "#555"} className="transition-colors duration-500" />
      {[0,45,90,135,180,225,270,315].map((deg, i) => (
        <line
          key={deg}
          x1={16 + 8 * Math.cos(deg * Math.PI / 180)}
          y1={16 + 8 * Math.sin(deg * Math.PI / 180)}
          x2={16 + 11 * Math.cos(deg * Math.PI / 180)}
          y2={16 + 11 * Math.sin(deg * Math.PI / 180)}
          stroke={active ? accentColor : "#555"}
          strokeWidth="2"
          strokeLinecap="round"
          className="transition-all duration-500"
          style={{
            opacity: active ? 1 : 0.4,
            transform: active ? "none" : `rotate(${i * 30}deg)`,
            transformOrigin: "16px 16px"
          }}
        />
      ))}
    </svg>
  );
}
