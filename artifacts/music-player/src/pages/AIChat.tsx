import React, { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Loader2, Trash2, Sparkles } from "lucide-react";
import { aiChat } from "@/lib/musicApi";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const STORAGE_KEY = "musika-ai-chat-v2";
const INIT_MSG: Message = {
  role: "assistant",
  content: "Halo! Saya **Musika AI** — asisten musik personalmu. Tanyakan apa saja tentang musik — rekomendasi, artis, genre, atau fitur Musika. Bagaimana saya bisa membantu?",
  timestamp: new Date().toISOString()
};

const SUGGESTIONS_ID = [
  "Rekomendasikan lagu untuk olahraga",
  "Lagu trending Indonesia 2024",
  "Playlist romantis malam ini",
  "Ceritakan tentang BTS",
  "Musik terbaik untuk belajar",
  "Apa itu musik Lo-fi?",
];

const SUGGESTIONS_EN = [
  "Recommend songs for working out",
  "Top songs in 2024",
  "Suggest a romantic playlist",
  "Tell me about BTS",
  "Songs for studying",
  "What is Lo-fi music?",
];

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [INIT_MSG];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [INIT_MSG];
  } catch { return [INIT_MSG]; }
}

function saveMessages(msgs: Message[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-100))); } catch {}
}

function formatContent(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul class="list-disc pl-4 space-y-1 my-2">$1</ul>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>');
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

export default function AIChat() {
  const { theme, accentColor, lang } = useAppSettings();
  const [messages, setMessages] = useState<Message[]>(() => loadMessages());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#121212]" : "bg-[#F5F5F5]";
  const cardBg = isDark ? "bg-[#1a1a1a]" : "bg-white";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";
  const inputBg = isDark ? "bg-[#1e1e1e] border-white/10 text-white placeholder:text-white/30" : "bg-white border-black/10 text-[#121212] placeholder:text-black/30";
  const borderC = isDark ? "border-white/8" : "border-black/8";
  const SUGGESTIONS = lang === "en" ? SUGGESTIONS_EN : SUGGESTIONS_ID;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { saveMessages(messages); }, [messages]);

  const sendMessage = useCallback(async (msg?: string) => {
    const text = (msg || input).trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: Message = { role: "user", content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const reply = await aiChat(text);
      setMessages(prev => [...prev, { role: "assistant", content: reply, timestamp: new Date().toISOString() }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: lang === "en" ? "Sorry, I couldn't process that. Please try again." : "Maaf, tidak dapat memproses permintaan. Silakan coba lagi.", timestamp: new Date().toISOString() }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, lang]);

  function clearChat() {
    const fresh = { role: "assistant" as const, content: lang === "en" ? "Chat cleared! What would you like to know about music?" : "Obrolan dihapus! Apa yang ingin kamu tanyakan tentang musik?", timestamp: new Date().toISOString() };
    setMessages([fresh]);
    saveMessages([fresh]);
  }

  return (
    <div className={`flex flex-col h-full ${bg}`} style={{ minHeight: "100%" }}>
      <div className={`flex items-center justify-between px-4 py-3 border-b ${borderC} ${isDark ? "bg-[#121212]/80" : "bg-white/80"} backdrop-blur-sm sticky top-0 z-10`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: accentColor + "22" }}>
            <Bot className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          <div>
            <p className={`text-sm font-bold ${textP}`}>Musika AI</p>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs text-emerald-400">Online</p>
            </div>
          </div>
        </div>
        <button onClick={clearChat} className={`p-2 rounded-full ${isDark ? "hover:bg-white/10" : "hover:bg-black/10"} transition-colors`}>
          <Trash2 className={`w-4 h-4 ${textS}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5" style={{ background: accentColor }}>
                <Bot className="w-4 h-4 text-black" />
              </div>
            )}
            <div className={`max-w-[78%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div
                className={`px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "text-black" : `${cardBg} border ${borderC} ${textP}`}`}
                style={{ borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: msg.role === "user" ? accentColor : undefined }}
                dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
              />
              <p className={`text-[10px] px-1 ${textS}`}>{formatTime(msg.timestamp)}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: accentColor }}>
              <Bot className="w-4 h-4 text-black" />
            </div>
            <div className={`px-4 py-3 ${cardBg} border ${borderC}`} style={{ borderRadius: "18px 18px 18px 4px" }}>
              <div className="flex gap-1">
                {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: accentColor, animationDelay: `${i*0.15}s` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && !loading && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <p className={`text-xs font-medium ${textS}`}>{lang === "en" ? "Suggested questions" : "Saran pertanyaan"}</p>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => sendMessage(s)} className={`flex-shrink-0 text-xs px-3 py-2 rounded-full border ${borderC} ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10"} ${textP} transition-colors whitespace-nowrap`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`px-4 py-3 border-t ${borderC} ${isDark ? "bg-[#121212]" : "bg-white"}`} style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}>
        <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={lang === "en" ? "Ask anything about music…" : "Tanyakan apa saja tentang musik…"}
            className={`flex-1 rounded-2xl px-4 py-3 text-sm outline-none border ${inputBg} transition-colors`}
            disabled={loading}
          />
          <button type="submit" disabled={!input.trim() || loading} className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all active:scale-90" style={{ background: accentColor }}>
            {loading ? <Loader2 className="w-5 h-5 text-black animate-spin" /> : <Send className="w-5 h-5 text-black" />}
          </button>
        </form>
      </div>
    </div>
  );
}
