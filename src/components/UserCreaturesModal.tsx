import React, { useEffect, useState } from 'react';
import { Database, Plus, Trash2, X, Play, RefreshCw, Bookmark, Sparkles, AlertCircle, Coins, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Creature, CreatureElement } from '../types';
import { calculateElementsPrice, isInsideBase } from '../utils/creatures';

export interface SavedDBCreature {
  id: string;
  userId: string;
  name: string;
  color: string;
  elements: CreatureElement[];
  createdAt: string;
  updatedAt: string;
}

interface UserCreaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  username: string | null;
  userCreature?: Creature | null;
  food?: number;
  worldRadius?: number;
  onPlaceCreature: (creature: { name: string; color: string; elements: CreatureElement[] }) => void;
  onOpenNewEditor: () => void;
}

export const UserCreaturesModal: React.FC<UserCreaturesModalProps> = ({
  isOpen,
  onClose,
  token,
  username,
  userCreature,
  food = 0,
  worldRadius = 50,
  onPlaceCreature,
  onOpenNewEditor,
}) => {
  const [creatures, setCreatures] = useState<SavedDBCreature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inBase = userCreature ? Boolean(userCreature.inBase || isInsideBase(userCreature.x, userCreature.y, worldRadius)) : false;
  const playerCreatureCost = userCreature ? calculateElementsPrice(userCreature.elements) : 0;
  const playerFood = userCreature ? (typeof userCreature.foodEaten === 'number' ? userCreature.foodEaten : (userCreature.bankFood ?? food)) : food;
  const totalBalance = playerCreatureCost + Math.max(0, playerFood);

  const fetchUserCreatures = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/user/creatures', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Не удалось загрузить коллекцию');
      }
      setCreatures(data.creatures || []);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки базы данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && token) {
      fetchUserCreatures();
    }
  }, [isOpen, token]);

  const handleDelete = async (id: string, name: string) => {
    if (!token) return;
    if (!window.confirm(`Вы уверены, что хотите удалить чудика "${name}" из базы данных?`)) return;

    try {
      const response = await fetch(`/api/user/creatures/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Не удалось удалить чудика');
      }
      setCreatures((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message || 'Ошибка при удалении');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                Коллекция чудиков ({username || 'Мой аккаунт'})
              </h2>
              <p className="text-xs text-slate-400">Сохранено в базе данных MySQL</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUserCreatures}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Обновить список"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Player Status & Requirements Bar */}
        <div className="px-6 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {inBase ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-semibold text-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                1. Вы на Базе (Safe Zone)
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950/80 border border-rose-500/40 text-rose-300 font-semibold text-2xs">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                1. Вне Базы! Зайдите на базу
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono text-2xs">
            <span className="text-slate-400">Доступно средств:</span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 font-bold">
              🍎 {totalBalance} (чудик: {playerCreatureCost} + еда: {playerFood})
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
              <span>Загрузка вашей коллекции из базы данных...</span>
            </div>
          ) : creatures.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <Bookmark className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm">В вашей базе данных пока нет сохраненных чудиков.</p>
              <button
                onClick={() => {
                  onClose();
                  onOpenNewEditor();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-indigo-600/30"
              >
                <Plus className="w-4 h-4" /> Создать первого чудика
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {creatures.map((c) => {
                const price = calculateElementsPrice(c.elements || []);
                const isAffordable = totalBalance >= price;

                return (
                  <div
                    key={c.id}
                    className={`bg-slate-950 border rounded-xl p-4 transition flex flex-col justify-between gap-3 group shadow-sm hover:shadow-md ${
                      inBase && isAffordable
                        ? 'border-slate-800 hover:border-emerald-500/50'
                        : 'border-slate-800/80 opacity-90'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-sm"
                          style={{ backgroundColor: c.color || '#6366f1' }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-slate-100 text-sm truncate">{c.name}</h3>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                isAffordable
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              }`}
                              title={`Стоимость чудика: ${price} 🍎`}
                            >
                              🍎 {price}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {c.elements?.length || 0} элементов • {new Date(c.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition"
                        title="Удалить из коллекции"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                      <button
                        onClick={() => {
                          onPlaceCreature({
                            name: c.name,
                            color: c.color,
                            elements: c.elements,
                          });
                        }}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                          inBase && isAffordable
                            ? 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 cursor-pointer shadow-sm'
                            : !inBase
                            ? 'bg-slate-800/60 hover:bg-slate-800 text-amber-300 border border-slate-700 cursor-pointer'
                            : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 cursor-pointer'
                        }`}
                        title={
                          !inBase
                            ? '⚠️ Вы вне Базы! Смена доступна только на Базе.'
                            : !isAffordable
                            ? `⚠️ Не хватает ${price - totalBalance} 🍎 для выбора чудика!`
                            : `Выбрать чудика "${c.name}" за ${price} 🍎`
                        }
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Выбрать на поле (🍎 {price})</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>Всего в коллекции: {creatures.length}</span>
          <button
            onClick={() => {
              onClose();
              onOpenNewEditor();
            }}
            className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Конструктор нового чудика
          </button>
        </div>
      </div>
    </div>
  );
};
