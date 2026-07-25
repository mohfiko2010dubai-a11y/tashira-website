import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/providers/trpc';
import {
  MessageSquare, Send, RefreshCw, Circle, CheckCircle,
  Phone, Mail, User, Clock, Search
} from 'lucide-react';

interface ChatSession {
  sessionId: string;
  lastMessage: string;
  lastContent: string;
  visitorName: string | null;
  visitorEmail: string | null;
  visitorPhone: string | null;
  unreadCount: number;
}

interface ChatMessage {
  id: number;
  sessionId: string;
  role: "user" | "assistant" | "admin";
  content: string;
  visitorName: string | null;
  visitorEmail: string | null;
  visitorPhone: string | null;
  isRead: "read" | "unread";
  createdAt: Date;
}

export default function AdminChat() {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: sessions, isLoading, refetch } = trpc.chat.listSessions.useQuery(
    { status: filter, limit: 50 },
    { refetchInterval: 10000 }
  );

  const { data: messages } = trpc.chat.getConversation.useQuery(
    { sessionId: selectedSession! },
    { enabled: !!selectedSession, refetchInterval: 5000 }
  );

  const markAsRead = trpc.chat.markAsRead.useMutation({
    onSuccess: () => refetch(),
  });

  const adminReply = trpc.chat.adminReply.useMutation({
    onSuccess: () => {
      setReplyText('');
      // Refresh conversation
      utils.chat.getConversation.invalidate({ sessionId: selectedSession! });
    },
  });

  const utils = trpc.useUtils();

  useEffect(() => {
    if (selectedSession) {
      markAsRead.mutate({ sessionId: selectedSession });
    }
  }, [selectedSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedSessionData = sessions?.find(s => s.sessionId === selectedSession);

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedSession) return;
    adminReply.mutate({ sessionId: selectedSession, content: replyText });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare size={24} className="text-[#C9A04C]" />
            <h1 className="text-xl font-bold text-[#1A2332]">Chat Inbox</h1>
            <span className="bg-[#C9A04C] text-white text-xs font-bold px-2 py-1 rounded-full">
              {sessions?.reduce((acc, s) => acc + (s.unreadCount || 0), 0) || 0} new
            </span>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-[#C9A04C] transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sessions List */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
          {/* Filter Tabs */}
          <div className="flex border-b border-gray-200">
            {(['all', 'unread', 'read'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                  filter === f
                    ? 'text-[#C9A04C] border-b-2 border-[#C9A04C]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f}
                {f === 'unread' && (
                  <span className="ml-1 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">
                    {sessions?.reduce((acc, s) => acc + (s.unreadCount || 0), 0) || 0}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Sessions */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw size={20} className="text-gray-400 animate-spin" />
              </div>
            ) : sessions?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <MessageSquare size={32} />
                <p className="mt-2 text-sm">No conversations yet</p>
              </div>
            ) : (
              sessions?.map(session => (
                <button
                  key={session.sessionId}
                  onClick={() => setSelectedSession(session.sessionId)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedSession === session.sessionId ? 'bg-[#FFF8E7] border-l-4 border-l-[#C9A04C]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {session.unreadCount > 0 ? (
                          <Circle size={8} className="text-red-500 fill-red-500" />
                        ) : (
                          <CheckCircle size={8} className="text-green-500" />
                        )}
                        <span className="font-medium text-sm text-[#1A2332] truncate">
                          {session.visitorName || 'Anonymous Visitor'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {session.lastContent?.substring(0, 60) || '...'}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        {session.visitorEmail && (
                          <span className="flex items-center gap-1 text-[10px] text-gray-400">
                            <Mail size={10} /> {session.visitorEmail}
                          </span>
                        )}
                        {session.visitorPhone && (
                          <span className="flex items-center gap-1 text-[10px] text-gray-400">
                            <Phone size={10} /> {session.visitorPhone}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <span className="text-[10px] text-gray-400">
                        {new Date(session.lastMessage).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {session.unreadCount > 0 && (
                        <span className="block mt-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full text-center">
                          {session.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {selectedSession && selectedSessionData ? (
            <>
              {/* Visitor Info Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#C9A04C] flex items-center justify-center text-white font-bold">
                      {(selectedSessionData.visitorName || 'A')[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#1A2332]">
                        {selectedSessionData.visitorName || 'Anonymous Visitor'}
                      </h3>
                      <div className="flex items-center gap-4 mt-0.5">
                        {selectedSessionData.visitorEmail && (
                          <a
                            href={`mailto:${selectedSessionData.visitorEmail}`}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#C9A04C]"
                          >
                            <Mail size={12} />
                            {selectedSessionData.visitorEmail}
                          </a>
                        )}
                        {selectedSessionData.visitorPhone && (
                          <a
                            href={`tel:${selectedSessionData.visitorPhone}`}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#C9A04C]"
                          >
                            <Phone size={12} />
                            {selectedSessionData.visitorPhone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock size={14} />
                    <span>Session: {selectedSession.substring(0, 8)}...</span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {messages?.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === 'user' ? 'justify-start' : msg.role === 'admin' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-3 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-white border border-gray-200 text-[#1A2332] rounded-tl-none'
                          : msg.role === 'admin'
                          ? 'bg-[#C9A04C] text-white rounded-tr-none'
                          : 'bg-gray-200 text-[#1A2332] rounded-tl-none'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase ${
                          msg.role === 'admin' ? 'text-white/80' : 'text-gray-400'
                        }`}>
                          {msg.role === 'user' ? 'Visitor' : msg.role === 'admin' ? 'You' : 'AI Bot'}
                        </span>
                        <span className={`text-[10px] ${
                          msg.role === 'admin' ? 'text-white/60' : 'text-gray-400'
                        }`}>
                          {new Date(msg.createdAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Input */}
              <div className="bg-white border-t border-gray-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                    placeholder="Type your reply..."
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#C9A04C] text-sm"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || adminReply.isPending}
                    className="px-6 py-3 bg-[#C9A04C] text-white rounded-lg hover:bg-[#DDBB7A] transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Send size={16} />
                    {adminReply.isPending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageSquare size={48} className="mb-4" />
              <p className="text-lg font-medium">Select a conversation to start</p>
              <p className="text-sm mt-1">Click on a chat session from the left panel</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
