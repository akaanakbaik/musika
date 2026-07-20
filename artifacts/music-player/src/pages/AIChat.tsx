import React, { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Loader2, Trash2, Sparkles, Copy, CheckCheck, Music2 } from "lucide-react";
import { aiChat } from "@/lib/musicApi";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  id: string;
}

const STORAGE_KEY = "musika-ai-chat-v3";

function genId() { return Math.random().toString(36).slice(2, 10); }

const INIT_MSG: Message = {
  role: "assistant",
  content: "Halo! Saya **Musika AI** — asisten musik personalmu.\n\nTanyakan apa saja: rekomendasi lagu, info artis, genre, lirik, atau fitur Musika. Saya siap membantu! 🎵",
  timestamp: new Date().toISOString(),
  id: "init"
};

const SUGGESTIONS_ID = [
  "🏋️ Lagu untuk olahraga",
  "🔥 Lagu trending 2025",
  "🌙 Playlist santai malam",
  "💜 Ceritakan tentang BTS",
  "📚 Musik untuk fokus belajar",
  "🌊 Apa itu musik Lo-fi?",
  "🎸 Artis indie terbaik",
  "💃 Lagu K-pop viral",
];
const SUGGESTIONS_EN = [
  "🏋️ Workout playlist",
  "🔥 Trending songs 2025",
  "🌙 Chill night vibes",
  "💜 Tell me about BTS",
  "📚 Music to study to",
  "🌊 What is Lo-fi?",
  "🎸 Best indie artists",
  "💃 Viral K-pop hits",
];

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [INIT_MSG];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Add id to old messages if missing
      return parsed.map(m => ({ ...m, id: m.id || genId() }));
    }
    return [INIT_MSG];
  } catch { return [INIT_MSG]; }
}

function saveMessages(msgs: Message[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-120))); } catch {}
}

// Parse markdown-ish content to HTML
function parseContent(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code inline
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded text-xs font-mono bg-black/20 dark:bg-white/15">$1</code>')
    // Numbered list
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Bullet list
    .replace(/^[-•]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Wrap li groups
    .replace(/(<li[^>]*>.*?<\/li>\n?)+/g, '<ul class="my-2 space-y-0.5">$&</ul>')
    // Double newline = paragraph break
    .replace(/\n\n/g, '</p><p class="mt-2">')
    // Single newline
    .replace(/\n/g, '<br/>');
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

interface AIChatProps { isActive?: boolean; }

export default function AIChat({ isActive }: AIChatProps) {
  const { theme, accentColor, lang } = useAppSettings();
  const [messages, setMessages] = useState<Message[]>(() => loadMessages());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#0d0d0d]" : "bg-[#F5F5F5]";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";
  const inputBg = isDark
    ? "bg-[#1e1e1e] border-white/10 text-white placeholder:text-white/30 focus:border-white/25"
    : "bg-white border-black/10 text-[#121212] placeholder:text-black/30 focus:border-black/25";
  const borderC = isDark ? "border-white/8" : "border-black/8";
  const msgBotBg = isDark ? "bg-[#1c1c1c] border border-white/8" : "bg-white border border-black/8";
  const SUGGESTIONS = lang === "en" ? SUGGESTIONS_EN : SUGGESTIONS_ID;

  useEffect(() => { saveMessages(messages); }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (isActive) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "instant" });
        inputRef.current?.focus();
      }, 80);
    }
  }, [isActive]);

  const sendMessage = useCallback(async (msg?: string) => {
    const text = (msg || input).trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text, timestamp: new Date().toISOString(), id: genId() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const reply = await aiChat(text);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: reply,
        timestamp: new Date().toISOString(),
        id: genId()
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: lang === "en"
          ? "Sorry, I couldn't process that. Please check your connection and try again."
          : "Maaf, tidak dapat memproses permintaan. Periksa koneksi dan coba lagi.",
        timestamp: new Date().toISOString(),
        id: genId()
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, loading, lang]);

  async function copyMessage(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content.replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, ""));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  }

  function clearChat() {
    const fresh: Message = {
      role: "assistant",
      content: lang === "en"
        ? "Chat cleared! What would you like to know about music? 🎵"
        : "Obrolan dihapus! Apa yang ingin kamu tanyakan tentang musik? 🎵",
      timestamp: new Date().toISOString(),
      id: genId()
    };
    setMessages([fresh]);
  }

  const showSuggestions = messages.length <= 1 && !loading;

  return (
    <div className={`flex flex-col h-full ${bg} overflow-hidden`}>

      {/* ── Header ── */}
      <div className={`relative flex items-center justify-between px-4 py-3.5 border-b ${borderC} flex-shrink-0`}
        style={{ background: isDark ? "linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%)" : "white" }}>
        {/* Glow behind avatar */}
        <div className="absolute left-4 top-2 w-10 h-10 rounded-full blur-lg opacity-30 pointer-events-none"
          style={{ background: accentColor }} />

        <div className="flex items-center gap-3 relative z-10">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}99)` }}>
              <Bot className="w-5 h-5 text-black" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0d0d0d] animate-pulse" />
          </div>
          <div>
            <p className={`text-sm font-bold ${textP}`}>Musika AI</p>
            <div className="flex items-center gap-1.5">
              <Music2 className="w-3 h-3 text-emerald-400" />
              <p className="text-[11px] text-emerald-400 font-medium">
                {lang === "en" ? "Music Assistant" : "Asisten Musik"}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={clearChat}
          className={`relative z-10 p-2 rounded-xl transition-all active:scale-90 ${isDark ? "hover:bg-white/10" : "hover:bg-black/8"}`}
          title={lang === "en" ? "Clear chat" : "Hapus obrolan"}
        >
          <Trash2 className={`w-4 h-4 ${textS}`} />
        </button>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5" style={{ minHeight: 0 }}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 group ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>

            {/* Bot avatar */}
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center shadow-md mt-0.5"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)` }}>
                <Bot className="w-4 h-4 text-black" />
              </div>
            )}

            <div className={`flex flex-col gap-1 max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>

              {/* Message bubble */}
              <div
                className={`relative px-4 py-2.5 text-sm leading-relaxed shadow-sm ${msg.role === "user" ? "text-black" : `${msgBotBg} ${textP}`}`}
                style={{
                  borderRadius: msg.role === "user" ? "20px 20px 5px 20px" : "5px 20px 20px 20px",
                  background: msg.role === "user" ? `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` : undefined,
                  boxShadow: msg.role === "user" ? `0 2px 12px ${accentColor}33` : undefined
                }}
              >
                <p
                  className="leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: parseContent(msg.content) }}
                />

                {/* Copy button — appears on hover */}
                {msg.role === "assistant" && (
                  <button
                    onClick={() => copyMessage(msg.id, msg.content)}
                    className={`absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 rounded-lg ${isDark ? "bg-[#2a2a2a] hover:bg-white/15" : "bg-gray-100 hover:bg-gray-200"}`}
                    title="Copy"
                  >
                    {copiedId === msg.id
                      ? <CheckCheck className="w-3 h-3 text-emerald-400" />
                      : <Copy className={`w-3 h-3 ${textS}`} />
                    }
                  </button>
                )}
              </div>

              {/* Timestamp */}
              <p className={`text-[10px] px-1 ${textS}`}>{formatTime(msg.timestamp)}</p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center shadow-md"
              style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)` }}>
              <Bot className="w-4 h-4 text-black" />
            </div>
            <div className={`px-4 py-3.5 rounded-[5px_20px_20px_20px] shadow-sm ${msgBotBg}`}>
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: accentColor, animationDelay: `${i * 0.18}s`, animationDuration: "0.8s" }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Suggestions ── */}
      {showSuggestions && (
        <div className={`px-4 pt-3 pb-2 flex-shrink-0 border-t ${borderC}`}
          style={{ background: isDark ? "#111111" : "#fafafa" }}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <Sparkles className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <p className={`text-xs font-semibold ${textS}`}>
              {lang === "en" ? "Ask me anything" : "Coba tanyakan"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SUGGESTIONS.slice(0, 6).map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className={`text-left text-xs px-3 py-2.5 rounded-xl border ${borderC} ${isDark ? "bg-white/4 hover:bg-white/8 active:bg-white/12" : "bg-white hover:bg-black/4 active:bg-black/8"} ${textP} transition-all duration-150 active:scale-[0.97] line-clamp-1`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input ── */}
      <div
        className={`px-4 py-3 border-t ${borderC} flex-shrink-0`}
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)",
          background: isDark ? "#0d0d0d" : "white"
        }}
      >
        <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={lang === "en" ? "Ask anything about music…" : "Tanyakan tentang musik…"}
              className={`w-full rounded-2xl px-4 py-3 text-sm outline-none border transition-all duration-200 pr-2 ${inputBg}`}
              disabled={loading}
              maxLength={500}
            />
          </div>

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all duration-150 active:scale-90 shadow-md"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
              boxShadow: input.trim() ? `0 4px 15px ${accentColor}44` : "none"
            }}
          >
            {loading
              ? <Loader2 className="w-5 h-5 text-black animate-spin" />
              : <Send className="w-4.5 h-4.5 text-black" style={{ width: "1.1rem", height: "1.1rem" }} />
            }
          </button>
        </form>
      </div>
    </div>
  );
}
