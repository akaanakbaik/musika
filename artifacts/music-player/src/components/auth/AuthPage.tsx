import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { SlideCaptcha } from "./SlideCaptcha";
import { Eye, EyeOff, Mail, Lock, User, Loader2, ArrowRight, Music } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const LOGO = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png";

type Mode = "login" | "register" | "otp";

export default function AuthPage() {
  const { signIn, signUp, verifyOTP } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [otp, setOtp] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaOk, setCaptchaOk] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaOk) { toast({ title: "Please complete the captcha", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: "Login failed", description: error, variant: "destructive" });
      setCaptchaOk(false); setCaptchaKey(k => k + 1);
    } else {
      toast({ title: "Welcome back! 🎵" });
      navigate("/");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaOk) { toast({ title: "Please complete the captcha", variant: "destructive" }); return; }
    if (password.length < 8) { toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await signUp(email, password, username);
    setLoading(false);
    if (error) {
      toast({ title: "Registration failed", description: error, variant: "destructive" });
      setCaptchaOk(false); setCaptchaKey(k => k + 1);
    } else {
      toast({ title: "Account created! Check your email for OTP 📧" });
      setMode("otp");
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) { toast({ title: "Please enter the complete OTP", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await verifyOTP(email, otp);
    setLoading(false);
    if (error) {
      toast({ title: "OTP verification failed", description: error, variant: "destructive" });
    } else {
      toast({ title: "Email verified! Welcome to Musika 🎵" });
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center px-4 relative overflow-hidden">
      {/* BG decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#1DB954]/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={LOGO} alt="musika" className="h-12 mx-auto mb-4 object-contain" />
          <h1 className="text-white text-2xl font-bold">
            {mode === "login" ? "Sign in to Musika" : mode === "register" ? "Create your account" : "Verify your email"}
          </h1>
          <p className="text-white/50 text-sm mt-1">
            {mode === "login" ? "Listen to music you love" : mode === "register" ? "Free forever. No credit card needed." : `We sent a code to ${email}`}
          </p>
        </div>

        <div className="bg-[#1A1A1A] rounded-2xl border border-white/10 p-6 shadow-2xl">
          {/* OTP mode */}
          {mode === "otp" ? (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="text-center mb-6">
                <Mail className="w-12 h-12 text-[#1DB954] mx-auto mb-2" />
                <p className="text-white/70 text-sm">Enter the verification code sent to your email</p>
              </div>
              <input
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter OTP code"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest font-bold placeholder:text-white/30 focus:outline-none focus:border-[#1DB954] transition-colors"
                maxLength={6}
                inputMode="numeric"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold rounded-full flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Verify</span><ArrowRight className="w-4 h-4" /></>}
              </button>
              <p className="text-center text-white/40 text-sm">
                Didn't receive? <button type="button" className="text-[#1DB954] hover:underline" onClick={() => setMode("register")}>Go back</button>
              </p>
            </form>
          ) : (
            <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
              {mode === "register" && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Username"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#1DB954] transition-colors"
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#1DB954] transition-colors"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  minLength={8}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-12 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#1DB954] transition-colors"
                />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Captcha */}
              <SlideCaptcha key={captchaKey} onSuccess={() => setCaptchaOk(true)} />

              <button
                type="submit"
                disabled={loading || !captchaOk}
                className="w-full h-12 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold rounded-full flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <><span>{mode === "login" ? "Sign In" : "Create Account"}</span><ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Toggle */}
        {mode !== "otp" && (
          <p className="text-center text-white/50 text-sm mt-4">
            {mode === "login" ? (
              <>Don't have an account? <button onClick={() => { setMode("register"); setCaptchaOk(false); setCaptchaKey(k => k + 1); }} className="text-white font-semibold hover:underline">Sign up for free</button></>
            ) : (
              <>Already have an account? <button onClick={() => { setMode("login"); setCaptchaOk(false); setCaptchaKey(k => k + 1); }} className="text-white font-semibold hover:underline">Sign in</button></>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
