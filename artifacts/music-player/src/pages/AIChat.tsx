import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, Trash2, Music, Sparkles } from "lucide-react";
import { aiChat } from "@/lib/musicApi";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const LOGO = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png";

const SUGGESTIONS = [
  "Recommend me songs for working out 💪",
  "What are the top songs in 2024?",
  "Suggest a romantic playlist 🌹",
  "Tell me about BTS",
  "Songs to listen to while studying 📚",
  "What is Lo-fi music?",
];

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm **Musika AI** 🎵 — your personal music companion. Ask me anything about music — recommendations, artists, genres, or how to use Musika features. How can I help you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(msg?: string) {
    const text = (msg || input).trim();
    if (!text || loading) return;
    setInput("");
    
    const userMsg: Message = { role: "user", content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const reply = await aiChat(text);
      setMessages(prev => [...prev, { role: "assistant", content: reply, timestamp: new Date() }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I couldn't process that. Please try again! 🙏",
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([{
      role: "assistant",
      content: "Chat cleared! What would you like to know about music? 🎵",
      timestamp: new Date()
    }]);
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

  return (
    <div className="flex flex-col h-screen bg-[#121212] pb-16 md:pb-0">
      {/* Header */}
      <div className="bg-[#1A1A1A] border-b border-white/10 px-4 md:px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1DB954] to-emerald-800 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold">Musika AI</h1>
            <p className="text-[#1DB954] text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#1DB954] rounded-full inline-block animate-pulse" />
              Online • Powered by GPT-5
            </p>
          </div>
        </div>
        <button onClick={clearChat} className="text-white/50 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors" title="Clear chat">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1DB954] to-emerald-800 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[80%] md:max-w-[70%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#1DB954] text-black rounded-br-sm font-medium"
                  : "bg-[#282828] text-white rounded-bl-sm border border-white/5"
              }`}>
                {msg.role === "assistant" ? (
                  <div dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
                ) : msg.content}
              </div>
              <span className="text-white/30 text-[10px] mt-1 px-1">
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1DB954] to-emerald-800 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-[#282828] border border-white/5 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1.5 items-center h-4">
                <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 md:px-6 pb-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="flex-shrink-0 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs px-3 py-2 rounded-full transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-[#1A1A1A] border-t border-white/10 px-4 md:px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask me anything about music…"
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#1DB954] transition-colors"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-11 h-11 bg-[#1DB954] text-black rounded-full flex items-center justify-center hover:bg-[#1ed760] disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
