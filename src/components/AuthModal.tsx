import React, { useState } from 'react';
import { LogIn, UserPlus, X, Lock, User, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: { id: string; username: string }, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (!response.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Ошибка авторизации');
      }

      localStorage.setItem('creatures_auth_token', data.token);
      onSuccess(data.user, data.token);
      onClose();
      setUsername('');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Не удалось выполнить запрос');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            {mode === 'login' ? <LogIn className="w-5 h-5 text-indigo-400" /> : <UserPlus className="w-5 h-5 text-emerald-400" />}
            <h2 className="text-lg font-semibold text-slate-100">
              {mode === 'login' ? 'Вход в аккаунт' : 'Регистрация аккаунта'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 p-1">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              mode === 'login' ? 'bg-indigo-600/90 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(null); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              mode === 'register' ? 'bg-emerald-600/90 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Регистрация
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Имя пользователя (Логин)</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Пример: creature_master"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Пароль</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                mode === 'login'
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
              } disabled:opacity-50`}
            >
              {loading ? (
                'Обработка...'
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" /> Войти в аккаунт
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> Создать аккаунт
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-center text-slate-500 mt-2">
            {mode === 'login' ? 'Все созданные вами чудики сохраняются в вашей базе данных' : 'После регистрации ваша коллекция чудиков будет привязана к аккаунту'}
          </p>
        </form>
      </div>
    </div>
  );
};
