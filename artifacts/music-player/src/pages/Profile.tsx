import React, { useState, useRef, useEffect } from "react";
import {
  Camera, User, Mail, Edit2, Save, LogOut, Lock, Loader2, Bell, Sun, Moon,
  Globe, Palette, Gauge, Timer, ChevronRight, Shield, Volume2, Music2,
  Smartphone, Info, ExternalLink, RotateCcw, Check, X
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { toast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import AvatarCropper from "@/components/AvatarCropper";

const ACCENT_COLORS = [
  { label: "Hijau Spotify", value: "#1DB954" },
  { label: "Merah", value: "#E53E3E" },
  { label: "Biru", value: "#3B82F6" },
  { label: "Ungu", value: "#8B5CF6" },
  { label: "Orange", value: "#F97316" },
  { label: "Pink", value: "#EC4899" },
  { label: "Teal", value: "#14B8A6" },
  { label: "Kuning", value: "#F59E0B" },
];

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SLEEP_TIMERS = [
  { label: "Nonaktif", value: 0 },
  { label: "15 menit", value: 15 },
  { label: "30 menit", value: 30 },
  { label: "45 menit", value: 45 },
  { label: "1 jam", value: 60 },
  { label: "1.5 jam", value: 90 },
];

export default function Profile() {
  const { user, profile, updateProfile, uploadAvatar, signOut } = useAuth();
  const { theme, accentColor, lang, setTheme, setAccentColor, setLang } = useAppSettings();
  const [, navigate] = useLocation();

  const [tab, setTab] = useState<"profile" | "settings">("profile");
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(profile?.username || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [playbackSpeed, setPlaybackSpeed] = useState(() => {
    try { return Number(localStorage.getItem("musika-speed") || "1"); } catch { return 1; }
  });
  const [sleepTimer, setSleepTimer] = useState(0);
  const [sleepEnd, setSleepEnd] = useState<Date | null>(null);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#0d0d0d]" : "bg-[#F2F2F2]";
  const card = isDark ? "bg-[#181818] border-white/[0.07]" : "bg-white border-black/[0.07]";
  const textP = isDark ? "text-white" : "text-[#111]";
  const textS = isDark ? "text-white/45" : "text-[#111]/45";
  const inputCls = isDark
    ? "bg-white/[0.06] border-white/[0.10] text-white placeholder:text-white/25 focus:border-white/30"
    : "bg-black/[0.04] border-black/[0.10] text-[#111] placeholder:text-black/25 focus:border-black/30";
  const rowCls = isDark ? "hover:bg-white/[0.04]" : "hover:bg-black/[0.02]";

  useEffect(() => {
    setUsername(profile?.username || "");
    setBio(profile?.bio || "");
  }, [profile]);

  useEffect(() => {
    if (sleepTimer > 0) {
      const end = new Date(Date.now() + sleepTimer * 60 * 1000);
      setSleepEnd(end);
      const timer = setTimeout(() => {
        setSleepTimer(0);
        setSleepEnd(null);
        toast({ title: "⏱ Sleep timer selesai", description: "Musik telah dijeda oleh sleep timer" });
      }, sleepTimer * 60 * 1000);
      return () => clearTimeout(timer);
    } else {
      setSleepEnd(null);
    }
  }, [sleepTimer]);

  function saveSpeed(speed: number) {
    setPlaybackSpeed(speed);
    localStorage.setItem("musika-speed", String(speed));
    const audio = document.querySelector("audio");
    if (audio) audio.playbackRate = speed;
    toast({ title: `⚡ Kecepatan: ${speed}×` });
  }

  if (!user) {
    return (
      <div className={`min-h-screen ${bg} flex flex-col items-center justify-center text-center px-6 animate-fade-in`}>
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 shadow-xl"
          style={{ background: `linear-gradient(135deg, ${accentColor}33, ${accentColor}11)` }}>
          <Lock className="w-10 h-10" style={{ color: accentColor }} />
        </div>
        <h2 className={`text-xl font-bold mb-2 ${textP}`}>Masuk untuk lihat profil</h2>
        <Link href="/auth"
          className="font-bold px-8 py-3 rounded-full text-sm text-black mt-4 inline-block shadow-lg"
          style={{ background: accentColor }}>
          Masuk
        </Link>
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await updateProfile({ username: username.trim(), bio: bio.trim() });
    setSaving(false);
    if (error) toast({ title: "Gagal menyimpan", description: error, variant: "destructive" });
    else { toast({ title: "✓ Profil diperbarui" }); setEditing(false); }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    setShowCropper(true);
    e.target.value = "";
  }

  async function handleCroppedAvatar(blob: Blob) {
    setShowCropper(false);
    setUploading(true);
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    const { error } = await uploadAvatar(file);
    setUploading(false);
    if (error) toast({ title: "Upload gagal", description: error, variant: "destructive" });
    else toast({ title: "✓ Avatar diperbarui" });
  }

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  const avatarLetter = (profile?.username || user.email || "U")[0].toUpperCase();
  const gradientBg = `linear-gradient(135deg, ${accentColor}88, ${accentColor}44)`;

  return (
    <div className={`min-h-screen ${bg} pb-24 md:pb-8 animate-fade-in`}>
      {/* ── Gradient header ──────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ height: 160 }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${accentColor}44 0%, transparent 70%)` }} />
        <div className="absolute inset-0" style={{ background: isDark ? "linear-gradient(to bottom, transparent 30%, #0d0d0d)" : "linear-gradient(to bottom, transparent 30%, #F2F2F2)" }} />
      </div>

      {/* ── Avatar ──────────────────────────────────────────── */}
      <div className="relative -mt-20 px-4 md:px-6 flex items-end gap-4 mb-5">
        <div className="relative">
          <div className={`w-24 h-24 rounded-2xl border-4 overflow-hidden shadow-2xl flex-shrink-0 ${isDark ? "border-[#0d0d0d]" : "border-[#F2F2F2]"}`}>
            {uploading ? (
              <div className="w-full h-full flex items-center justify-center" style={{ background: gradientBg }}>
                <Loader2 className="w-7 h-7 text-white animate-spin" />
              </div>
            ) : profile?.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full object-cover" alt="avatar" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-black text-black" style={{ background: gradientBg }}>
                {avatarLetter}
              </div>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg transition-all active:scale-90"
            style={{ background: accentColor }}
          >
            <Camera className="w-4 h-4 text-black" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
        <div className="pb-1">
          <p className={`text-xs font-medium ${textS} mb-0.5`}>Profil</p>
          <h2 className={`text-2xl font-black tracking-tight ${textP}`}>
            {profile?.username || user.email?.split("@")[0]}
          </h2>
          <p className={`text-xs ${textS}`}>{user.email}</p>
        </div>
      </div>

      {/* Avatar Cropper */}
      {showCropper && cropFile && (
        <AvatarCropper
          file={cropFile}
          onCrop={handleCroppedAvatar}
          onCancel={() => setShowCropper(false)}
        />
      )}

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 mb-4">
        <div className={`flex gap-1 p-1 rounded-xl ${isDark ? "bg-white/[0.06]" : "bg-black/[0.06]"}`}>
          {(["profile", "settings"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t
                ? `text-black shadow-sm`
                : `${textS} hover:${textP}`
              }`}
              style={tab === t ? { background: accentColor } : {}}
            >
              {t === "profile" ? "Profil" : "Pengaturan"}
            </button>
          ))}
        </div>
      </div>

      {tab === "profile" ? (
        /* ── PROFILE TAB ──────────────────────────────────── */
        <div className="px-4 md:px-6 space-y-3">
          <div className={`rounded-2xl border ${card} overflow-hidden`}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
              <p className={`text-sm font-bold ${textP}`}>Informasi Akun</p>
              <button
                onClick={() => editing ? handleSave() : setEditing(true)}
                disabled={saving}
                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors`}
                style={{ color: accentColor }}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : editing ? <><Save className="w-3.5 h-3.5" />Simpan</>
                  : <><Edit2 className="w-3.5 h-3.5" />Edit</>}
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className={`text-xs font-semibold uppercase tracking-wider block mb-1.5 ${textS}`}>Email</label>
                <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${isDark ? "bg-white/[0.04]" : "bg-black/[0.04]"}`}>
                  <Mail className={`w-4 h-4 flex-shrink-0 ${textS}`} />
                  <span className={`text-sm ${textP}`}>{user.email}</span>
                </div>
              </div>

              <div>
                <label className={`text-xs font-semibold uppercase tracking-wider block mb-1.5 ${textS}`}>Username</label>
                {editing ? (
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2.5 outline-none text-sm transition-colors ${inputCls}`}
                    placeholder="Masukkan username"
                  />
                ) : (
                  <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${isDark ? "bg-white/[0.04]" : "bg-black/[0.04]"}`}>
                    <User className={`w-4 h-4 flex-shrink-0 ${textS}`} />
                    <span className={`text-sm ${textP}`}>{profile?.username || "Belum diatur"}</span>
                  </div>
                )}
              </div>

              <div>
                <label className={`text-xs font-semibold uppercase tracking-wider block mb-1.5 ${textS}`}>Bio</label>
                {editing ? (
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    rows={3}
                    placeholder="Ceritakan tentang dirimu…"
                    className={`w-full border rounded-xl px-3 py-2.5 outline-none resize-none text-sm transition-colors ${inputCls}`}
                  />
                ) : (
                  <div className={`rounded-xl px-3 py-2.5 ${isDark ? "bg-white/[0.04]" : "bg-black/[0.04]"}`}>
                    <span className={`text-sm ${textP}`}>{profile?.bio || "Belum ada bio"}</span>
                  </div>
                )}
              </div>

              {editing && (
                <button onClick={() => setEditing(false)} className={`w-full py-2 rounded-xl text-xs font-medium transition-colors ${isDark ? "bg-white/8 text-white" : "bg-black/8 text-[#111]"}`}>
                  Batal
                </button>
              )}
            </div>
          </div>

          {/* Logout */}
          <div className={`rounded-2xl border ${card} overflow-hidden`}>
            <button
              onClick={handleSignOut}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:text-red-300 transition-colors ${rowCls}`}
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-semibold">Keluar</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── SETTINGS TAB ─────────────────────────────────── */
        <div className="px-4 md:px-6 space-y-3">

          {/* Tampilan */}
          <SettingsSection title="Tampilan" isDark={isDark} textP={textP}>
            {/* Theme */}
            <div className={`flex items-center justify-between px-4 py-3 ${rowCls} transition-colors`}>
              <div className="flex items-center gap-3">
                {isDark ? <Moon className={`w-4 h-4 ${textS}`} /> : <Sun className={`w-4 h-4 ${textS}`} />}
                <div>
                  <p className={`text-sm font-medium ${textP}`}>Tema</p>
                  <p className={`text-xs ${textS}`}>{isDark ? "Gelap" : "Terang"}</p>
                </div>
              </div>
              <button
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className={`relative w-12 h-6 rounded-full toggle-track flex-shrink-0`}
                style={{ background: isDark ? accentColor : "rgba(0,0,0,0.15)" }}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow toggle-thumb ${isDark ? "left-6" : "left-0.5"}`} />
              </button>
            </div>

            {/* Accent color */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-3 mb-3">
                <Palette className={`w-4 h-4 ${textS}`} />
                <p className={`text-sm font-medium ${textP}`}>Warna Aksen</p>
              </div>
              <div className="grid grid-cols-8 gap-2">
                {ACCENT_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setAccentColor(c.value)}
                    className="relative w-full aspect-square rounded-full transition-transform active:scale-90"
                    style={{ background: c.value }}
                    title={c.label}
                  >
                    {accentColor === c.value && (
                      <Check className="w-3 h-3 text-black absolute inset-0 m-auto" />
                    )}
                  </button>
                ))}
              </div>
              {/* Custom color picker */}
              <div className="flex items-center gap-2 mt-2.5">
                <input
                  type="color"
                  value={accentColor}
                  onChange={e => setAccentColor(e.target.value)}
                  className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                />
                <span className={`text-xs ${textS}`}>Warna kustom</span>
                <span className={`text-xs font-mono ${textS}`}>{accentColor}</span>
              </div>
            </div>

            {/* Language */}
            <div className={`flex items-center justify-between px-4 py-3 ${rowCls} transition-colors`}>
              <div className="flex items-center gap-3">
                <Globe className={`w-4 h-4 ${textS}`} />
                <p className={`text-sm font-medium ${textP}`}>Bahasa</p>
              </div>
              <div className={`flex gap-1 p-0.5 rounded-lg ${isDark ? "bg-white/8" : "bg-black/8"}`}>
                {(["id", "en"] as const).map(l => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${lang === l
                      ? "text-black shadow-sm"
                      : `${textS}`
                    }`}
                    style={lang === l ? { background: accentColor } : {}}
                  >
                    {l === "id" ? "ID" : "EN"}
                  </button>
                ))}
              </div>
            </div>
          </SettingsSection>

          {/* Pemutaran */}
          <SettingsSection title="Pemutaran" isDark={isDark} textP={textP}>
            {/* Playback speed */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-3 mb-3">
                <Gauge className={`w-4 h-4 ${textS}`} />
                <div>
                  <p className={`text-sm font-medium ${textP}`}>Kecepatan Putar</p>
                  <p className={`text-xs ${textS}`}>Saat ini: {playbackSpeed}×</p>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {PLAYBACK_SPEEDS.map(s => (
                  <button
                    key={s}
                    onClick={() => saveSpeed(s)}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${playbackSpeed === s ? "text-black shadow-sm" : `${textS} ${isDark ? "bg-white/6 hover:bg-white/10" : "bg-black/5 hover:bg-black/8"}`}`}
                    style={playbackSpeed === s ? { background: accentColor } : {}}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>

            {/* Sleep timer */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-3 mb-3">
                <Timer className={`w-4 h-4 ${textS}`} />
                <div>
                  <p className={`text-sm font-medium ${textP}`}>Sleep Timer</p>
                  <p className={`text-xs ${textS}`}>
                    {sleepTimer > 0 && sleepEnd
                      ? `Berhenti pada ${sleepEnd.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                      : "Nonaktif"
                    }
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {SLEEP_TIMERS.map(st => (
                  <button
                    key={st.value}
                    onClick={() => setSleepTimer(st.value)}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${sleepTimer === st.value ? "text-black shadow-sm" : `${textS} ${isDark ? "bg-white/6 hover:bg-white/10" : "bg-black/5 hover:bg-black/8"}`}`}
                    style={sleepTimer === st.value ? { background: accentColor } : {}}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </SettingsSection>

          {/* Tentang */}
          <SettingsSection title="Tentang" isDark={isDark} textP={textP}>
            <a
              href="https://musika-one.vercel.app"
              target="_blank"
              rel="noreferrer"
              className={`flex items-center justify-between px-4 py-3 ${rowCls} transition-colors`}
            >
              <div className="flex items-center gap-3">
                <Music2 className={`w-4 h-4 ${textS}`} />
                <p className={`text-sm font-medium ${textP}`}>Musika Web App</p>
              </div>
              <ExternalLink className={`w-3.5 h-3.5 ${textS}`} />
            </a>
            <Link href="/download-app" className={`flex items-center justify-between px-4 py-3 ${rowCls} transition-colors`}>
              <div className="flex items-center gap-3">
                <Smartphone className={`w-4 h-4 ${textS}`} />
                <p className={`text-sm font-medium ${textP}`}>Unduh Aplikasi</p>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 ${textS}`} />
            </Link>
            <div className={`flex items-center justify-between px-4 py-3`}>
              <div className="flex items-center gap-3">
                <Info className={`w-4 h-4 ${textS}`} />
                <p className={`text-sm font-medium ${textP}`}>Versi Aplikasi</p>
              </div>
              <span className={`text-xs font-mono ${textS}`}>2.5.0</span>
            </div>
          </SettingsSection>

          {/* Bahaya */}
          <div className={`rounded-2xl border overflow-hidden border-red-500/20 ${isDark ? "bg-red-500/[0.04]" : "bg-red-50"}`}>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:text-red-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-semibold">Keluar dari Akun</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsSection({ title, isDark, textP, children }: {
  title: string; isDark: boolean; textP: string; children: React.ReactNode;
}) {
  return (
    <div>
      <p className={`text-xs font-bold uppercase tracking-wider px-1 mb-1.5 ${textP} opacity-40`}>{title}</p>
      <div className={`rounded-2xl border overflow-hidden divide-y ${isDark ? "bg-[#181818] border-white/[0.07] divide-white/[0.04]" : "bg-white border-black/[0.07] divide-black/[0.04]"}`}>
        {children}
      </div>
    </div>
  );
}
