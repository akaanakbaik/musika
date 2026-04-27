import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlayerProvider } from "@/lib/PlayerContext";
import { AuthProvider } from "@/lib/AuthContext";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { Player } from "@/components/Player";
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
import { useEffect, useState } from "react";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } }
});

const LOGO = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png";

function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFade(true), 1200);
    const t2 = setTimeout(() => onDone(), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0a] transition-opacity duration-500 ${fade ? "opacity-0 pointer-events-none" : "opacity-100"}`}
    >
      <div className="relative flex flex-col items-center gap-5">
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-[#1DB954]/20 blur-2xl scale-150 animate-pulse" />
          <div className="relative w-24 h-24 rounded-3xl bg-[#141414] border border-white/10 flex items-center justify-center shadow-2xl shadow-black splash-bounce">
            <img src={LOGO} alt="Musika" className="w-14 h-14 object-contain" />
          </div>
        </div>
        <div className="text-center splash-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="text-3xl font-black tracking-tight text-white">
            musi<span className="text-[#1DB954]">ka</span>
          </div>
          <div className="text-white/30 text-sm mt-1 tracking-widest uppercase font-medium">
            Your music, everywhere
          </div>
        </div>
        <div className="flex gap-1.5 mt-2 splash-slide-up" style={{ animationDelay: "0.4s" }}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-[#1DB954]"
              style={{
                animation: `musicBar 1s ease-in-out infinite`,
                animationDelay: `${i * 0.15}s`,
                height: "8px"
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={SearchResults} />
      <Route path="/favorites" component={Favorites} />
      <Route path="/history" component={History} />
      <Route path="/playlists" component={Playlists} />
      <Route path="/ai" component={AIChat} />
      <Route path="/profile" component={Profile} />
      <Route path="/download-app" component={DownloadApp} />
      <Route path="/download" component={DownloadApp} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);
  const isInstalled = window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <PlayerProvider>
            {isInstalled && !splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <div className="flex h-screen bg-[#121212] text-foreground overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-y-auto relative" style={{ paddingBottom: "160px" }}>
                  <AppRoutes />
                </main>
                <Player />
                <BottomNav />
              </div>
            </WouterRouter>
          </PlayerProvider>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
