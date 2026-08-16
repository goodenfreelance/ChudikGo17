import React, { useState } from 'react';
import {
  Plus,
  Volume2,
  VolumeX,
  Sparkles,
  RefreshCw,
  HelpCircle,
  Grid,
  Edit3,
  Lock,
  Gamepad2,
  FileText,
  ChevronDown,
  ChevronUp,
  Sliders,
  Terminal,
  User,
  LogIn,
  LogOut,
  Database,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import { GridTheme } from '../types';

interface ControlsProps {
  isRunning?: boolean;
  speed?: number;
  autoFood?: boolean;
  soundEnabled: boolean;
  gridTheme: GridTheme;
  showNodes: boolean;
  selectedCreatureId: string | null;
  selectedCreatureName?: string | null;
  isCreatureInBase?: boolean;
  username?: string | null;
  token?: string | null;
  food?: number;
  bankFood?: number;
  isBraking?: boolean;
  onToggleBrake?: () => void;
  onOpenAuth?: () => void;
  onOpenUserCreatures?: () => void;
  onLogout?: () => void;
  onToggleRunning?: () => void;
  onStep?: () => void;
  onChangeSpeed?: (speed: number) => void;
  onToggleAutoFood?: () => void;
  onToggleSound: () => void;
  onChangeTheme: (theme: GridTheme) => void;
  onToggleNodes: () => void;
  onAddFoodRandom?: () => void;
  onOpenEditor?: () => void;
  onEditSelectedCreature: () => void;
  onOpenAnatomy: () => void;
  onOpenLogs?: () => void;
  onOpenServerLogs?: () => void;
  serverErrorCount?: number;
  onReset: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  soundEnabled,
  gridTheme,
  showNodes,
  selectedCreatureId,
  selectedCreatureName,
  isCreatureInBase = false,
  username,
  token,
  food,
  bankFood = 0,
  isBraking = false,
  onToggleBrake,
  onOpenAuth,
  onOpenUserCreatures,
  onLogout,
  onToggleSound,
  onChangeTheme,
  onToggleNodes,
  onOpenEditor,
  onEditSelectedCreature,
  onOpenAnatomy,
  onOpenLogs,
  onOpenServerLogs,
  serverErrorCount = 0,
  onReset,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const canEdit = Boolean(selectedCreatureId && isCreatureInBase);

  if (isCollapsed) {
    return (
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/90 backdrop-blur-md hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-2xl border border-slate-700/80 shadow-2xl transition cursor-pointer"
          title="Развернуть панель управления"
        >
          <Sliders className="w-4 h-4 text-indigo-400" />
          <span>Панель управления</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center justify-center gap-2 bg-slate-900/85 backdrop-blur-md p-2 rounded-2xl border border-slate-800 shadow-xl shadow-slate-950/50 max-w-[95vw]">
      {/* Editor & Anatomy */}
      <div className="flex items-center gap-1">
        {/* Edit Button (Available ONLY on Base) */}
        <button
          onClick={() => onEditSelectedCreature()}
          disabled={!canEdit}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
            canEdit
              ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400/60 shadow-lg shadow-amber-900/40 cursor-pointer ring-1 ring-amber-400/40 animate-pulse'
              : 'bg-slate-800/40 border-slate-700/30 text-slate-500 cursor-not-allowed opacity-60'
          }`}
          title={
            !selectedCreatureId
              ? 'Выберите чудика для редактирования'
              : !isCreatureInBase
              ? 'Редактирование доступно только на Базе (Safe Zone)! Зайдите на базу.'
              : `Редактировать выбранного чудика (${selectedCreatureName || 'Чудик'}) на Базе`
          }
        >
          {canEdit ? (
            <>
              <Edit3 className="w-4 h-4 text-amber-200" />
              <span>
                {selectedCreatureName
                  ? `Редактировать: ${selectedCreatureName.length > 10 ? selectedCreatureName.slice(0, 10) + '...' : selectedCreatureName}`
                  : 'Редактировать'}
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 ml-0.5" />
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {!selectedCreatureId
                  ? 'Редактировать'
                  : 'Редактировать (только на Базе)'}
              </span>
            </>
          )}
        </button>

        <button
          onClick={onOpenAnatomy}
          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-xl transition"
          title="Анатомия с рисунка"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {onOpenLogs && (
          <button
            onClick={onOpenLogs}
            className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded-xl transition font-semibold text-xs flex items-center gap-1"
            title="Открыть журнал логов созданных чудиков"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden lg:inline">Чудики</span>
          </button>
        )}

        {onOpenServerLogs && (
          <button
            onClick={onOpenServerLogs}
            className="relative p-2 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded-xl transition font-semibold text-xs flex items-center gap-1 border border-emerald-500/20 bg-emerald-500/10"
            title="Диагностика сервера и логирование ошибок"
          >
            <Terminal className="w-4 h-4" />
            <span className="hidden lg:inline">Сервер</span>
            {serverErrorCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full animate-pulse shadow-md">
                {serverErrorCount > 99 ? '99+' : serverErrorCount}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="h-5 w-px bg-slate-800 hidden md:block" />

      {/* Unified Food Counter (for Sprint & Base Upgrades) */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-300 shadow-sm"
        title="Единый счетчик еды: расходуется на ускорение (Space) и на апгрейд чудика на Базе"
      >
        <span className="text-sm leading-none">🍎</span>
        <span>Еда: <strong className="text-emerald-200 font-mono text-sm">{food ?? bankFood}</strong></span>
      </div>

      {/* Brake / Neutral Button (N key) */}
      {onToggleBrake && (
        <button
          onClick={onToggleBrake}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer select-none ${
            isBraking
              ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-950/50 ring-2 ring-rose-300 animate-pulse'
              : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border-slate-700/60'
          }`}
          title={
            isBraking
              ? 'Тормоз (Нейтраль) включен [N] — чудик замер на месте. Нажмите N или кнопку для продолжения движения'
              : 'Включить Тормоз (Нейтраль) [N] — чудик замрет на месте'
          }
        >
          <span>{isBraking ? '🛑' : '⏸️'}</span>
          <span>{isBraking ? 'Тормоз [N] (Стоп)' : 'Нейтраль [N]'}</span>
        </button>
      )}

      <div className="h-5 w-px bg-slate-800 hidden md:block" />

      {/* User Auth & Database Collection */}
      <div className="flex items-center gap-1">
        {token && username ? (
          <>
            <button
              onClick={onOpenUserCreatures}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 rounded-xl transition shadow-sm"
              title="Моя база данных чудиков"
            >
              <Database className="w-3.5 h-3.5" />
              <span>База ({username})</span>
            </button>
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition"
              title="Выйти из аккаунта"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-xl transition"
            title="Войти или зарегистрироваться для сохранения чудиков в БД"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Войти / Входа в БД</span>
          </button>
        )}
      </div>

      <div className="h-5 w-px bg-slate-800 hidden md:block" />

      {/* Theme & Settings */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => {
            if (gridTheme === 'game') onChangeTheme('game-light');
            else if (gridTheme === 'game-light') onChangeTheme('notebook');
            else onChangeTheme('game');
          }}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm ${
            gridTheme === 'game' || gridTheme === 'game-light'
              ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-white ring-2 ring-pink-500/50 shadow-pink-500/25'
              : 'bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300'
          }`}
          title={
            gridTheme === 'game'
              ? 'Переключить на светлый игровой режим'
              : gridTheme === 'game-light'
              ? 'Вернуться в тетрадь'
              : 'Включить яркий игровой режим'
          }
        >
          <Gamepad2 className="w-3.5 h-3.5 text-pink-400" />
          <span>
            {gridTheme === 'game'
              ? 'Игра (Т) 🌙'
              : gridTheme === 'game-light'
              ? 'Игра (С) ☀️'
              : 'Игра'}
          </span>
        </button>

        <select
          value={gridTheme}
          onChange={(e) => onChangeTheme(e.target.value as GridTheme)}
          className="px-2 py-1.5 text-xs bg-slate-800/80 border border-slate-700/60 rounded-xl text-slate-200 focus:outline-none"
        >
          <option value="notebook">Тетрадь 📖</option>
          <option value="game">Игровой темный 🐍🌙</option>
          <option value="game-light">Игровой светлый 🐍☀️</option>
          <option value="blueprint">Чертеж 📐</option>
          <option value="dark">Темный 🌙</option>
        </select>

        <button
          onClick={onToggleNodes}
          className={`p-2 rounded-xl transition ${
            showNodes
              ? 'bg-indigo-900/40 border border-indigo-500/40 text-indigo-300'
              : 'text-slate-500 hover:bg-slate-800'
          }`}
          title="Показывать узлы сетки"
        >
          <Grid className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleSound}
          className={`p-2 rounded-xl transition ${
            soundEnabled
              ? 'text-slate-300'
              : 'text-slate-500 hover:bg-slate-800'
          }`}
          title="Звуковые эффекты"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        <button
          onClick={onReset}
          className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-xl transition"
          title="Сбросить поле"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-slate-800" />

        <button
          onClick={() => setIsCollapsed(true)}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
          title="Скрыть панель управления для обзора поля"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
