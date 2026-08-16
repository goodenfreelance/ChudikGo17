import React, { useState, useEffect, useRef } from 'react';
import { Creature, SimulationStats, SavedPreset } from '../types';
import { DEFAULT_PRESETS, isInsideBase } from '../utils/creatures';
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Activity,
  Utensils,
  Footprints,
  Trash2,
  Crosshair,
  Edit3,
  Lock,
  Shield,
  Save,
  FileText,
  Bookmark,
  Check,
  X,
  Database,
  UserCheck,
  LogIn,
} from 'lucide-react';

interface StatsPanelProps {
  creatures: Creature[];
  foodCount: number;
  stats: SimulationStats;
  selectedCreatureId: string | null;
  savedPresets?: SavedPreset[];
  username?: string | null;
  token?: string | null;
  worldRadius?: number;
  onOpenAuth?: () => void;
  onSelectCreature: (id: string | null) => void;
  onAddPresetCreature: (presetIndex: number) => void;
  onRemoveCreature: (id: string) => void;
  onEditCreature?: (id: string) => void;
  onEditSavedPreset?: (preset: SavedPreset) => void;
  onSaveCreature?: (id: string) => void;
  onOpenLogs?: () => void;
  onAddSavedPreset?: (preset: SavedPreset) => void;
  onRemoveSavedPreset?: (id: string) => void;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  creatures = [],
  foodCount = 0,
  stats,
  selectedCreatureId,
  savedPresets = [],
  username,
  token,
  worldRadius = 50,
  onOpenAuth,
  onSelectCreature,
  onAddPresetCreature,
  onRemoveCreature,
  onEditCreature,
  onEditSavedPreset,
  onSaveCreature,
  onOpenLogs,
  onAddSavedPreset,
  onRemoveSavedPreset,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [presetToDeleteId, setPresetToDeleteId] = useState<string | null>(null);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);

  const selectedCreature = (creatures || []).find((c) => c.id === selectedCreatureId);

  // Stably sort creatures by ID so their position in the list NEVER changes or flickers during simulation ticks
  const stableCreatures = React.useMemo(() => {
    return [...(creatures || [])].sort((a, b) => a.id.localeCompare(b.id));
  }, [creatures]);

  // Automatically expand panel and scroll to selected creature when selectedCreatureId changes
  useEffect(() => {
    if (selectedCreatureId) {
      setIsCollapsed(false);
      const timer = setTimeout(() => {
        selectedItemRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedCreatureId]);

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="absolute top-20 left-4 z-20 flex items-center gap-2 px-3 py-2 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl text-slate-200 hover:bg-slate-800 transition text-xs font-bold cursor-pointer"
        title="Показать статистику и список чудиков"
      >
        <Activity className="w-4 h-4 text-indigo-400" />
        <span className="hidden sm:inline">Статистика</span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </button>
    );
  }

  const dbSavedCount = (savedPresets || []).filter((p) => p.isDb).length;

  return (
    <div className="absolute top-20 left-4 z-20 w-80 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl shadow-slate-950/60 overflow-hidden flex flex-col max-h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase">
            Статистика
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {onOpenLogs && (
            <button
              onClick={onOpenLogs}
              className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition text-2xs flex items-center gap-1 font-semibold"
              title="Открыть файл логов созданных чудиков"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Логи</span>
            </button>
          )}
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
            title="Свернуть статистику"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3 overflow-y-auto space-y-4">
        {/* User Account & Database Sync Banner */}
        <div className="p-2 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2">
          {username ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-950 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1">
                  <span>{username}</span>
                  <span className="text-3xs px-1 py-0.2 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono">
                    БД
                  </span>
                </div>
                <div className="text-3xs text-slate-400">
                  Сохранено в БД: <span className="text-emerald-400 font-bold">{dbSavedCount}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full gap-2">
              <div className="text-3xs text-slate-400">
                <span>Войдите для сохранения в БД</span>
              </div>
              {onOpenAuth && (
                <button
                  onClick={onOpenAuth}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-2xs font-bold flex items-center gap-1 transition shrink-0"
                >
                  <LogIn className="w-3 h-3" />
                  <span>Войти</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Global metrics grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 bg-slate-800/40 border border-slate-700/50 rounded-xl text-center">
            <span className="text-2xs text-slate-500 uppercase tracking-widest block mb-0.5">Шагов</span>
            <span className="text-sm font-bold text-indigo-400 font-mono">
              {stats.currentStep}
            </span>
          </div>

          <div className="p-2 bg-slate-800/40 border border-slate-700/50 rounded-xl text-center">
            <span className="text-2xs text-slate-500 uppercase tracking-widest block mb-0.5">Еда</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {foodCount}
            </span>
          </div>

          <div className="p-2 bg-slate-800/40 border border-slate-700/50 rounded-xl text-center">
            <span className="text-2xs text-slate-500 uppercase tracking-widest block mb-0.5">Съедено</span>
            <span className="text-sm font-bold text-amber-400 font-mono">
              {stats.foodEatenTotal}
            </span>
          </div>
        </div>

        {/* Action: Save Selected Creature */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 space-y-2">
          <button
            onClick={() => selectedCreatureId && onSaveCreature?.(selectedCreatureId)}
            disabled={!selectedCreatureId}
            className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
              selectedCreatureId
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 cursor-pointer ring-1 ring-emerald-400/50'
                : 'bg-slate-800/40 border border-slate-700/30 text-slate-500 cursor-not-allowed opacity-50'
            }`}
            title={
              selectedCreatureId
                ? `Сохранить чудика "${selectedCreature?.name}" в базу данных`
                : 'Выберите чудика из списка ниже, чтобы сделать эту кнопку активной'
            }
          >
            <Save className="w-4 h-4" />
            <span>
              {selectedCreature
                ? `Сохранить «${selectedCreature.name.length > 11 ? selectedCreature.name.slice(0, 11) + '...' : selectedCreature.name}» в БД`
                : 'Сохранить чудика в БД'}
            </span>
          </button>
          {!selectedCreatureId && (
            <p className="text-3xs text-slate-500 text-center">
              💡 Кликните по чудику на поле или в списке, чтобы выбрать его и сфокусировать камеру.
            </p>
          )}
        </div>

        {/* Live Creatures List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs font-bold text-slate-400 uppercase tracking-widest">
              Чудики на поле ({creatures.length})
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {stableCreatures.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500 bg-slate-800/30 rounded-xl border border-dashed border-slate-800">
                Нет чудиков на поле.
              </div>
            ) : (
              stableCreatures.map((c) => {
                const isSelected = c.id === selectedCreatureId;
                const inBase = Boolean(c.inBase || isInsideBase(c.x, c.y, worldRadius));
                return (
                  <div
                    key={c.id}
                    ref={isSelected ? selectedItemRef : null}
                    onClick={() => onSelectCreature(c.id)}
                    className={`p-2.5 rounded-xl border text-xs transition cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-950/40 shadow-md ring-1 ring-indigo-500/50'
                        : 'border-slate-800 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="font-bold text-slate-200 truncate">
                          {c.name}
                        </span>
                        {inBase && (
                          <span className="text-3xs px-1 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 rounded font-semibold shrink-0" title="Находится на Базе (Safe Zone)">
                            База
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCreature(c.id);
                          }}
                          className="text-indigo-400 hover:text-indigo-300 p-1 rounded hover:bg-slate-800 transition"
                          title="Центрировать камеру на этом чудике"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                        </button>
                        {onEditCreature && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCreature(c.id);
                              onEditCreature(c.id);
                            }}
                            className={`p-1 rounded transition ${
                              inBase
                                ? 'text-amber-400 hover:text-amber-300 hover:bg-slate-800'
                                : 'text-slate-600 hover:text-slate-500 opacity-60'
                            }`}
                            title={
                              inBase
                                ? 'Редактировать параметры чудика (на Базе)'
                                : 'Редактирование доступно только на Базе (Safe Zone)! Зайдите на базу.'
                            }
                          >
                            {inBase ? <Edit3 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-slate-500" />}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveCreature(c.id);
                          }}
                          className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition"
                          title="Удалить чудика с поля"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800/60 text-2xs text-slate-300 font-mono">
                      <div className="flex items-center gap-1" title="Масса чудика">
                        <span className="text-indigo-400 font-semibold">M:</span>
                        <span>{c.forces?.totalMass?.toFixed(1) ?? '1.0'}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Скорость движения">
                        <span className="text-emerald-400 font-semibold">V:</span>
                        <span>{c.forces?.forwardSpeed?.toFixed(2) ?? '0.22'}</span>
                      </div>
                      <div className="flex items-center gap-1 justify-end text-amber-300" title="Количество съеденной еды">
                        <Utensils className="w-3 h-3 text-amber-400" />
                        <span>{c.foodEaten || 0}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Saved Presets / Database Collection Section */}
        {savedPresets && savedPresets.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Мои сохраненные ({savedPresets.length})</span>
              </span>
              <span className="text-3xs text-slate-400 font-mono">
                {dbSavedCount > 0 ? `${dbSavedCount} в БД` : 'локально'}
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {savedPresets.map((sp) => (
                <div
                  key={sp.id}
                  className="flex items-center justify-between p-2 rounded-xl border border-emerald-900/40 bg-emerald-950/20 hover:bg-emerald-900/30 text-left transition group gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-white/20"
                      style={{ backgroundColor: sp.color }}
                    />
                    <div className="truncate">
                      <div className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1">
                        <span>{sp.name}</span>
                        {sp.isDb && (
                          <span className="text-3xs px-1 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-500/40">
                            БД
                          </span>
                        )}
                      </div>
                      <div className="text-3xs text-slate-400 font-mono truncate">
                        {sp.elements.length} эл. • {sp.createdAt}
                      </div>
                    </div>
                  </div>

                  {presetToDeleteId === sp.id ? (
                    <div className="flex items-center gap-1 bg-red-950/80 p-1 rounded-lg border border-red-800/80 shrink-0">
                      <span className="text-3xs font-semibold text-red-200 px-1">Удалить?</span>
                      <button
                        onClick={() => {
                          onRemoveSavedPreset?.(sp.id);
                          setPresetToDeleteId(null);
                        }}
                        className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-3xs font-bold rounded transition shadow"
                        title="Да, удалить"
                      >
                        Да
                      </button>
                      <button
                        onClick={() => setPresetToDeleteId(null)}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-3xs font-bold rounded transition"
                        title="Отмена"
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 shrink-0">
                      {onEditSavedPreset && (
                        <button
                          onClick={() => onEditSavedPreset(sp)}
                          className="p-1 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded transition"
                          title="Редактировать в конструкторе"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onAddSavedPreset && (
                        <button
                          onClick={() => onAddSavedPreset(sp)}
                          className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded transition"
                          title="Разместить на поле"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                      {onRemoveSavedPreset && (
                        <button
                          onClick={() => setPresetToDeleteId(sp.id)}
                          className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition"
                          title="Удалить из сохраненных"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

