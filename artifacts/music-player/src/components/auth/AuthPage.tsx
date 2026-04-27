import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Eye, EyeOff, Mail, Lock, User, Loader2, ArrowRight, Music2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const LOGO = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png";

type Mode = "login" | "register";

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordStrength = Math.min(4, Math.floor(password.length / 3));
  const strengthColor = ["bg-red-500", "bg-red-500", "bg-yellow-500", "bg-blue-500", "bg-[#1DB954]"];
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast({ title: "Fill in all fields", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({
        title: "Sign in failed",
        description: error.toLowerCase().includes("invalid") ? "Wrong email or password" : error,
        variant: "destructive"
      });
    } else {
      toast({ title: "Welcome back to Musika!" });
      navigate("/");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length < 3) { toast({ title: "Username needs at least 3 characters", variant: "destructive" }); return; }
    if (password.length < 8) { toast({ title: "Password needs at least 8 characters", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await signUp(email, password, username.trim());
    setLoading(false);
    if (error) {
      toast({ title: "Registration failed", description: error, variant: "destructive" });
    } else {
      toast({ title: "Account created! Welcome to Musika" });
      navigate("/");
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setEmail("");
    setPassword("");
    setUsername("");
    setShowPass(false);
  };

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#1DB954]/6 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-purple-500/6 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1A1A1A] border border-white/10 mb-5 shadow-xl shadow-black/50">
            <img src={LOGO} alt="Musika" className="h-10 w-10 object-contain" />
          </div>
          <h1 className="text-white text-[26px] font-bold tracking-tight">
            {mode === "login" ? "Sign in to Musika" : "Create your account"}
          </h1>
          <p className="text-white/40 text-sm mt-2">
            {mode === "login" ? "Your music, everywhere" : "Free forever · No credit card"}
          </p>
        </div>

        {/* Mode toggle tabs */}
        <div className="flex bg-[#1A1A1A] rounded-xl p-1 mb-6 border border-white/8">
          {(["login", "register"] as Mode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === m
                  ? "bg-[#1DB954] text-black shadow-sm"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {/* Form card */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-white/8 p-6 shadow-2xl shadow-black/60">
          <form
            onSubmit={mode === "login" ? handleLogin : handleRegister}
            className="space-y-4"
          >
            {mode === "register" && (
              <div>
                <label className="block text-white/50 text-xs font-medium mb-1.5 ml-1">Username</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    required
                    minLength={3}
                    maxLength={30}
                    autoCapitalize="none"
                    className="w-full bg-[#252525] border border-white/8 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#1DB954]/50 focus:bg-[#2a2a2a] transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-white/50 text-xs font-medium mb-1.5 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="w-full bg-[#252525] border border-white/8 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#1DB954]/50 focus:bg-[#2a2a2a] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-white/50 text-xs font-medium mb-1.5 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === "login" ? "Your password" : "Min. 8 characters"}
                  required
                  minLength={8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full bg-[#252525] border border-white/8 rounded-xl pl-10 pr-11 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#1DB954]/50 focus:bg-[#2a2a2a] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password strength — register only */}
              {mode === "register" && password.length > 0 && (
                <div className="mt-2 px-1">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map(lvl => (
                      <div
                        key={lvl}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          passwordStrength >= lvl ? strengthColor[passwordStrength] : "bg-white/8"
                        }`}
                      />
                    ))}
                  </div>
                  {password.length > 0 && (
                    <p className={`text-[11px] ${strengthColor[passwordStrength].replace("bg-", "text-")}`}>
                      {strengthLabel[passwordStrength]}
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#1DB954] hover:bg-[#1ed760] active:scale-[0.98] text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <><span>{mode === "login" ? "Sign In" : "Create Account"}</span><ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 mt-6">
          <div className="flex-1 h-px bg-white/8" />
          <Music2 className="w-4 h-4 text-white/20" />
          <div className="flex-1 h-px bg-white/8" />
        </div>
        <p className="text-center text-white/35 text-xs mt-4 leading-relaxed">
          By continuing, you agree to Musika's Terms of Service.<br />
          Your music, your data, always private.
        </p>
      </div>
    </div>
  );
}
