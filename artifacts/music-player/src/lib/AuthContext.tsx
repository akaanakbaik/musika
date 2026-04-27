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
        return { error: "Wrong email or password" };
      }
      if (msg.includes("not confirmed") || msg.includes("email")) {
        return { error: "Email not verified. Please register again to receive a new code." };
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

  async function uploadAvatar(file: File) {
    if (!user) return { url: null, error: "Not authenticated" };
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(API("/api/upload"), {
        method: "POST",
        headers: { "x-expire": "4w" },
        body: formData
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await updateProfile({ avatar_url: data.url });
      return { url: data.url, error: null };
    } catch (e: any) {
      return { url: null, error: e.message };
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
