import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { apiFetch } from "./api";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = (path: string) => `${BASE}${path}`;

const TOKEN_KEY = "musika-token-v3";
const USER_KEY = "musika-user-v3";

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  bio: string;
  avatar_url: string;
  musika_id?: string;
  email_confirmed_at?: string;
  created_at: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
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

function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setStoredUser(user: UserProfile | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(getStoredUser);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const pendingPassword = useRef<string>("");

  useEffect(() => {
    // Validate session on mount
    if (token) {
      apiFetch("/api/auth/me")
        .then(res => {
          if (res.success && res.user) {
            setUser(res.user);
            setStoredUser(res.user);
          } else {
            // Token invalid, clear
            localStorage.removeItem(TOKEN_KEY);
            setStoredUser(null);
            setToken(null);
            setUser(null);
          }
        })
        .catch(() => {
          // Network error — still keep local session
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  function setSession(user: UserProfile, newToken: string) {
    setUser(user);
    setToken(newToken);
    localStorage.setItem(TOKEN_KEY, newToken);
    setStoredUser(user);
  }

  function clearSession() {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    setStoredUser(null);
  }

  async function signUp(email: string, password: string, username: string) {
    try {
      const res = await fetch(API("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, username }),
      });
      const json = await res.json();

      if (!json.success) return { error: json.error || "Registrasi gagal", needsOtp: false };

      if (json.token) {
        setSession(json.user, json.token);
      }

      if (json.needsOtp) {
        pendingPassword.current = password;
        return { error: null, needsOtp: true };
      }

      return { error: null, needsOtp: false };
    } catch (err: any) {
      return { error: err.message || "Network error", needsOtp: false };
    }
  }

  async function verifyOTP(email: string, code: string) {
    try {
      const res = await fetch(API("/api/auth/otp/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const json = await res.json();
      if (!json.success) return { error: json.error || "Verification failed" };

      // If we have pending password, log in automatically
      const pwd = pendingPassword.current;
      pendingPassword.current = "";

      if (pwd && token) {
        // Already logged in via register, just confirm
        return { error: null };
      } else if (pwd) {
        // Log in
        const loginRes = await fetch(API("/api/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pwd }),
        });
        const loginJson = await loginRes.json();
        if (loginJson.success && loginJson.token) {
          setSession(loginJson.user, loginJson.token);
        }
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || "Network error" };
    }
  }

  async function resendOTP(email: string) {
    try {
      const res = await fetch(API("/api/auth/otp/resend"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      return { error: json.success ? null : (json.error || "Failed to resend") };
    } catch (err: any) {
      return { error: err.message || "Network error" };
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const res = await fetch(API("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!json.success) {
        const msg = (json.error || "").toLowerCase();
        if (msg.includes("invalid") || msg.includes("credentials") || msg.includes("password") || msg.includes("salah")) {
          return { error: "Email atau password salah" };
        }
        return { error: json.error || "Login gagal" };
      }

      if (json.token) {
        setSession(json.user, json.token);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || "Network error" };
    }
  }

  async function signOut() {
    clearSession();
  }

  async function updateProfile(data: Partial<UserProfile>) {
    if (!user || !token) return { error: "Not authenticated" };

    try {
      const res = await fetch(API("/api/auth/profile"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (json.success && json.user) {
        setUser(json.user);
        setStoredUser(json.user);
      }

      return { error: json.success ? null : (json.error || "Update gagal") };
    } catch (err: any) {
      return { error: err.message || "Network error" };
    }
  }

  async function uploadAvatar(file: File): Promise<{ url: string | null; error: string | null }> {
    if (!user) return { url: null, error: "Belum masuk akun" };

    if (!file.type.startsWith("image/")) {
      return { url: null, error: "File harus berupa gambar (JPG, PNG, WebP)" };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { url: null, error: "Ukuran gambar maksimal 10MB" };
    }

    // Upload via backend API /api/upload
    try {
      const formData = new FormData();
      formData.append("file", file);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(API("/api/upload"), {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-expire": "4w",
        },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Server error ${res.status}: ${errText.slice(0, 100)}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Upload gagal");

      // Update profile with avatar URL
      await updateProfile({ avatar_url: data.url } as any);

      return { url: data.url, error: null };
    } catch (err: any) {
      if (err.name === "AbortError") {
        return { url: null, error: "Waktu habis. Coba gambar yang lebih kecil." };
      }
      return { url: null, error: `Upload gagal: ${err.message || "Kesalahan tidak diketahui"}` };
    }
  }

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      signUp, signIn, verifyOTP, resendOTP,
      signOut, updateProfile, uploadAvatar,
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
