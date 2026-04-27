import React, { useState, useRef } from "react";
import { Camera, User, Mail, Edit2, Save, LogOut, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";

export default function Profile() {
  const { user, profile, updateProfile, uploadAvatar, signOut } = useAuth();
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(profile?.username || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center text-center px-4">
        <Lock className="w-16 h-16 text-white/20 mb-4" />
        <h2 className="text-white text-2xl font-bold mb-2">Sign in to view your profile</h2>
        <Link href="/auth" className="bg-[#1DB954] text-black font-bold px-8 py-3 rounded-full hover:bg-[#1ed760] transition-colors mt-4 inline-block">
          Sign In
        </Link>
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await updateProfile({ username: username.trim(), bio: bio.trim() });
    setSaving(false);
    if (error) toast({ title: "Failed to save", description: error, variant: "destructive" });
    else { toast({ title: "Profile updated ✓" }); setEditing(false); }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { error } = await uploadAvatar(file);
    setUploading(false);
    if (error) toast({ title: "Upload failed", description: error, variant: "destructive" });
    else toast({ title: "Avatar updated ✓" });
  }

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-[#121212] pb-24 md:pb-8">
      {/* Header banner */}
      <div className="bg-gradient-to-b from-[#1DB954]/30 to-[#121212] px-4 md:px-8 pt-8 pb-20">
        <h1 className="text-white/50 text-sm font-semibold uppercase tracking-wider">Profile</h1>
      </div>

      {/* Avatar */}
      <div className="relative -mt-16 px-4 md:px-8 flex items-end gap-6 mb-6">
        <div className="relative group">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[#121212] overflow-hidden shadow-2xl">
            {uploading ? (
              <div className="w-full h-full bg-white/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            ) : profile?.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full object-cover" alt="avatar" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1DB954] to-emerald-800 flex items-center justify-center text-5xl font-black text-black">
                {(profile?.username || user.email || "U")[0].toUpperCase()}
              </div>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 w-10 h-10 bg-[#1DB954] rounded-full flex items-center justify-center shadow-lg hover:bg-[#1ed760] transition-colors"
          >
            <Camera className="w-5 h-5 text-black" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div>
          <p className="text-white/60 text-sm font-semibold uppercase tracking-wider">Profile</p>
          <h2 className="text-white text-3xl md:text-4xl font-black">{profile?.username || user.email?.split("@")[0]}</h2>
        </div>
      </div>

      {/* Info */}
      <div className="px-4 md:px-8 space-y-4">
        <div className="bg-[#1A1A1A] rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold">Account Info</h3>
            <button
              onClick={() => editing ? handleSave() : setEditing(true)}
              disabled={saving}
              className="flex items-center gap-2 text-[#1DB954] hover:text-[#1ed760] text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? <><Save className="w-4 h-4" /> Save</> : <><Edit2 className="w-4 h-4" /> Edit</>}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-white/50 text-xs uppercase font-semibold tracking-wider block mb-1">Email</label>
              <div className="flex items-center gap-2 bg-white/5 rounded-lg px-4 py-3">
                <Mail className="w-4 h-4 text-white/40 flex-shrink-0" />
                <span className="text-white text-sm">{user.email}</span>
              </div>
            </div>

            <div>
              <label className="text-white/50 text-xs uppercase font-semibold tracking-wider block mb-1">Username</label>
              {editing ? (
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-[#1DB954] rounded-lg px-4 py-3 text-white focus:outline-none text-sm"
                />
              ) : (
                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-4 py-3">
                  <User className="w-4 h-4 text-white/40 flex-shrink-0" />
                  <span className="text-white text-sm">{profile?.username || "Not set"}</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-white/50 text-xs uppercase font-semibold tracking-wider block mb-1">Bio</label>
              {editing ? (
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={3}
                  placeholder="Tell us about yourself…"
                  className="w-full bg-white/5 border border-[#1DB954] rounded-lg px-4 py-3 text-white focus:outline-none resize-none text-sm"
                />
              ) : (
                <div className="bg-white/5 rounded-lg px-4 py-3">
                  <span className="text-white text-sm">{profile?.bio || "No bio yet"}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-white/10 divide-y divide-white/5">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-6 py-4 text-red-400 hover:text-red-300 hover:bg-red-500/5 rounded-2xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
