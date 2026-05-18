import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { trpc } from '@/providers/trpc';

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: (data) => {
      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      }
      setLoading(false);
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, an error occurred. Please try again.' }]);
      setLoading(false);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setInput('');
    setLoading(true);
    sendMessage.mutate({ sessionId, message: msg });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 ${
          open ? 'bg-gray-700' : 'bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A]'
        }`}
      >
        {open ? <X size={22} className="text-white" /> : <MessageCircle size={22} className="text-white" />}
      </button>

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Tashira Assistant</p>
              <p className="text-white/80 text-[11px]">AI Visa Support</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[360px]">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-8">
                <Bot size={32} className="mx-auto mb-3 text-gray-300" />
                <p>Hello! I'm your Tashira visa assistant.</p>
                <p className="text-xs mt-1">How can I help you today?</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-gray-100' : 'bg-[#C9A04C]/10'
                }`}>
                  {msg.role === 'user' ? <User size={14} className="text-gray-500" /> : <Bot size={14} className="text-[#C9A04C]" />}
                </div>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-[#C9A04C] text-white rounded-tr-sm' 
                    : 'bg-gray-100 text-gray-700 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-[#C9A04C]/10 flex items-center justify-center">
                  <Bot size={14} className="text-[#C9A04C]" />
                </div>
                <div className="bg-gray-100 rounded-xl px-3 py-2 rounded-tl-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C] outline-none"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="p-2 bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A] text-white rounded-lg disabled:opacity-40 hover:shadow-md transition-all"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
