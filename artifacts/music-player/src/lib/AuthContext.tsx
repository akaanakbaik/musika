import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import type { User, Session } from "@supabase/supabase-js";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = (path: string) => `${BASE}${path}`;

interface UserProfile {
  id: string;
  username: string;
  bio: string;
  avatar_url: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null; needsOtp: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  verifyOTP: (email: string, code: string) => Promise<{ error: string | null }>;
  resendOTP: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<{ error: string | null }>;
  uploadAvatar: (file: File) => Promise<{ url: string | null; error: string | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const pendingPassword = useRef<string>("");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else setProfile(null);
      if (loading) setLoading(false);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function loadProfile(userId: string) {
    try {
      const { data } = await supabase.from("user_profiles").select("*").eq("id", userId).single();
      if (data) setProfile(data);
    } catch {}
  }

  async function signUp(email: string, password: string, username: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username }, emailRedirectTo: `${window.location.origin}/auth` }
    });
    if (error) return { error: error.message, needsOtp: false };

    if (data.session) {
      return { error: null, needsOtp: false };
    }

    pendingPassword.current = password;

    const res = await fetch(API("/api/auth/otp/send"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const json = await res.json();
    if (!json.success) return { error: json.error || "Failed to send verification code", needsOtp: false };

    return { error: null, needsOtp: true };
  }

  async function verifyOTP(email: string, code: string) {
    const res = await fetch(API("/api/auth/otp/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code })
    });
    const json = await res.json();
    if (!json.success) return { error: json.error || "Verification failed" };

    const pwd = pendingPassword.current;
    pendingPassword.current = "";

    if (pwd) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
      if (error) return { error: error.message };
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        if (data.user) loadProfile(data.user.id);
      }
    }

    return { error: null };
  }

  async function resendOTP(email: string) {
    const res = await fetch(API("/api/auth/otp/resend"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const json = await res.json();
    return { error: json.success ? null : (json.error || "Failed to resend") };
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid") || msg.includes("credentials") || msg.includes("password")) {
        return { error: "Email atau password salah" };
      }
      if (msg.includes("not confirmed") || msg.includes("email")) {
        return { error: "Email belum diverifikasi. Daftar ulang untuk mendapatkan kode baru." };
      }
      return { error: error.message };
    }
    if (data.session) {
      setSession(data.session);
      setUser(data.user);
      if (data.user) loadProfile(data.user.id);
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  }

  async function updateProfile(data: Partial<UserProfile>) {
    if (!user) return { error: "Not authenticated" };
    const { error } = await supabase
      .from("user_profiles")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (!error) setProfile(prev => prev ? { ...prev, ...data } : null);
    return { error: error?.message ?? null };
  }

  async function uploadAvatar(file: File): Promise<{ url: string | null; error: string | null }> {
    if (!user) return { url: null, error: "Belum masuk akun" };

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return { url: null, error: "File harus berupa gambar (JPG, PNG, WebP)" };
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { url: null, error: "Ukuran gambar maksimal 5MB" };
    }

    // Strategy 1: Supabase Storage (no backend needed, most reliable)
    try {
      // Try to ensure bucket exists (ignore error if already exists)
      await supabase.storage.createBucket("avatars", { public: true, fileSizeLimit: 5242880 }).catch(() => {});

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const validExts = ["jpg", "jpeg", "png", "webp", "gif"];
      const finalExt = validExts.includes(ext) ? ext : "jpg";
      const filename = `${user.id}/avatar-${Date.now()}.${finalExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filename, file, {
          contentType: file.type,
          upsert: true,
          cacheControl: "3600"
        });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filename);
        const publicUrl = urlData.publicUrl;
        if (publicUrl) {
          await updateProfile({ avatar_url: publicUrl });
          return { url: publicUrl, error: null };
        }
      }

      // If bucket doesn't exist, try creating it (only works with service role, skip to next strategy)
      if (uploadError?.message?.includes("bucket") || uploadError?.message?.includes("not found")) {
        throw new Error("bucket_not_found");
      }

      throw new Error(uploadError?.message || "Upload ke Supabase gagal");
    } catch (supabaseErr: any) {
      console.warn("[Avatar] Supabase Storage failed:", supabaseErr.message);

      // Strategy 2: Backend CDN upload via Express /api/upload
      try {
        const formData = new FormData();
        formData.append("file", file);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);

        const res = await fetch(API("/api/upload"), {
          method: "POST",
          headers: { "x-expire": "4w" },
          body: formData,
          signal: controller.signal
        });
        clearTimeout(timer);

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`Server error ${res.status}: ${errText.slice(0, 100)}`);
        }

        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Upload gagal");

        await updateProfile({ avatar_url: data.url });
        return { url: data.url, error: null };
      } catch (cdnErr: any) {
        console.warn("[Avatar] CDN upload failed:", cdnErr.message);

        if (cdnErr.name === "AbortError") {
          return { url: null, error: "Waktu habis. Coba gambar yang lebih kecil." };
        }

        return {
          url: null,
          error: `Upload gagal: ${cdnErr.message || "Kesalahan tidak diketahui"}. Coba gambar JPG/PNG < 2MB.`
        };
      }
    }
  }

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      signUp, signIn, verifyOTP, resendOTP,
      signOut, updateProfile, uploadAvatar
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
