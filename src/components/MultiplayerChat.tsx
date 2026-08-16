import React, { useState, useEffect, useRef } from 'react';
import { WSChatMessage } from '../utils/websocket';
import { MessageSquare, Send, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';

interface MultiplayerChatProps {
  chatMessages: WSChatMessage[];
  onSendMessage: (msg: string) => void;
  playerName: string;
}

export const MultiplayerChat: React.FC<MultiplayerChatProps> = ({
  chatMessages,
  onSendMessage,
  playerName,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isExpanded) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isExpanded]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="absolute bottom-16 left-4 z-20 max-w-[320px] w-full select-none animate-in fade-in">
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md transition text-xs font-bold cursor-pointer"
        >
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span>Чат игры</span>
          {chatMessages.length > 0 && (
            <span className="px-1.5 py-0.5 bg-indigo-600 text-white rounded-full text-3xs font-mono">
              {chatMessages.length}
            </span>
          )}
        </button>
      ) : (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-bold text-xs text-slate-200">Мультиплеер Чат</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Messages list */}
          <div className="p-2 space-y-1.5 h-[160px] overflow-y-auto custom-scrollbar text-2xs">
            {chatMessages.length === 0 ? (
              <div className="py-6 text-center text-slate-500 flex flex-col items-center gap-1">
                <Sparkles className="w-4 h-4 text-slate-600" />
                <span>Напишите первое сообщение в чат!</span>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div key={idx} className="bg-slate-800/40 p-1.5 rounded-xl border border-slate-800/60">
                  <div className="flex items-center justify-between gap-2 text-3xs text-slate-400 mb-0.5">
                    <span className="font-bold truncate" style={{ color: msg.chatColor || '#6366f1' }}>
                      {msg.chatSender || 'Игрок'}
                    </span>
                    <span className="font-mono text-slate-500">{msg.chatTimestamp}</span>
                  </div>
                  <div className="text-slate-200 break-words font-sans">{msg.chatMessage}</div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input form */}
          <form onSubmit={handleSubmit} className="p-1.5 bg-slate-950/80 border-t border-slate-800 flex items-center gap-1.5">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Сообщение..."
              className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1 text-2xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              maxLength={120}
            />
            <button
              type="submit"
              className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition cursor-pointer"
            >
              <Send className="w-3 h-3" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
