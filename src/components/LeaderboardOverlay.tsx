import React, { useState } from 'react';
import { LeaderboardEntry, ServerStats } from '../utils/websocket';
import { Trophy, Users, Zap, ChevronDown, ChevronUp, Cpu, Flame, ShieldAlert } from 'lucide-react';

interface LeaderboardOverlayProps {
  leaderboard: LeaderboardEntry[];
  stats: ServerStats | null;
  yourCreatureId: string | null;
  pingMs: number;
}

export const LeaderboardOverlay: React.FC<LeaderboardOverlayProps> = ({
  leaderboard = [],
  stats,
  yourCreatureId,
  pingMs,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const yourEntry = (leaderboard || []).find((l) => l.id === yourCreatureId);

  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 max-w-[280px] w-full select-none animate-in fade-in">
      {/* Go Engine Server Badge */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-indigo-500/40 shadow-lg text-2xs text-slate-300">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-indigo-300 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-indigo-400" />
            <span>Go Server</span>
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400 font-mono">30 Hz</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-slate-400">
          <Zap className="w-3 h-3 text-amber-400" />
          <span className={pingMs < 80 ? 'text-emerald-400' : 'text-amber-400'}>{pingMs} ms</span>
        </div>
      </div>

      {/* Leaderboard Panel */}
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center justify-between px-3.5 py-2.5 bg-slate-800/80 cursor-pointer hover:bg-slate-800 transition"
        >
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400 animate-bounce" />
            <span className="font-bold text-xs text-slate-100 uppercase tracking-wide">
              Топ Чудиков (Slither)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {stats && (
              <span className="text-2xs text-slate-400 font-mono flex items-center gap-1">
                <Users className="w-3 h-3 text-indigo-400" />
                <span>{stats.activePlayers + stats.activeBots}</span>
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="p-2 space-y-1 max-h-[220px] overflow-y-auto custom-scrollbar">
            {leaderboard.length === 0 ? (
              <div className="py-3 text-center text-2xs text-slate-500">Загрузка рейтинга...</div>
            ) : (
              leaderboard.map((entry) => {
                const isYou = entry.id === yourCreatureId;
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between px-2.5 py-1 rounded-xl text-2xs transition ${
                      isYou
                        ? 'bg-indigo-600/30 border border-indigo-500/60 text-white font-bold'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`font-mono font-bold w-4 text-center ${
                          entry.rank === 1
                            ? 'text-amber-400 text-xs'
                            : entry.rank === 2
                            ? 'text-slate-300'
                            : entry.rank === 3
                            ? 'text-amber-600'
                            : 'text-slate-500'
                        }`}
                      >
                        #{entry.rank}
                      </span>
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: entry.color || '#6366f1' }}
                      />
                      <span className="truncate max-w-[110px]">
                        {entry.name} {entry.isBot && <span className="text-3xs text-slate-500">(BOT)</span>}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono shrink-0">
                      {entry.kills > 0 && (
                        <span className="text-red-400 text-3xs flex items-center gap-0.5" title="Уничтожено чудиков">
                          <Flame className="w-2.5 h-2.5" />
                          <span>{entry.kills}</span>
                        </span>
                      )}
                      <span className="font-bold text-amber-300">{entry.score}</span>
                    </div>
                  </div>
                );
              })
            )}

            {yourEntry && yourEntry.rank > 10 && (
              <div className="mt-1 pt-1 border-t border-slate-800 flex items-center justify-between px-2.5 py-1 bg-indigo-950/40 rounded-xl text-2xs text-indigo-300 font-bold">
                <span>Ваша позиция: #{yourEntry.rank} {yourEntry.name}</span>
                <span className="font-mono text-amber-300">{yourEntry.score}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
