import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Eye, EyeOff, Mail, Lock, User, Loader2, ArrowRight, RefreshCw, Music2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const LOGO = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png";
const OTP_LEN = 6;
const RESEND_SECS = 60;

type Step = "login" | "register" | "otp";

function OTPBoxes({ value, onChange, disabled }: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: OTP_LEN }, (_, i) => value[i] || "");

  const updateAt = (i: number, ch: string) => {
    const next = [...digits];
    next[i] = ch;
    onChange(next.join(""));
    if (ch && i < OTP_LEN - 1) refs.current[i + 1]?.focus();
  };

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) { updateAt(i, ""); return; }
    if (raw.length > 1) {
      const pasted = raw.slice(0, OTP_LEN);
      onChange(pasted.padEnd(OTP_LEN, "").slice(0, OTP_LEN));
      const focus = Math.min(pasted.length, OTP_LEN - 1);
      refs.current[focus]?.focus();
      return;
    }
    updateAt(i, raw);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) { updateAt(i, ""); }
      else if (i > 0) { updateAt(i - 1, ""); refs.current[i - 1]?.focus(); }
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < OTP_LEN - 1) {
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LEN);
    onChange(pasted.padEnd(OTP_LEN, "").slice(0, OTP_LEN));
    refs.current[Math.min(pasted.length, OTP_LEN - 1)]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={e => e.target.select()}
          className={`w-11 h-13 md:w-12 md:h-14 rounded-xl border-2 text-center text-xl font-bold text-white bg-white/5 transition-all duration-150 focus:outline-none disabled:opacity-40
            ${d ? "border-[#1DB954] bg-[#1DB954]/10 scale-105" : "border-white/15 focus:border-[#1DB954]/60 focus:scale-105"}`}
          style={{ height: "52px" }}
        />
      ))}
    </div>
  );
}

export default function AuthPage() {
  const { signIn, signUp, verifyOTP, resendOTP } = useAuth();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [otp, setOtp] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(() => {
    setCountdown(RESEND_SECS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const pwdStrength = Math.min(4, Math.floor(password.length / 3));
  const strengthColor = ["bg-white/10", "bg-red-500", "bg-yellow-400", "bg-blue-400", "bg-[#1DB954]"];
  const otpComplete = otp.replace(/\s/g, "").length === OTP_LEN;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { toast({ title: "Fill in all fields", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      const msg = error.toLowerCase().includes("invalid") || error.toLowerCase().includes("credentials")
        ? "Wrong email or password" : error;
      toast({ title: "Sign in failed", description: msg, variant: "destructive" });
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
    const { error, needsOtp } = await signUp(email.trim(), password, username.trim());
    setLoading(false);
    if (error) {
      toast({ title: "Registration failed", description: error, variant: "destructive" });
    } else if (!needsOtp) {
      toast({ title: "Account created! Welcome to Musika" });
      navigate("/");
    } else {
      toast({ title: "Check your email!", description: `We sent a 6-digit code to ${email}` });
      setOtp("");
      setStep("otp");
      startCountdown();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpComplete) { toast({ title: "Enter all 6 digits", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await verifyOTP(email.trim(), otp);
    setLoading(false);
    if (error) {
      toast({
        title: "Wrong code",
        description: "Check your email and try again, or request a new code",
        variant: "destructive"
      });
      setOtp("");
    } else {
      toast({ title: "Email verified!", description: "Welcome to Musika" });
      navigate("/");
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || loading) return;
    setLoading(true);
    const { error } = await resendOTP(email.trim());
    setLoading(false);
    if (error) {
      toast({ title: "Couldn't resend code", description: error, variant: "destructive" });
    } else {
      setOtp("");
      toast({ title: "New code sent!", description: "Check your email" });
      startCountdown();
    }
  };

  const switchTab = (s: Step) => {
    setStep(s);
    setOtp("");
    setShowPass(false);
  };

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#1DB954]/6 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-purple-500/6 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1A1A1A] border border-white/10 mb-5 shadow-xl shadow-black/50">
            <img src={LOGO} alt="Musika" className="h-10 w-10 object-contain" />
          </div>

          {step === "otp" ? (
            <>
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[#1DB954]/15 mb-3">
                <ShieldCheck className="w-5 h-5 text-[#1DB954]" />
              </div>
              <h1 className="text-white text-[24px] font-bold tracking-tight">Verify your email</h1>
              <p className="text-white/40 text-sm mt-1.5 leading-relaxed">
                We sent a 6-digit code to<br />
                <span className="text-white/60 font-medium">{email}</span>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-white text-[24px] font-bold tracking-tight">
                {step === "login" ? "Sign in to Musika" : "Create your account"}
              </h1>
              <p className="text-white/40 text-sm mt-1.5">
                {step === "login" ? "Your music, everywhere" : "Free forever · No credit card"}
              </p>
            </>
          )}
        </div>

        {/* Tab strip — hidden during OTP */}
        {step !== "otp" && (
          <div className="flex bg-[#1A1A1A] rounded-xl p-1 mb-5 border border-white/8">
            {(["login", "register"] as Step[]).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => switchTab(s)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  step === s ? "bg-[#1DB954] text-black shadow-sm" : "text-white/40 hover:text-white/70"
                }`}
              >
                {s === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>
        )}

        {/* Card */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-white/8 p-6 shadow-2xl shadow-black/60">

          {/* OTP step */}
          {step === "otp" ? (
            <form onSubmit={handleVerify} className="space-y-5">
              <OTPBoxes value={otp} onChange={setOtp} disabled={loading} />

              {otpComplete && (
                <p className="text-center text-[#1DB954] text-xs flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All digits entered — tap Verify
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !otpComplete}
                className="w-full h-12 bg-[#1DB954] hover:bg-[#1ed760] active:scale-[0.98] text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Verify & Sign In</span><ArrowRight className="w-4 h-4" /></>}
              </button>

              {/* Resend */}
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-white/35">Didn't get it?</span>
                {countdown > 0 ? (
                  <span className="text-white/25 text-xs">Resend in {countdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="text-[#1DB954] hover:text-[#1ed760] font-semibold flex items-center gap-1 transition-colors disabled:opacity-40"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Resend code
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => { setStep("register"); setOtp(""); }}
                className="w-full text-center text-white/25 hover:text-white/50 text-xs transition-colors py-1"
              >
                ← Back to registration
              </button>
            </form>

          ) : step === "login" ? (
            /* Login form */
            <form onSubmit={handleLogin} className="space-y-4">
              <Field label="Email">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className={inputCls}
                />
              </Field>

              <Field label="Password">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
                  className={inputCls + " pr-11"}
                />
                <PassToggle show={showPass} onToggle={() => setShowPass(p => !p)} />
              </Field>

              <SubmitBtn loading={loading} label="Sign In" />
            </form>

          ) : (
            /* Register form */
            <form onSubmit={handleRegister} className="space-y-4">
              <Field label="Username">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  required
                  minLength={3}
                  maxLength={30}
                  autoCapitalize="none"
                  className={inputCls}
                />
              </Field>

              <Field label="Email">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className={inputCls}
                />
              </Field>

              <Field label="Password">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={inputCls + " pr-11"}
                />
                <PassToggle show={showPass} onToggle={() => setShowPass(p => !p)} />
                {password.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {[1, 2, 3, 4].map(l => (
                      <div key={l} className={`h-1 flex-1 rounded-full transition-all duration-300 ${pwdStrength >= l ? strengthColor[pwdStrength] : "bg-white/8"}`} />
                    ))}
                  </div>
                )}
              </Field>

              <SubmitBtn loading={loading} label="Create Account" />
            </form>
          )}
        </div>

        <div className="flex items-center gap-3 mt-5">
          <div className="flex-1 h-px bg-white/8" />
          <Music2 className="w-3.5 h-3.5 text-white/15" />
          <div className="flex-1 h-px bg-white/8" />
        </div>
        <p className="text-center text-white/25 text-[11px] mt-3 leading-relaxed">
          Your music, your data — always private.
        </p>
      </div>
    </div>
  );
}

const inputCls = "w-full bg-[#252525] border border-white/8 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#1DB954]/50 focus:bg-[#2a2a2a] transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-white/45 text-xs font-medium mb-1.5 ml-1">{label}</label>
      <div className="relative">{children}</div>
    </div>
  );
}

function PassToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full h-12 bg-[#1DB954] hover:bg-[#1ed760] active:scale-[0.98] text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>{label}</span><ArrowRight className="w-4 h-4" /></>}
    </button>
  );
}
