import React, { useEffect, useState } from 'react';
import { Database, Plus, Trash2, X, Play, RefreshCw, Bookmark, Sparkles, AlertCircle } from 'lucide-react';
import { CreatureElement } from '../types';

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
  onPlaceCreature: (creature: { name: string; color: string; elements: CreatureElement[] }) => void;
  onOpenNewEditor: () => void;
}

export const UserCreaturesModal: React.FC<UserCreaturesModalProps> = ({
  isOpen,
  onClose,
  token,
  username,
  onPlaceCreature,
  onOpenNewEditor,
}) => {
  const [creatures, setCreatures] = useState<SavedDBCreature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              {creatures.map((c) => (
                <div
                  key={c.id}
                  className="bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 transition flex flex-col justify-between gap-3 group shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-sm"
                        style={{ backgroundColor: c.color || '#6366f1' }}
                      />
                      <div>
                        <h3 className="font-semibold text-slate-100 text-sm">{c.name}</h3>
                        <p className="text-xs text-slate-500">
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
                        onClose();
                      }}
                      className="flex-1 py-1.5 px-3 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" /> Выпустить на поле
                    </button>
                  </div>
                </div>
              ))}
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
            className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium transition"
          >
            <Plus className="w-3.5 h-3.5" /> Конструктор нового чудика
          </button>
        </div>
      </div>
    </div>
  );
};
