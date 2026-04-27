import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { SlideCaptcha } from "./SlideCaptcha";
import { Eye, EyeOff, Mail, Lock, User, Loader2, ArrowRight, RefreshCw, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const LOGO = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png";
const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

type Mode = "login" | "register" | "otp";

function OTPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(OTP_LENGTH, "").split("").slice(0, OTP_LENGTH);

  const handleChange = (i: number, v: string) => {
    const d = v.replace(/\D/g, "");
    if (!d) return;
    const next = digits.map((c, idx) => (idx === i ? d[d.length - 1] : c)).join("").replace(/ /g, "");
    onChange(next);
    if (i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = digits.slice();
      if (digits[i]) {
        next[i] = "";
        onChange(next.join("").replace(/ /g, ""));
      } else if (i > 0) {
        next[i - 1] = "";
        onChange(next.join("").replace(/ /g, ""));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) {
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    refs.current[focusIdx]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] === " " || !digits[i] ? "" : digits[i]}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={e => e.target.select()}
          className={`w-10 h-12 md:w-12 md:h-14 rounded-xl border-2 text-center text-xl font-bold text-white bg-white/5 transition-all duration-200 focus:outline-none focus:scale-105 ${
            digits[i] && digits[i] !== " "
              ? "border-[#1DB954] bg-[#1DB954]/10"
              : "border-white/15 focus:border-[#1DB954]/70"
          }`}
        />
      ))}
    </div>
  );
}

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
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resending, setResending] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(() => {
    setResendCountdown(RESEND_SECONDS);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setResendCountdown(c => {
        if (c <= 1) { if (countdownRef.current) clearInterval(countdownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaOk) { toast({ title: "Complete the security check first", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: "Sign in failed", description: error.includes("Invalid") ? "Wrong email or password" : error, variant: "destructive" });
      setCaptchaOk(false); setCaptchaKey(k => k + 1);
    } else {
      toast({ title: "Welcome back to Musika!" });
      navigate("/");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaOk) { toast({ title: "Complete the security check first", variant: "destructive" }); return; }
    if (username.trim().length < 3) { toast({ title: "Username must be at least 3 characters", variant: "destructive" }); return; }
    if (password.length < 8) { toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await signUp(email, password, username.trim());
    setLoading(false);
    if (error) {
      toast({ title: "Registration failed", description: error, variant: "destructive" });
      setCaptchaOk(false); setCaptchaKey(k => k + 1);
    } else {
      toast({ title: "Account created!", description: "Check your email for the 6-digit code" });
      setMode("otp");
      startCountdown();
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.replace(/\D/g, "").length < OTP_LENGTH) {
      toast({ title: "Enter all 6 digits", variant: "destructive" }); return;
    }
    setLoading(true);
    const { error } = await verifyOTP(email, otp);
    setLoading(false);
    if (error) {
      toast({ title: "Wrong code", description: "Check your email and try again", variant: "destructive" });
      setOtp("");
    } else {
      toast({ title: "Email verified!", description: "Welcome to Musika" });
      navigate("/");
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || resending) return;
    setResending(true);
    const { error } = await signUp(email, password, username);
    setResending(false);
    if (error && !error.includes("already")) {
      toast({ title: "Failed to resend code", description: error, variant: "destructive" });
    } else {
      toast({ title: "Code resent!", description: "Check your email" });
      setOtp("");
      startCountdown();
    }
  };

  const otpFilled = otp.replace(/\D/g, "").length === OTP_LENGTH;

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-[#1DB954]/8 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-purple-500/8 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#1DB954]/3 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo & title */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1A1A1A] border border-white/10 mb-4 shadow-xl">
            <img src={LOGO} alt="musika" className="h-10 w-10 object-contain" />
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">
            {mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Verify email"}
          </h1>
          <p className="text-white/40 text-sm mt-1.5">
            {mode === "login" ? "Good to have you back" : mode === "register" ? "Free forever · No credit card" : `Code sent to ${email}`}
          </p>
        </div>

        <div className="bg-[#1A1A1A] rounded-2xl border border-white/8 p-6 shadow-2xl shadow-black/50">

          {/* OTP mode */}
          {mode === "otp" ? (
            <form onSubmit={handleVerifyOTP} className="space-y-5">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#1DB954]/15 mb-3">
                  <ShieldCheck className="w-6 h-6 text-[#1DB954]" />
                </div>
                <p className="text-white/60 text-sm">Enter the 6-digit code from your email</p>
              </div>

              <OTPInput value={otp} onChange={setOtp} />

              {otpFilled && (
                <div className="flex items-center justify-center gap-1.5 text-[#1DB954] text-xs animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Code complete — tap Verify</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !otpFilled}
                className="w-full h-12 bg-[#1DB954] hover:bg-[#1ed760] active:scale-98 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Verify Code</span><ArrowRight className="w-4 h-4" /></>}
              </button>

              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-white/40">Didn't receive it?</span>
                {resendCountdown > 0 ? (
                  <span className="text-white/30">Resend in {resendCountdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="text-[#1DB954] hover:text-[#1ed760] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Resend
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => { setMode("register"); setOtp(""); }}
                className="w-full text-center text-white/30 hover:text-white/50 text-xs transition-colors"
              >
                ← Back to registration
              </button>
            </form>
          ) : (
            <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-3.5">
              {mode === "register" && (
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Username"
                    required
                    minLength={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#1DB954]/60 focus:bg-white/8 transition-all"
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  autoComplete="email"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#1DB954]/60 focus:bg-white/8 transition-all"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  minLength={8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#1DB954]/60 focus:bg-white/8 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {mode === "register" && password.length > 0 && (
                <div className="flex gap-1 px-1">
                  {[1, 2, 3, 4].map(lvl => (
                    <div
                      key={lvl}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        password.length >= lvl * 3
                          ? lvl <= 1 ? "bg-red-500" : lvl <= 2 ? "bg-yellow-500" : lvl <= 3 ? "bg-blue-500" : "bg-[#1DB954]"
                          : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              )}

              <div className="pt-1">
                <SlideCaptcha key={captchaKey} onSuccess={() => setCaptchaOk(true)} />
              </div>

              <button
                type="submit"
                disabled={loading || !captchaOk}
                className="w-full h-12 bg-[#1DB954] hover:bg-[#1ed760] active:scale-98 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-1"
              >
                {loading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <><span>{mode === "login" ? "Sign In" : "Create Account"}</span><ArrowRight className="w-4 h-4" /></>
                }
              </button>
            </form>
          )}
        </div>

        {mode !== "otp" && (
          <p className="text-center text-white/40 text-sm mt-5">
            {mode === "login" ? (
              <>Don't have an account?{" "}
                <button
                  onClick={() => { setMode("register"); setCaptchaOk(false); setCaptchaKey(k => k + 1); }}
                  className="text-white font-semibold hover:text-[#1DB954] transition-colors"
                >
                  Sign up free
                </button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button
                  onClick={() => { setMode("login"); setCaptchaOk(false); setCaptchaKey(k => k + 1); }}
                  className="text-white font-semibold hover:text-[#1DB954] transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
