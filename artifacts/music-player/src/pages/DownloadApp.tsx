import React, { useState, useEffect } from "react";
import { Download, Music, WifiOff, Bot, Bell, Zap, Shield, Globe, Star, ChevronDown, ChevronUp, Smartphone, MonitorSmartphone, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

const LOGO = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png";

const features = [
  { Icon: Music, title: "All Music Sources", desc: "YouTube, Spotify, Apple Music & SoundCloud in one app" },
  { Icon: WifiOff, title: "Offline Mode", desc: "Download and listen without internet connection" },
  { Icon: Bot, title: "AI Assistant", desc: "Get personalized music recommendations from Musika AI" },
  { Icon: Bell, title: "Media Controls", desc: "Control playback from your lock screen & notification bar" },
  { Icon: Zap, title: "Lightning Fast", desc: "Instant search and gapless playback" },
  { Icon: Shield, title: "Privacy First", desc: "Your data stays yours — secure with Supabase" },
  { Icon: Globe, title: "Any Language", desc: "AI speaks your language — Indonesian & English" },
  { Icon: Smartphone, title: "Dark Theme", desc: "Beautiful dark theme that adapts to your preference" },
];

const installSteps = [
  { step: "1", Icon: Globe, title: "Open in Browser", desc: "Visit Musika in Chrome, Samsung Internet, or Edge" },
  { step: "2", Icon: Download, title: "Click Install", desc: "Tap the Install button below or use your browser menu" },
  { step: "3", Icon: Music, title: "Enjoy!", desc: "Musika is now on your home screen ready to use" },
];

const reviews = [
  { name: "Reza P.", stars: 5, text: "Best music app I've used! Love the multi-source search." },
  { name: "Sarah M.", stars: 5, text: "Musika AI is incredibly helpful for music discovery!" },
  { name: "Budi S.", stars: 5, text: "Offline mode works perfectly. Can't live without this app." },
];

const faqs = [
  { q: "How do I install Musika?", a: "Click 'Install App' button above. Your browser will prompt you to add it to your home screen. It works like a native app!" },
  { q: "Does it work offline?", a: "Yes! After installing, the app caches content for offline access. Core features work without internet." },
  { q: "Is it free?", a: "Musika is completely free forever. No credit card, no subscription required." },
  { q: "Which devices are supported?", a: "Musika works on any modern device — Android, iOS, Windows, Mac, and Linux. Just open in your browser and install!" },
  { q: "How does the AI work?", a: "Musika AI is powered by GPT-5 and has deep music knowledge. It can recommend songs, explain genres, and help you discover new artists." },
  { q: "Can I use it as an APK?", a: "Yes! Musika is Bubblewrap-compatible. You can generate an Android APK using Bubblewrap or Trusted Web Activities." },
];

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://")
  );
}

export default function DownloadApp() {
  const [, navigate] = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (isStandalone()) {
      setIsInstalled(true);
      navigate("/");
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setDeferredPrompt(null);
    });

    const mql = window.matchMedia("(display-mode: standalone)");
    const mqlHandler = (e: MediaQueryListEvent) => {
      if (e.matches) { setIsInstalled(true); navigate("/"); }
    };
    mql.addEventListener("change", mqlHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      mql.removeEventListener("change", mqlHandler);
    };
  }, [navigate]);

  async function installApp() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
    } else {
      alert(
        "To install Musika:\n\n" +
        "Android Chrome: Menu (⋮) → Add to Home Screen\n" +
        "iPhone Safari: Share button → Add to Home Screen\n" +
        "Desktop Chrome: Click the install icon in address bar"
      );
    }
  }

  if (isInstalled) return null;

  return (
    <div className="min-h-screen bg-[#121212] pb-24 md:pb-8 text-white">
      {/* Hero */}
      <div className="bg-gradient-to-b from-[#1DB954]/20 via-[#121212] to-[#121212] px-4 md:px-8 pt-12 pb-16 text-center">
        <img src={LOGO} alt="Musika" className="h-16 mx-auto mb-6 object-contain" />
        <h1 className="text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-[#1DB954] to-emerald-300 bg-clip-text text-transparent">
          Install Musika
        </h1>
        <p className="text-white/60 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
          Install the full-featured music player on any device. Works offline, loads instantly, and feels like a native app.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {installed ? (
            <div className="flex items-center gap-3 bg-[#1DB954]/20 border border-[#1DB954]/30 text-[#1DB954] font-bold px-8 py-4 rounded-full text-lg">
              <CheckCircle className="w-6 h-6" />
              App Installed Successfully
            </div>
          ) : (
            <button
              onClick={installApp}
              className="flex items-center gap-3 bg-[#1DB954] text-black font-bold px-8 py-4 rounded-full text-lg hover:bg-[#1ed760] transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#1DB954]/30"
            >
              <Download className="w-6 h-6" />
              Install App — Free
            </button>
          )}
          <div className="text-white/40 text-sm">
            <p>Android · iOS · Windows · Mac · Linux</p>
            <p>No App Store required</p>
          </div>
        </div>

        {/* Device mockup */}
        <div className="mt-12 flex items-end justify-center gap-4">
          <div className="w-32 h-56 bg-[#1A1A1A] rounded-[24px] border-2 border-white/10 shadow-2xl flex items-center justify-center overflow-hidden">
            <div className="w-full h-full bg-gradient-to-b from-[#1DB954]/20 to-transparent flex flex-col items-center justify-center gap-2">
              <Smartphone className="w-10 h-10 text-[#1DB954]" />
              <span className="text-white/60 text-xs text-center px-2">Mobile</span>
            </div>
          </div>
          <div className="w-48 h-72 bg-[#1A1A1A] rounded-[28px] border-2 border-white/10 shadow-2xl flex items-center justify-center overflow-hidden -mb-4">
            <div className="w-full h-full bg-gradient-to-b from-[#1DB954]/30 to-transparent flex flex-col items-center justify-center gap-2">
              <img src={LOGO} alt="" className="h-8 object-contain mb-2" />
              <div className="w-16 h-16 rounded-xl bg-[#282828]" />
              <div className="w-28 h-2 bg-white/20 rounded-full mt-2" />
              <div className="w-20 h-1.5 bg-white/10 rounded-full mt-1" />
              <div className="flex gap-4 mt-4">
                <div className="w-6 h-6 rounded-full bg-white/10" />
                <div className="w-8 h-8 rounded-full bg-[#1DB954]" />
                <div className="w-6 h-6 rounded-full bg-white/10" />
              </div>
            </div>
          </div>
          <div className="w-32 h-56 bg-[#1A1A1A] rounded-[24px] border-2 border-white/10 shadow-2xl flex items-center justify-center overflow-hidden">
            <div className="w-full h-full bg-gradient-to-b from-[#1DB954]/20 to-transparent flex flex-col items-center justify-center gap-2">
              <MonitorSmartphone className="w-10 h-10 text-[#1DB954]" />
              <span className="text-white/60 text-xs text-center px-2">Desktop</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="px-4 md:px-8 py-12">
        <h2 className="text-3xl font-black text-center mb-3">Everything you need</h2>
        <p className="text-white/50 text-center mb-10">Built for music lovers who demand the best</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(({ Icon, title, desc }) => (
            <div key={title} className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 hover:border-[#1DB954]/30 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#1DB954]/10 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-[#1DB954]" />
              </div>
              <h3 className="text-white font-bold mb-1">{title}</h3>
              <p className="text-white/50 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Install steps */}
      <div className="px-4 md:px-8 py-12 bg-[#1A1A1A] mx-4 md:mx-8 rounded-3xl border border-white/5 mb-12">
        <h2 className="text-2xl font-black text-center mb-8">How to Install</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {installSteps.map(({ step, Icon, title, desc }) => (
            <div key={step} className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#1DB954] text-black font-black text-lg flex items-center justify-center mx-auto mb-3">{step}</div>
              <div className="flex items-center justify-center mb-2">
                <Icon className="w-6 h-6 text-[#1DB954]" />
              </div>
              <h3 className="text-white font-bold mb-1">{title}</h3>
              <p className="text-white/50 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bubblewrap / APK note */}
      <div className="px-4 md:px-8 mb-12">
        <div className="bg-[#1A1A1A] border border-[#1DB954]/20 rounded-2xl p-6 max-w-2xl mx-auto text-center">
          <h3 className="text-white font-bold text-lg mb-2">Want an Android APK?</h3>
          <p className="text-white/60 text-sm mb-4">
            Musika is fully compatible with Bubblewrap (Trusted Web Activity). Generate an Android APK from this PWA and distribute it via Google Play or directly.
          </p>
          <a
            href="https://github.com/GoogleChromeLabs/bubblewrap"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-full text-sm font-medium transition-colors"
          >
            Learn about Bubblewrap
          </a>
        </div>
      </div>

      {/* Reviews */}
      <div className="px-4 md:px-8 py-12">
        <h2 className="text-2xl font-black text-center mb-8">What users say</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {reviews.map(({ name, stars, text }) => (
            <div key={name} className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-6">
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: stars }).map((_, i) => <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />)}
              </div>
              <p className="text-white/80 text-sm mb-3 italic">"{text}"</p>
              <p className="text-white/50 text-xs font-semibold">{name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="px-4 md:px-8 py-12 max-w-2xl mx-auto">
        <h2 className="text-2xl font-black text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {faqs.map(({ q, a }, i) => (
            <div key={i} className="bg-[#1A1A1A] border border-white/5 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-white font-medium text-sm">{q}</span>
                {openFaq === i ? <ChevronUp className="w-4 h-4 text-white/50 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/50 flex-shrink-0" />}
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4">
                  <p className="text-white/60 text-sm">{a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 md:px-8 py-12 text-center">
        <h2 className="text-3xl font-black mb-4">Ready to start?</h2>
        <p className="text-white/50 mb-6">Free forever. No credit card. Install in 10 seconds.</p>
        {!installed && (
          <button
            onClick={installApp}
            className="flex items-center gap-3 bg-[#1DB954] text-black font-bold px-10 py-4 rounded-full text-lg hover:bg-[#1ed760] transition-all hover:scale-105 mx-auto shadow-lg shadow-[#1DB954]/30"
          >
            <Download className="w-6 h-6" />
            Install Musika Free
          </button>
        )}
      </div>
    </div>
  );
}
