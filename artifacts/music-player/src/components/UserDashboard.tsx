import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  X, LogOut, Camera, User, Clock, Heart, Search as SearchIcon,
  Settings, ChevronRight, ArrowLeft, Copy, CheckCheck, Info, Lock,
  Trash2, Globe, Check, Palette, Music2, Shield, FileText, Disc3
} from "lucide-react";
import AvatarCropper from "./AvatarCropper";
import { getHQThumbnail, onThumbnailError } from "@/lib/utils";

const LOGO = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png";
const VERSION = "2.2.0";

type Panel = "main" | "account" | "app" | "history" | "history-likes" | "history-watch" | "history-search" | "about" | "privacy" | "terms";

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

const ACCENT_PRESETS = [
  { hex: "#1DB954", name: "Musika Green" },
  { hex: "#FF4E6B", name: "Rose" },
  { hex: "#FF5500", name: "SoundCloud" },
  { hex: "#6366F1", name: "Indigo" },
  { hex: "#F59E0B", name: "Amber" },
  { hex: "#06B6D4", name: "Cyan" },
];

function getInitial(email: string, username?: string) {
  const src = username || email;
  return src.trim()[0]?.toUpperCase() || "?";
}

function formatDate(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
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
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#121212]" : "bg-[#F8F8F8]";
  const card = isDark ? "bg-[#1e1e1e] border-white/8" : "bg-white border-black/8";
  const border = isDark ? "border-white/8" : "border-black/8";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";
  const hover = isDark ? "hover:bg-white/5" : "hover:bg-black/4";

  useEffect(() => {
    if (!open) { setTimeout(() => { setPanel("main"); setDeleteStep("idle"); }, 300); }
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
    const { data } = await supabase.from("play_history").select("id,title,artist,duration,thumbnail,played_at")
      .eq("user_id", user.id).gte("played_at", since).order("played_at", { ascending: false }).limit(200);
    setHistoryItems((data || []) as HistoryItem[]);
    setHistoryLoading(false);
  }

  async function loadLikeHistory() {
    if (!user) return;
    setHistoryLoading(true);
    const { data } = await supabase.from("favorites").select("id,title,artist,duration,thumbnail,liked_at")
      .eq("user_id", user.id).order("liked_at", { ascending: false }).limit(100);
    setHistoryItems((data || []) as HistoryItem[]);
    setHistoryLoading(false);
  }

  function goPanel(p: Panel) {
    if (p === "history-watch") loadWatchHistory();
    if (p === "history-likes") loadLikeHistory();
    setPanel(p);
  }

  async function handleSave() {
    if (!editName.trim()) { toast({ title: "Nama tidak boleh kosong", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await updateProfile({ username: editName.trim(), bio: editBio.trim() });
    setSaving(false);
    if (error) toast({ title: "Gagal menyimpan", description: error, variant: "destructive" });
    else toast({ title: "✓ Profil diperbarui!" });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!file.type.startsWith("image/")) {
      toast({ title: "Harus berupa gambar", variant: "destructive" }); return;
    }
    setCropFile(file);
  }

  async function handleCropConfirm(blob: Blob) {
    setCropFile(null);
    setUploading(true);
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    const { error } = await uploadAvatar(file);
    setUploading(false);
    if (error) toast({ title: "Upload gagal", description: error, variant: "destructive" });
    else toast({ title: "✓ Foto profil diperbarui!" });
  }

  function copyMusikalId() {
    if (!profile?.musika_id) return;
    navigator.clipboard.writeText(profile.musika_id).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    });
  }

  async function handleSendDeleteOtp() {
    if (!user?.email) return;
    setDeletingSent(true);
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    const res = await fetch(`${BASE}/api/auth/otp/send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email })
    });
    const j = await res.json();
    if (j.success) { setDeleteStep("otp"); toast({ title: "✉️ Kode OTP dikirim ke email" }); }
    else { toast({ title: "Gagal mengirim OTP", description: j.error, variant: "destructive" }); setDeletingSent(false); }
  }

  async function handleDeleteAccount() {
    if (!user?.email || !deleteOtp.trim()) return;
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    const res = await fetch(`${BASE}/api/auth/otp/verify`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, code: deleteOtp.trim() })
    });
    const j = await res.json();
    if (!j.success) { toast({ title: "Kode salah", description: j.error, variant: "destructive" }); return; }
    await supabase.from("favorites").delete().eq("user_id", user.id);
    await supabase.from("play_history").delete().eq("user_id", user.id);
    await supabase.from("playlists").delete().eq("user_id", user.id);
    await supabase.from("user_profiles").delete().eq("id", user.id);
    await signOut();
    onClose();
    toast({ title: "✓ Akun berhasil dihapus" });
  }

  function Row({ icon, label, sub, onClick, danger }: { icon: React.ReactNode; label: string; sub?: string; onClick?: () => void; danger?: boolean }) {
    return (
      <button onClick={onClick} className={`flex items-center gap-3.5 w-full px-4 py-3.5 ${hover} transition-colors text-left active:scale-[0.98]`}>
        <span className={danger ? "text-red-400" : textS}>{icon}</span>
        <span className="flex-1 min-w-0">
          <span className={`block text-sm font-medium ${danger ? "text-red-400" : textP}`}>{label}</span>
          {sub && <span className={`block text-xs mt-0.5 ${textS} leading-tight`}>{sub}</span>}
        </span>
        <ChevronRight className={`w-4 h-4 flex-shrink-0 ${textS}`} />
      </button>
    );
  }

  function PanelHeader({ title, onBack, action }: { title: string; onBack: () => void; action?: { label: string; onClick: () => void } }) {
    return (
      <div className={`flex items-center gap-2 px-4 py-4 border-b ${border} flex-shrink-0`}>
        <button onClick={onBack} className={`p-2 rounded-full ${hover} transition-colors`}>
          <ArrowLeft className={`w-5 h-5 ${textS}`} />
        </button>
        <p className={`flex-1 text-base font-bold ${textP}`}>{title}</p>
        {action && (
          <button onClick={action.onClick} className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors" style={{ color: accentColor, background: `${accentColor}18` }}>
            {action.label}
          </button>
        )}
        <button onClick={onClose} className={`p-2 rounded-full ${hover} transition-colors`}>
          <X className={`w-5 h-5 ${textS}`} />
        </button>
      </div>
    );
  }

  const renderPanel = () => {
    // ── ACCOUNT ──────────────────────────────────────────────────────────────
    if (panel === "account") {
      return (
        <div className="flex flex-col h-full">
          <PanelHeader title="Pengaturan Akun" onBack={() => setPanel("main")} />
          <div className="flex-1 overflow-y-auto pb-8">
            {/* Avatar */}
            <div className="flex flex-col items-center py-6 gap-2 px-4">
              <div className="relative">
                {uploading ? (
                  <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: `${accentColor}22` }}>
                    <div className="w-8 h-8 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: accentColor }} />
                  </div>
                ) : profile?.avatar_url ? (
                  <img src={profile.avatar_url} className="w-24 h-24 rounded-full object-cover border-4 shadow-lg" style={{ borderColor: accentColor }} alt="avatar" />
                ) : (
                  <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black text-black shadow-lg" style={{ background: accentColor }}>
                    {getInitial(user?.email || "", profile?.username)}
                  </div>
                )}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform active:scale-90"
                  style={{ background: "#282828", border: "2px solid rgba(255,255,255,0.15)" }}
                >
                  <Camera className="w-3.5 h-3.5 text-white" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              </div>
              <p className={`text-xs ${textS} text-center`}>Tap kamera untuk ganti foto • Geser & zoom untuk menyesuaikan</p>
              {profile?.musika_id && (
                <button onClick={copyMusikalId} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${border} ${hover} transition-colors mt-1`}>
                  <span className={`text-xs font-mono font-bold tracking-widest ${textP}`}>#{profile.musika_id}</span>
                  {copiedId
                    ? <CheckCheck className="w-3.5 h-3.5" style={{ color: accentColor }} />
                    : <Copy className={`w-3.5 h-3.5 ${textS}`} />
                  }
                </button>
              )}
            </div>

            {/* Edit fields */}
            <div className={`mx-4 rounded-2xl overflow-hidden border ${border} ${card} mb-4 divide-y ${isDark ? "divide-white/6" : "divide-black/6"}`}>
              <div className="px-4 pt-3 pb-2">
                <label className={`text-[10px] font-bold uppercase tracking-widest ${textS}`}>Nama Pengguna</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Nama kamu"
                  maxLength={30}
                  className={`w-full bg-transparent mt-1 text-sm outline-none ${textP}`}
                />
              </div>
              <div className="px-4 pt-3 pb-2">
                <label className={`text-[10px] font-bold uppercase tracking-widest ${textS}`}>Bio</label>
                <textarea
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  placeholder="Ceritakan sesuatu tentang dirimu…"
                  rows={3}
                  maxLength={160}
                  className={`w-full bg-transparent mt-1 text-sm outline-none resize-none ${textP}`}
                />
                <p className={`text-right text-[10px] ${textS} mt-1`}>{editBio.length}/160</p>
              </div>
            </div>

            <div className="px-4 mb-5">
              <button onClick={handleSave} disabled={saving}
                className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 text-black"
                style={{ background: accentColor }}>
                {saving ? "Menyimpan…" : "Simpan Perubahan"}
              </button>
            </div>

            {/* Info */}
            <div className={`mx-4 rounded-2xl overflow-hidden border ${border} ${card} mb-4 divide-y ${isDark ? "divide-white/6" : "divide-black/6"}`}>
              {([
                ["Email", user?.email || "-"],
                ["Bergabung", formatDate(user?.created_at)],
                ["Musika ID", profile?.musika_id ? `#${profile.musika_id}` : "Belum dibuat"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-3.5">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${textS}`}>{k}</span>
                  <span className={`text-sm font-medium ${textP} truncate max-w-[60%] text-right`}>{v}</span>
                </div>
              ))}
            </div>

            {/* Delete account */}
            <div className="px-4 mb-4">
              {deleteStep === "idle" && (
                <button onClick={() => setDeleteStep("confirm")} className="w-full py-3 rounded-2xl font-bold text-sm text-red-400 border border-red-500/20 hover:bg-red-500/8 transition-colors">
                  Hapus Akun
                </button>
              )}
              {deleteStep === "confirm" && (
                <div className="space-y-2">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                    <p className="text-red-400 font-bold text-sm mb-1">Yakin hapus akun?</p>
                    <p className="text-red-400/70 text-xs leading-relaxed">Semua data (riwayat, favorit, playlist) akan dihapus permanen. Konfirmasi dengan kode OTP.</p>
                  </div>
                  <button onClick={handleSendDeleteOtp} disabled={deletingSent} className="w-full py-3 rounded-2xl font-bold text-sm bg-red-500 text-white disabled:opacity-50 transition-all active:scale-95">
                    {deletingSent ? "Mengirim OTP…" : "Kirim Kode Konfirmasi"}
                  </button>
                  <button onClick={() => setDeleteStep("idle")} className={`w-full py-2 text-sm ${textS}`}>Batal</button>
                </div>
              )}
              {deleteStep === "otp" && (
                <div className="space-y-2">
                  <p className={`text-sm text-center ${textS}`}>Masukkan kode OTP dari email</p>
                  <input value={deleteOtp} onChange={e => setDeleteOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000" maxLength={6}
                    className={`w-full text-center text-2xl font-mono tracking-widest py-3.5 rounded-2xl border ${border} ${card} ${textP} bg-transparent outline-none`}
                  />
                  <button onClick={handleDeleteAccount} disabled={deleteOtp.length < 6} className="w-full py-3 rounded-2xl font-bold text-sm bg-red-500 text-white disabled:opacity-40 transition-all active:scale-95">
                    Konfirmasi & Hapus Akun
                  </button>
                  <button onClick={() => { setDeleteStep("idle"); setDeleteOtp(""); setDeletingSent(false); }} className={`w-full py-2 text-sm ${textS}`}>Batal</button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // ── APP SETTINGS ──────────────────────────────────────────────────────────
    if (panel === "app") {
      return (
        <div className="flex flex-col h-full">
          <PanelHeader title="Pengaturan Aplikasi" onBack={() => setPanel("main")} />
          <div className="flex-1 overflow-y-auto pb-8">
            {/* Theme */}
            <div className="px-4 pt-5 pb-3">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${textS} mb-3`}>Tema</p>
              <div className="grid grid-cols-2 gap-2">
                {(["dark", "light"] as const).map(th => (
                  <button key={th} onClick={() => setTheme(th)}
                    className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border ${border} transition-all active:scale-95 ${theme === th ? "" : card}`}
                    style={theme === th ? { background: accentColor, borderColor: accentColor } : {}}>
                    <span className={`text-sm font-semibold ${theme === th ? "text-black" : textP}`}>{th === "dark" ? "🌙 Gelap" : "☀️ Terang"}</span>
                    {theme === th && <Check className="w-4 h-4 text-black" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent */}
            <div className="px-4 pb-4">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${textS} mb-3`}>Warna Aksen</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {ACCENT_PRESETS.map(({ hex, name }) => (
                  <button key={hex} onClick={() => setAccentColor(hex)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all active:scale-95 ${accentColor === hex ? "" : card}`}
                    style={accentColor === hex ? { borderColor: hex, background: `${hex}22` } : {}}>
                    <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: hex }} />
                    <span className={`text-xs font-medium truncate ${textP}`}>{name}</span>
                    {accentColor === hex && <Check className="w-3 h-3 ml-auto flex-shrink-0" style={{ color: hex }} />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${textS}`}>Kustom:</span>
                <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent" />
                <span className={`text-xs font-mono ${textS}`}>{accentColor.toUpperCase()}</span>
              </div>
            </div>

            {/* Language */}
            <div className="px-4 pb-4">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${textS} mb-3`}>Bahasa</p>
              <div className="flex gap-2">
                {(["id", "en"] as const).map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all active:scale-95 ${border}`}
                    style={lang === l ? { background: accentColor, borderColor: accentColor, color: "black" } : { color: isDark ? "white" : "#121212", background: isDark ? "#1e1e1e" : "white" }}>
                    {l === "id" ? "🇮🇩 Indonesia" : "🇺🇸 English"}
                  </button>
                ))}
              </div>
            </div>

            {/* Legal */}
            <div className={`mx-4 rounded-2xl overflow-hidden border ${border} ${card}`}>
              <Row icon={<Shield className="w-5 h-5" />} label="Kebijakan Privasi" onClick={() => setPanel("privacy")} />
              <div className={`border-t ${border}`} />
              <Row icon={<FileText className="w-5 h-5" />} label="Syarat & Ketentuan" onClick={() => setPanel("terms")} />
              <div className={`border-t ${border}`} />
              <Row icon={<Info className="w-5 h-5" />} label="Tentang Musika" onClick={() => setPanel("about")} />
            </div>
          </div>
        </div>
      );
    }

    // ── HISTORY ───────────────────────────────────────────────────────────────
    if (panel === "history") {
      return (
        <div className="flex flex-col h-full">
          <PanelHeader title="Riwayat" onBack={() => setPanel("main")} />
          <div className="flex-1 overflow-y-auto">
            <div className={`rounded-2xl mx-4 mt-4 overflow-hidden border ${border} ${card}`}>
              <Row icon={<Heart className="w-5 h-5" />} label="Lagu Disukai" onClick={() => goPanel("history-likes")} />
              <div className={`border-t ${border}`} />
              <Row icon={<Clock className="w-5 h-5" />} label="Riwayat Putar" sub="30 hari terakhir" onClick={() => goPanel("history-watch")} />
              <div className={`border-t ${border}`} />
              <Row icon={<SearchIcon className="w-5 h-5" />} label="Riwayat Pencarian" onClick={() => goPanel("history-search")} />
            </div>
          </div>
        </div>
      );
    }

    if (panel === "history-watch" || panel === "history-likes") {
      const isWatch = panel === "history-watch";
      return (
        <div className="flex flex-col h-full">
          <PanelHeader
            title={isWatch ? "Riwayat Putar" : "Lagu Disukai"}
            onBack={() => setPanel("history")}
            action={historyItems.length > 0 ? {
              label: "Hapus Semua",
              onClick: async () => {
                if (!user) return;
                if (isWatch) { await supabase.from("play_history").delete().eq("user_id", user.id); setHistoryItems([]); }
                else { await supabase.from("favorites").delete().eq("user_id", user.id); setHistoryItems([]); }
                toast({ title: "✓ Riwayat dihapus" });
              }
            } : undefined}
          />
          <div className="flex-1 overflow-y-auto">
            {historyLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-7 h-7 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: accentColor }} />
              </div>
            ) : historyItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Music2 className={`w-12 h-12 ${textS}`} />
                <p className={`text-sm ${textS}`}>Belum ada riwayat</p>
              </div>
            ) : (
              <div className="px-4 pb-6 space-y-1.5 mt-4">
                {historyItems.map(item => (
                  <div key={item.id} className={`flex items-center gap-3 p-3 rounded-2xl ${card} border`}>
                    <img src={getHQThumbnail(item.thumbnail)} className="w-12 h-12 rounded-xl object-cover img-hq flex-shrink-0"
                      loading="lazy" decoding="async"
                      onError={e => onThumbnailError(e, item.thumbnail)} alt="" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${textP}`}>{item.title}</p>
                      <p className={`text-xs truncate ${textS}`}>{item.artist}</p>
                      {(item.played_at || item.liked_at) && (
                        <p className={`text-[10px] ${textS} mt-0.5`}>{formatDate(item.played_at || item.liked_at)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (panel === "history-search") {
      return (
        <div className="flex flex-col h-full">
          <PanelHeader
            title="Riwayat Pencarian"
            onBack={() => setPanel("history")}
            action={searchHistory.length > 0 ? {
              label: "Hapus Semua",
              onClick: () => { localStorage.removeItem("musika-search-history"); setSearchHistory([]); toast({ title: "✓ Riwayat pencarian dihapus" }); }
            } : undefined}
          />
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-2">
            {searchHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <SearchIcon className={`w-10 h-10 ${textS}`} />
                <p className={`text-sm ${textS}`}>Tidak ada riwayat pencarian</p>
              </div>
            ) : (
              searchHistory.map((q, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${card} border`}>
                  <SearchIcon className={`w-4 h-4 flex-shrink-0 ${textS}`} />
                  <span className={`text-sm ${textP} truncate`}>{q}</span>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    if (panel === "about") {
      return (
        <div className="flex flex-col h-full">
          <PanelHeader title="Tentang Musika" onBack={() => setPanel("app")} />
          <div className="flex-1 overflow-y-auto pb-8">
            <div className="flex flex-col items-center py-8 px-6 gap-5">
              <div className="relative">
                <div className="absolute inset-0 rounded-3xl blur-2xl scale-150 animate-pulse" style={{ background: `${accentColor}33` }} />
                <div className={`relative w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl border ${border} ${card}`}>
                  <img src={LOGO} alt="Musika" className="w-14 h-14 object-contain" />
                </div>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-black ${textP}`}>musi<span style={{ color: accentColor }}>ka</span></p>
                <p className={`text-sm mt-1 ${textS}`}>Your music, everywhere</p>
                <p className="text-xs mt-2 px-3 py-1 rounded-full font-medium inline-block" style={{ background: `${accentColor}22`, color: accentColor }}>v{VERSION} Stable</p>
              </div>
              <div className={`w-full rounded-2xl border ${border} ${card} overflow-hidden`}>
                {([["Versi", VERSION], ["Build", "Stable"], ["Platform", "Web / PWA"], ["Developer", "Aka Nakbaik"], ["Kontak", "akaanakbaik17@proton.me"]] as [string, string][]).map(([k, v]) => (
                  <div key={k} className={`flex items-center justify-between px-4 py-3.5 border-b ${border} last:border-0`}>
                    <span className={`text-sm ${textS}`}>{k}</span>
                    <span className={`text-sm font-semibold ${textP}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (panel === "privacy") {
      return (
        <div className="flex flex-col h-full">
          <PanelHeader title="Kebijakan Privasi" onBack={() => setPanel("app")} />
          <div className={`flex-1 overflow-y-auto px-5 py-6 text-sm leading-relaxed space-y-4 ${textS}`}>
            <p className={`font-bold text-base ${textP}`}>Kebijakan Privasi Musika</p>
            <p>Musika menghargai privasi Anda sepenuhnya. Data yang kami kumpulkan hanya digunakan untuk memberikan pengalaman terbaik dalam mendengarkan musik.</p>
            <p>Kami tidak menjual atau membagikan data pribadi Anda kepada pihak ketiga tanpa persetujuan Anda.</p>
            <p className={`font-semibold ${textP}`}>Data yang Dikumpulkan</p>
            <ul className="space-y-1.5 ml-4 list-disc">
              {["Alamat email untuk autentikasi", "Riwayat lagu yang diputar", "Lagu favorit dan playlist", "Preferensi tema, bahasa, dan warna aksen"].map(d => <li key={d}>{d}</li>)}
            </ul>
            <p>Data disimpan secara aman menggunakan Supabase dengan enkripsi end-to-end. Anda dapat menghapus semua data melalui menu Hapus Akun kapan saja.</p>
          </div>
        </div>
      );
    }

    if (panel === "terms") {
      return (
        <div className="flex flex-col h-full">
          <PanelHeader title="Syarat & Ketentuan" onBack={() => setPanel("app")} />
          <div className={`flex-1 overflow-y-auto px-5 py-6 text-sm leading-relaxed space-y-4 ${textS}`}>
            <p className={`font-bold text-base ${textP}`}>Syarat dan Ketentuan Musika</p>
            <p>Dengan menggunakan Musika, Anda setuju untuk mematuhi syarat dan ketentuan berikut.</p>
            <p>Musika menyediakan layanan streaming dan pencarian musik dari berbagai sumber termasuk YouTube, Spotify, Apple Music, dan SoundCloud.</p>
            <ul className="space-y-1.5 ml-4 list-disc">
              <li>Dilarang menggunakan untuk tujuan komersial tanpa izin</li>
              <li>Musika tidak bertanggung jawab atas konten pihak ketiga</li>
              <li>Syarat dapat berubah dengan pemberitahuan sebelumnya</li>
            </ul>
          </div>
        </div>
      );
    }

    // ── MAIN ─────────────────────────────────────────────────────────────────
    return (
      <div className="flex flex-col h-full">
        <div className={`flex items-center justify-between px-4 py-4 border-b ${border} flex-shrink-0`}>
          <p className={`text-base font-bold ${textP}`}>Dashboard</p>
          <button onClick={onClose} className={`p-2 rounded-full ${hover} transition-colors`}>
            <X className={`w-5 h-5 ${textS}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          {user ? (
            <>
              {/* Profile card */}
              <div className="px-4 pt-4 pb-2">
                <div className={`rounded-2xl border ${border} ${card} p-4 flex items-center gap-4`}>
                  <button onClick={() => setPanel("account")} className="relative flex-shrink-0 group active:scale-95 transition-transform">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} className="w-16 h-16 rounded-full object-cover shadow" style={{ border: `3px solid ${accentColor}` }} alt="avatar" />
                    ) : (
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black text-black shadow" style={{ background: accentColor }}>
                        {getInitial(user.email || "", profile?.username)}
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#282828] border border-white/20 flex items-center justify-center">
                      <Camera className="w-3 h-3 text-white/70" />
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-base truncate ${textP}`}>{profile?.username || user.email?.split("@")[0]}</p>
                    <p className={`text-xs truncate ${textS}`}>{user.email}</p>
                    {profile?.bio && <p className={`text-xs mt-1 line-clamp-1 ${textS} italic`}>"{profile.bio}"</p>}
                    {profile?.musika_id && (
                      <button onClick={copyMusikalId} className="flex items-center gap-1 mt-1.5 group">
                        <span className="text-[11px] font-mono font-bold tracking-widest px-2 py-0.5 rounded-md" style={{ background: `${accentColor}18`, color: accentColor }}>
                          #{profile.musika_id}
                        </span>
                        {copiedId
                          ? <CheckCheck className="w-3 h-3" style={{ color: accentColor }} />
                          : <Copy className={`w-3 h-3 ${textS} opacity-60 group-hover:opacity-100 transition-opacity`} />
                        }
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Menu */}
              <div className={`rounded-2xl mx-4 mt-3 overflow-hidden border ${border} ${card}`}>
                <Row icon={<User className="w-5 h-5" />} label="Pengaturan Akun" sub="Nama, foto, bio, ID akun" onClick={() => setPanel("account")} />
                <div className={`border-t ${border}`} />
                <Row icon={<Clock className="w-5 h-5" />} label="Riwayat" sub="Disukai · Putar · Pencarian" onClick={() => setPanel("history")} />
                <div className={`border-t ${border}`} />
                <Row icon={<Settings className="w-5 h-5" />} label="Pengaturan Aplikasi" sub="Tema · Warna · Bahasa" onClick={() => setPanel("app")} />
              </div>

              <div className="px-4 mt-4">
                <button
                  onClick={async () => { await signOut(); onClose(); toast({ title: "✓ Berhasil keluar" }); }}
                  className="flex items-center gap-2.5 text-red-400 hover:text-red-300 text-sm font-semibold py-2.5 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Keluar dari Akun
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 px-6 gap-5">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center ${isDark ? "bg-white/8" : "bg-black/8"}`}>
                <User className={`w-12 h-12 ${textS}`} />
              </div>
              <div className="text-center">
                <p className={`font-black text-xl ${textP}`}>Masuk ke Musika</p>
                <p className={`text-sm mt-1.5 ${textS} leading-relaxed`}>Simpan favorit, buat playlist, dan nikmati musik tanpa batas.</p>
              </div>
              <button onClick={() => { onClose(); navigate("/auth"); }}
                className="w-full max-w-xs py-3.5 rounded-2xl font-bold text-sm text-black active:scale-95 transition-all shadow-lg"
                style={{ background: accentColor }}>
                Masuk / Daftar Gratis
              </button>
              <div className={`mt-2 rounded-2xl border ${border} ${card} overflow-hidden w-full`}>
                <Row icon={<Settings className="w-5 h-5" />} label="Pengaturan Aplikasi" onClick={() => setPanel("app")} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Avatar Cropper popup */}
      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
          accentColor={accentColor}
        />
      )}

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm shadow-2xl transition-transform duration-300 ease-out flex flex-col ${bg}`}
        style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
        onClick={e => e.stopPropagation()}
      >
        {renderPanel()}
      </div>
    </>
  );
}
