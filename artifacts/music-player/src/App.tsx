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

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } }
});

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
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <PlayerProvider>
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
