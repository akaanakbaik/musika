import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlayerProvider } from "@/lib/PlayerContext";
import { AuthProvider } from "@/lib/AuthContext";
import { AppSettingsProvider, useAppSettings } from "@/lib/AppSettingsContext";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { Player } from "@/components/Player";
import { PWABanner } from "@/components/PWABanner";
import { TopProgressBar } from "@/components/TopProgressBar";
import Home from "@/pages/Home";
import SearchResults from "@/pages/SearchResults";
import Favorites from "@/pages/Favorites";
import History from "@/pages/History";
import Playlists from "@/pages/Playlists";
import AIChat from "@/pages/AIChat";
import Profile from "@/pages/Profile";
import DownloadApp from "@/pages/DownloadApp";
import AuthPage from "@/components/auth/AuthPage";
import NotFound from "@/pages/not-found";
import PlaylistDetail from "@/pages/PlaylistDetail";
import { useEffect, useState } from "react";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } }
});

const LOGO = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png";

function isPWA() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://")
  );
}

function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fade, setFade] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setFade(true), 1400);
    const t2 = setTimeout(() => onDone(), 1900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0a] transition-opacity duration-500 ${fade ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
      <div className="relative flex flex-col items-center gap-5">
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-[#1DB954]/20 blur-2xl scale-150 animate-pulse" />
          <div className="relative w-24 h-24 rounded-3xl bg-[#141414] border border-white/10 flex items-center justify-center shadow-2xl shadow-black splash-bounce">
            <img src={LOGO} alt="Musika" className="w-14 h-14 object-contain" />
          </div>
        </div>
        <div className="text-center splash-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="text-3xl font-black tracking-tight text-white">musi<span className="text-[#1DB954]">ka</span></div>
          <div className="text-white/30 text-sm mt-1 tracking-widest uppercase font-medium">Your music, everywhere</div>
        </div>
        <div className="flex gap-1.5 mt-2 splash-slide-up" style={{ animationDelay: "0.4s" }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="w-1.5 rounded-full bg-[#1DB954]" style={{ animation: "musicBar 1s ease-in-out infinite", animationDelay: `${i * 0.15}s`, height: "8px" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const [location] = useLocation();
  const isAI = location === "/ai";
  return (
    <>
      {/* AIChat always stays mounted — hides with CSS to preserve chat state */}
      <div
        style={{ display: isAI ? "flex" : "none", flexDirection: "column", height: "100%", minHeight: 0 }}
        aria-hidden={!isAI}
      >
        <AIChat isActive={isAI} />
      </div>

      {!isAI && (
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/search" component={SearchResults} />
          <Route path="/favorites" component={Favorites} />
          <Route path="/history" component={History} />
          <Route path="/playlists" component={Playlists} />
          <Route path="/playlist/:id" component={PlaylistDetail} />
          <Route path="/profile" component={Profile} />
          <Route path="/download-app" component={DownloadApp} />
          <Route path="/download" component={DownloadApp} />
          <Route path="/auth" component={AuthPage} />
          <Route component={NotFound} />
        </Switch>
      )}
    </>
  );
}

function AppShell() {
  const { theme } = useAppSettings();
  const [splashDone, setSplashDone] = useState(!isPWA());
  const bgClass = theme === "light" ? "bg-[#F5F5F5] text-[#121212]" : "bg-[#121212] text-white";

  return (
    <>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
      <TopProgressBar />
      <div className={`flex h-screen ${bgClass}`} style={{ overflow: "hidden" }}>
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Main content column */}
        <div className="flex-1 flex flex-col min-w-0" style={{ overflow: "hidden" }}>
          {/* Mobile-only header */}
          <Header />

          {/* PWA install banner — web only, mobile only */}
          <div className="md:hidden flex-shrink-0">
            <PWABanner />
          </div>

          {/* Scrollable main area */}
          <main
            className="flex-1 overflow-y-auto scrollbar-hide"
            style={{
              paddingTop: "56px",       /* header height on mobile */
              paddingBottom: "148px",   /* player (72px) + bottomnav (60px) + gap */
            }}
          >
            <AppRoutes />
          </main>
        </div>

        <Player />
        <BottomNav />
      </div>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <TooltipProvider>
          <AuthProvider>
            <PlayerProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/^\.\/|\/$/g, "")}>
                <AppShell />
              </WouterRouter>
            </PlayerProvider>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
}

export default App;
