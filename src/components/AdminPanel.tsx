import React, { useState, useEffect } from 'react';
import {
  Shield,
  Zap,
  Trash2,
  Gamepad2,
  UserX,
  PlusCircle,
  X,
  ChevronDown,
  ChevronUp,
  Sliders,
  RefreshCw,
  CheckCircle2,
  Cpu,
  Database,
  User,
  Sparkles,
  Coins,
} from 'lucide-react';
import { gameWs, ServerStats } from '../utils/websocket';
import { Creature, User as UserType, WorldConfig, SavedPreset } from '../types';
import { DEFAULT_PRESETS, DEFAULT_ECONOMY_CONFIG, updateElementPrices } from '../utils/creatures';

interface AdminPanelProps {
  user: UserType | null;
  token?: string | null;
  creatures: Creature[];
  stats?: ServerStats;
  onSelectTargetCreature?: (id: string | null) => void;
  onSpawnPreset?: (preset: SavedPreset) => void;
  onEditPreset?: (preset: SavedPreset) => void;
  controlledCreatureId: string | null;
  setControlledCreatureId: (id: string | null) => void;
}

const DEFAULT_CONFIG: WorldConfig = {
  world: {
    worldBoundsX: 2000.0,
    worldBoundsY: 2000.0,
    tickRate: 100,
    enableCannibalism: true,
    unlimitedElements: false,
  },
  physics: {
    restitutionCoefficient: 0.5,
    dashMultiplier: 1.6,
    dashFoodCostPerSecond: 1.0,
    dragLinear: 0.01,
    dragAngular: 0.005,
    muscleStiffness: 50.0,
    muscleDamping: 5.0,
    sleepVelocityThreshold: 0.05,
  },
  elementMasses: {
    massHead: 1.0,
    massBone: 1.0,
    massJoint: 0.0,
    massMuscle: 0.0,
    massEye: 0.2,
    massMouth: 0.5,
  },
  economy: DEFAULT_ECONOMY_CONFIG,
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  user,
  token,
  creatures,
  stats,
  onSpawnPreset,
  onEditPreset,
  controlledCreatureId,
  setControlledCreatureId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'control' | 'physics' | 'economy' | 'db_creatures'>('control');
  const [selectedCreatureId, setSelectedCreatureId] = useState<string>('');
  const [currentSpeedMs, setCurrentSpeedMs] = useState<number>(stats?.tickIntervalMs || 10);
  const [spawnName, setSpawnName] = useState<string>('Админ-Чудик');
  const [spawnColor, setSpawnColor] = useState<string>('#ef4444');
  const [spawnPresetIdx, setSpawnPresetIdx] = useState<number>(0);
  const [showSpawnModal, setShowSpawnModal] = useState<boolean>(false);

  // All User Creatures in Database (Admin Access)
  const [dbCreatures, setDbCreatures] = useState<SavedPreset[]>([]);
  const [isLoadingDbCreatures, setIsLoadingDbCreatures] = useState<boolean>(false);
  const [dbSearchQuery, setDbSearchQuery] = useState<string>('');

  // Dynamic Physics & Economy Rules Configuration
  const [worldConfig, setWorldConfig] = useState<WorldConfig>(DEFAULT_CONFIG);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [configSavedToast, setConfigSavedToast] = useState<boolean>(false);

  useEffect(() => {
    if (stats?.tickIntervalMs) {
      setCurrentSpeedMs(stats.tickIntervalMs);
    }
  }, [stats?.tickIntervalMs]);

  useEffect(() => {
    // Fetch initial world rules & economy config from server
    fetch('/api/rules')
      .then((res) => res.json())
      .then((cfg: WorldConfig) => {
        if (cfg && cfg.world && cfg.physics) {
          const merged: WorldConfig = {
            ...cfg,
            economy: cfg.economy || DEFAULT_ECONOMY_CONFIG,
          };
          setWorldConfig(merged);
          if (merged.economy?.elementPrices || merged.world) {
            updateElementPrices(merged.economy?.elementPrices, merged.world?.unlimitedElements);
          }
        }
      })
      .catch(() => {});
  }, []);

  const fetchAllDbCreatures = async () => {
    if (!token) return;
    setIsLoadingDbCreatures(true);
    try {
      const res = await fetch('/api/admin/creatures', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status === 'ok' && Array.isArray(data.creatures)) {
        setDbCreatures(
          data.creatures.map((c: any) => ({
            id: c.id,
            name: c.name,
            description: `Автор: ${c.author_username || 'Неизвестен'}`,
            color: c.color,
            createdAt: c.created_at || new Date().toLocaleDateString('ru-RU'),
            elements: c.elements,
            isDb: true,
            authorUsername: c.author_username,
            userId: c.user_id,
          }))
        );
      }
    } catch (e) {
      console.error('Error fetching admin DB creatures:', e);
    } finally {
      setIsLoadingDbCreatures(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'db_creatures' && user?.isAdmin) {
      fetchAllDbCreatures();
    }
  }, [isOpen, activeTab, user?.isAdmin]);

  if (!user?.isAdmin) return null;

  const controlledCreature = creatures.find((c) => c.id === controlledCreatureId);

  const handleSetSpeed = (ms: number) => {
    setCurrentSpeedMs(ms);
    gameWs.sendAdminSetSpeed(ms);
  };

  const handleDeleteCreature = (id: string) => {
    if (!id) return;
    if (controlledCreatureId === id) {
      setControlledCreatureId(null);
    }
    gameWs.sendAdminDeleteCreature(id);
  };

  const handleControlCreature = (id: string) => {
    if (controlledCreatureId === id) {
      setControlledCreatureId(null);
    } else {
      setControlledCreatureId(id);
    }
  };

  const handleKickPlayer = (playerId: string, name: string) => {
    if (confirm(`Вы уверены, что хотите кикнуть игрока "${name}"?`)) {
      gameWs.sendAdminKickUser(playerId, 'Кикнут администратором joni');
    }
  };

  const handleSpawnCreature = () => {
    const preset = DEFAULT_PRESETS[spawnPresetIdx] || DEFAULT_PRESETS[0];
    const rx = (Math.random() - 0.5) * 10;
    const ry = (Math.random() - 0.5) * 10;
    gameWs.sendAdminSpawnCreature(spawnName, spawnColor, preset.elements, rx, ry);
    setShowSpawnModal(false);
  };

  const handleAdminDeleteDbCreature = async (id: string, name: string) => {
    if (!confirm(`Удалить чудика "${name}" из базы данных навсегда?`)) return;
    try {
      const res = await fetch(`/api/admin/creatures/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDbCreatures((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (e) {
      console.error('Error deleting creature:', e);
    }
  };

  const handleSaveAndHotReloadConfig = async () => {
    setIsSavingConfig(true);
    try {
      // 1. Update local prices in memory immediately
      if (worldConfig.economy?.elementPrices || worldConfig.world) {
        updateElementPrices(worldConfig.economy?.elementPrices, worldConfig.world?.unlimitedElements);
      }

      // 2. Send via WebSocket for instant in-memory hot-reload without latency
      if (gameWs) {
        (gameWs as any).sendAdminUpdateConfig?.(worldConfig);
      }

      // 3. Persist to world_rules.json file via HTTP API (applied across server restarts)
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(worldConfig),
      });

      if (res.ok) {
        setConfigSavedToast(true);
        setTimeout(() => setConfigSavedToast(false), 3000);
      }
    } catch (e) {
      console.error('Error saving world config:', e);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const filteredDbCreatures = dbCreatures.filter(
    (c) =>
      c.name.toLowerCase().includes(dbSearchQuery.toLowerCase()) ||
      (c.authorUsername && c.authorUsername.toLowerCase().includes(dbSearchQuery.toLowerCase()))
  );

  return (
    <>
      {/* Top Admin Active Override Banner */}
      {controlledCreatureId && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[90] bg-gradient-to-r from-red-900/90 to-amber-900/90 border-2 border-amber-400 text-amber-100 px-5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-4 animate-pulse">
          <Gamepad2 className="w-6 h-6 text-amber-300 animate-spin-slow" />
          <div>
            <div className="font-bold text-sm tracking-wide text-amber-200">
              РЕЖИМ ПЕРЕХВАТА УПРАВЛЕНИЯ [АДМИН]
            </div>
            <div className="text-xs text-amber-300/90">
              Чудик: <span className="font-semibold text-white">{controlledCreature?.name || controlledCreatureId}</span> (Управление игрока заблокировано)
            </div>
          </div>
          <button
            onClick={() => setControlledCreatureId(null)}
            className="ml-2 px-3 py-1 bg-amber-500/30 hover:bg-amber-500/50 border border-amber-400/50 text-white rounded-lg text-xs transition font-semibold"
          >
            Отпустить (ESC)
          </button>
        </div>
      )}

      {/* Floating Toggle Button for Admin Panel */}
      <div className="fixed top-4 right-4 z-[80]">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-900/40 border border-amber-300/40 transition transform active:scale-95 text-xs"
        >
          <Shield className="w-4 h-4 text-amber-200" />
          <span>АДМИН ПАНЕЛЬ ({user.username})</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Collapsible Admin Drawer */}
        {isOpen && (
          <div className="mt-2 w-96 bg-slate-900/95 border border-amber-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-xl text-white text-xs space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Shield className="w-4 h-4" />
                <span>Панель Администратора</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="grid grid-cols-4 bg-slate-800/80 p-1 rounded-xl border border-slate-700 gap-1">
              <button
                onClick={() => setActiveTab('control')}
                className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition text-2xs ${
                  activeTab === 'control'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Gamepad2 className="w-3 h-3" />
                <span className="truncate">Управл.</span>
              </button>
              <button
                onClick={() => setActiveTab('db_creatures')}
                className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition text-2xs ${
                  activeTab === 'db_creatures'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Database className="w-3 h-3" />
                <span className="truncate">БД</span>
              </button>
              <button
                onClick={() => setActiveTab('physics')}
                className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition text-2xs ${
                  activeTab === 'physics'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3 h-3" />
                <span className="truncate">Физика</span>
              </button>
              <button
                onClick={() => setActiveTab('economy')}
                className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition text-2xs ${
                  activeTab === 'economy'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Coins className="w-3 h-3 text-amber-950" />
                <span className="truncate">Экономика</span>
              </button>
            </div>

            {activeTab === 'control' && (
              <>
                {/* 1. Server Speed Control */}
                <div className="space-y-2 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-yellow-400" />
                      Скорость расчета (Tick Delay)
                    </span>
                    <span className="font-mono text-amber-300 font-bold">
                      {currentSpeedMs} ms ({Math.round(1000 / Math.max(1, currentSpeedMs))} FPS)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="200"
                    step="5"
                    value={currentSpeedMs}
                    onChange={(e) => handleSetSpeed(Number(e.target.value))}
                    className="w-full accent-amber-500 bg-slate-700 h-1.5 rounded-lg cursor-pointer"
                  />
                  <div className="grid grid-cols-4 gap-1 pt-1">
                    <button
                      onClick={() => handleSetSpeed(10)}
                      className={`py-1 rounded border text-[10px] font-semibold ${
                        currentSpeedMs === 10
                          ? 'bg-amber-600 text-white border-amber-400'
                          : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                      }`}
                    >
                      ⚡100 FPS (10ms)
                    </button>
                    <button
                      onClick={() => handleSetSpeed(16)}
                      className={`py-1 rounded border text-[10px] font-semibold ${
                        currentSpeedMs === 16
                          ? 'bg-amber-600 text-white border-amber-400'
                          : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                      }`}
                    >
                      60 FPS (16ms)
                    </button>
                    <button
                      onClick={() => handleSetSpeed(33)}
                      className={`py-1 rounded border text-[10px] font-semibold ${
                        currentSpeedMs === 33
                          ? 'bg-amber-600 text-white border-amber-400'
                          : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                      }`}
                    >
                      30 FPS (33ms)
                    </button>
                    <button
                      onClick={() => handleSetSpeed(100)}
                      className={`py-1 rounded border text-[10px] font-semibold ${
                        currentSpeedMs === 100
                          ? 'bg-amber-600 text-white border-amber-400'
                          : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                      }`}
                    >
                      10 FPS (100ms)
                    </button>
                  </div>
                </div>

                {/* 2. Control / Delete Creature */}
                <div className="space-y-2.5 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Gamepad2 className="w-3.5 h-3.5 text-indigo-400" />
                    Чудики на карте ({creatures.length})
                  </div>

                  <select
                    value={selectedCreatureId}
                    onChange={(e) => setSelectedCreatureId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">-- Выберите чудика --</option>
                    {creatures.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.isSleeping ? '💤 (Спит)' : ''} {c.isBot ? '(Бот)' : '(Игрок)'} - [{c.id}]
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <button
                      disabled={!selectedCreatureId}
                      onClick={() => handleControlCreature(selectedCreatureId)}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition ${
                        controlledCreatureId === selectedCreatureId
                          ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40'
                      }`}
                    >
                      <Gamepad2 className="w-3.5 h-3.5" />
                      {controlledCreatureId === selectedCreatureId ? 'Отпустить' : 'Перехват'}
                    </button>

                    <button
                      disabled={!selectedCreatureId}
                      onClick={() => handleDeleteCreature(selectedCreatureId)}
                      className="py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg flex items-center justify-center gap-1 transition disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Удалить
                    </button>
                  </div>

                  <button
                    onClick={() => setShowSpawnModal(true)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Добавить Чудика
                  </button>
                </div>

                {/* 3. Player List & Kick */}
                <div className="space-y-2 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <UserX className="w-3.5 h-3.5 text-red-400" />
                    Игроки на сервере
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {creatures.filter((c) => !c.isBot).length === 0 ? (
                      <div className="text-slate-400 italic text-[11px]">Игроков в данный момент нет</div>
                    ) : (
                      creatures
                        .filter((c) => !c.isBot)
                        .map((c) => {
                          const playerId = c.id.startsWith('player-') ? c.id.replace('player-', '') : c.id;
                          return (
                            <div
                              key={c.id}
                              className="flex items-center justify-between bg-slate-900/80 p-2 rounded-lg border border-slate-700/60"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: c.color }}
                                />
                                <span className="font-semibold text-slate-200 truncate">{c.name}</span>
                              </div>
                              <button
                                onClick={() => handleKickPlayer(playerId, c.name)}
                                className="px-2 py-0.5 bg-red-600/80 hover:bg-red-600 text-white font-semibold rounded text-[10px] flex items-center gap-1 transition"
                              >
                                <UserX className="w-3 h-3" />
                                Кик
                              </button>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </>
            )}

            {/* TAB: All User Creatures in DB (Admin Exclusive) */}
            {activeTab === 'db_creatures' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    <span>Все чудики игроков в БД ({dbCreatures.length})</span>
                  </div>
                  <button
                    onClick={fetchAllDbCreatures}
                    disabled={isLoadingDbCreatures}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                    title="Обновить список"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDbCreatures ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Поиск по имени или автору..."
                  value={dbSearchQuery}
                  onChange={(e) => setDbSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {isLoadingDbCreatures ? (
                    <div className="text-center py-6 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
                      <span>Загрузка из базы данных...</span>
                    </div>
                  ) : filteredDbCreatures.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                      {dbSearchQuery ? 'Ничего не найдено' : 'В базе данных пока нет сохраненных чудиков'}
                    </div>
                  ) : (
                    filteredDbCreatures.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 bg-slate-950/70 border border-slate-800 hover:border-amber-500/40 rounded-xl flex items-center justify-between gap-2 transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
                            style={{ backgroundColor: item.color }}
                          />
                          <div className="truncate">
                            <div className="font-bold text-slate-200 truncate flex items-center gap-1.5">
                              <span>{item.name}</span>
                              <span className="text-3xs px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40 font-mono">
                                @{item.authorUsername || 'anon'}
                              </span>
                            </div>
                            <div className="text-3xs text-slate-400 font-mono">
                              {item.elements.length} эл. • {item.createdAt}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {onSpawnPreset && (
                            <button
                              onClick={() => onSpawnPreset(item)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-3xs flex items-center gap-1 transition"
                              title="Разместить на поле"
                            >
                              <PlusCircle className="w-3 h-3" />
                              <span>Спавн</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleAdminDeleteDbCreature(item.id, item.name)}
                            className="p-1 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 transition"
                            title="Удалить из БД"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'physics' && (
              <div className="space-y-3">
                {/* World Configuration */}
                <div className="space-y-2 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    Параметры Мира
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="text-slate-400">Граница мира X:</label>
                      <input
                        type="number"
                        value={worldConfig.world.worldBoundsX}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            world: { ...worldConfig.world, worldBoundsX: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">FPS / Tick Rate:</label>
                      <input
                        type="number"
                        value={worldConfig.world.tickRate}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            world: { ...worldConfig.world, tickRate: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={worldConfig.world.enableCannibalism}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            world: { ...worldConfig.world, enableCannibalism: e.target.checked },
                          })
                        }
                        className="accent-amber-500 rounded"
                      />
                      <span className="text-slate-300 text-[11px]">Включить каннибализм (атака чудиков)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!worldConfig.world.unlimitedElements}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            world: { ...worldConfig.world, unlimitedElements: e.target.checked },
                          })
                        }
                        className="accent-emerald-500 rounded"
                      />
                      <span className="text-emerald-300 font-semibold text-[11px] flex items-center gap-1">
                        <span>⚡ Безлимит (стоимость всех элементов = 0 еды)</span>
                      </span>
                    </label>
                  </div>
                </div>

                {/* Physics Constants */}
                <div className="space-y-2 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Коэффициенты Физики
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="text-slate-400">Упругость (e):</label>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={worldConfig.physics.restitutionCoefficient}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            physics: { ...worldConfig.physics, restitutionCoefficient: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Множитель рывка (x):</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        value={worldConfig.physics.dashMultiplier}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            physics: { ...worldConfig.physics, dashMultiplier: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Расход еды (ед./сек):</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="20"
                        value={worldConfig.physics.dashFoodCostPerSecond ?? 2.0}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            physics: { ...worldConfig.physics, dashFoodCostPerSecond: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Сопротивление (лин.):</label>
                      <input
                        type="number"
                        step="0.005"
                        value={worldConfig.physics.dragLinear}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            physics: { ...worldConfig.physics, dragLinear: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Сопротивление (угл.):</label>
                      <input
                        type="number"
                        step="0.001"
                        value={worldConfig.physics.dragAngular}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            physics: { ...worldConfig.physics, dragAngular: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Жёсткость мышц (k):</label>
                      <input
                        type="number"
                        step="5"
                        value={worldConfig.physics.muscleStiffness}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            physics: { ...worldConfig.physics, muscleStiffness: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Демпфирование (c):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={worldConfig.physics.muscleDamping}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            physics: { ...worldConfig.physics, muscleDamping: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Element Masses */}
                <div className="space-y-2 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="font-semibold text-amber-300">Массы Анатомических Элементов</div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <label className="text-slate-400">Голова:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={worldConfig.elementMasses.massHead}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            elementMasses: { ...worldConfig.elementMasses, massHead: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Ребро:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={worldConfig.elementMasses.massBone}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            elementMasses: { ...worldConfig.elementMasses, massBone: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Сустав:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={worldConfig.elementMasses.massJoint}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            elementMasses: { ...worldConfig.elementMasses, massJoint: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Мышца:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={worldConfig.elementMasses.massMuscle}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            elementMasses: { ...worldConfig.elementMasses, massMuscle: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Глаз:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={worldConfig.elementMasses.massEye}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            elementMasses: { ...worldConfig.elementMasses, massEye: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Рот:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={worldConfig.elementMasses.massMouth}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            elementMasses: { ...worldConfig.elementMasses, massMouth: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Hot Reload Button */}
                <button
                  onClick={handleSaveAndHotReloadConfig}
                  disabled={isSavingConfig}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <RefreshCw className={`w-4 h-4 ${isSavingConfig ? 'animate-spin' : ''}`} />
                  <span>{isSavingConfig ? 'Применение...' : 'Сохранить и Применить в файл'}</span>
                </button>

                {configSavedToast && (
                  <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg text-center flex items-center justify-center gap-1.5 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Правила физики и экономики сохранены в файл!</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Economy Configuration */}
            {activeTab === 'economy' && (
              <div className="space-y-3">
                {/* General Economy Parameters */}
                <div className="space-y-2 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    Базовые параметры экономики
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <label className="text-slate-400">Старт. банк:</label>
                      <input
                        type="number"
                        min="0"
                        value={worldConfig.economy?.starterBankFood ?? 100}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            economy: {
                              ...worldConfig.economy,
                              starterBankFood: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Ягода (еда):</label>
                      <input
                        type="number"
                        min="1"
                        value={worldConfig.economy?.foodBerryValue ?? 1}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            economy: {
                              ...worldConfig.economy,
                              foodBerryValue: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Золотая (еда):</label>
                      <input
                        type="number"
                        min="1"
                        value={worldConfig.economy?.foodGoldenValue ?? 5}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            economy: {
                              ...worldConfig.economy,
                              foodGoldenValue: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Element Prices */}
                <div className="space-y-2 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="font-semibold text-amber-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Цены деталей в конструкторе (еда)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="text-slate-400">Голова (мирная):</label>
                      <input
                        type="number"
                        min="0"
                        value={worldConfig.economy?.elementPrices?.['head'] ?? 50}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            economy: {
                              ...worldConfig.economy,
                              elementPrices: {
                                ...worldConfig.economy?.elementPrices,
                                head: Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Челюсти (хищник):</label>
                      <input
                        type="number"
                        min="0"
                        value={worldConfig.economy?.elementPrices?.['head-jaw'] ?? 180}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            economy: {
                              ...worldConfig.economy,
                              elementPrices: {
                                ...worldConfig.economy?.elementPrices,
                                'head-jaw': Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Прямая мышца L:</label>
                      <input
                        type="number"
                        min="0"
                        value={worldConfig.economy?.elementPrices?.['muscle-left'] ?? 25}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            economy: {
                              ...worldConfig.economy,
                              elementPrices: {
                                ...worldConfig.economy?.elementPrices,
                                'muscle-left': Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Прямая мышца R:</label>
                      <input
                        type="number"
                        min="0"
                        value={worldConfig.economy?.elementPrices?.['muscle-right'] ?? 25}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            economy: {
                              ...worldConfig.economy,
                              elementPrices: {
                                ...worldConfig.economy?.elementPrices,
                                'muscle-right': Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Случайная мышца L:</label>
                      <input
                        type="number"
                        min="0"
                        value={worldConfig.economy?.elementPrices?.['muscle-random-left'] ?? 35}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            economy: {
                              ...worldConfig.economy,
                              elementPrices: {
                                ...worldConfig.economy?.elementPrices,
                                'muscle-random-left': Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Случайная мышца R:</label>
                      <input
                        type="number"
                        min="0"
                        value={worldConfig.economy?.elementPrices?.['muscle-random-right'] ?? 35}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            economy: {
                              ...worldConfig.economy,
                              elementPrices: {
                                ...worldConfig.economy?.elementPrices,
                                'muscle-random-right': Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Шарнир (0):</label>
                      <input
                        type="number"
                        min="0"
                        value={worldConfig.economy?.elementPrices?.['joint'] ?? 10}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            economy: {
                              ...worldConfig.economy,
                              elementPrices: {
                                ...worldConfig.economy?.elementPrices,
                                joint: Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Гориз. ребро (—):</label>
                      <input
                        type="number"
                        min="0"
                        value={worldConfig.economy?.elementPrices?.['edge-h'] ?? 10}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            economy: {
                              ...worldConfig.economy,
                              elementPrices: {
                                ...worldConfig.economy?.elementPrices,
                                'edge-h': Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Верт. ребро (|):</label>
                      <input
                        type="number"
                        min="0"
                        value={worldConfig.economy?.elementPrices?.['edge-v'] ?? 10}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            economy: {
                              ...worldConfig.economy,
                              elementPrices: {
                                ...worldConfig.economy?.elementPrices,
                                'edge-v': Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Диагональ 1 (\):</label>
                      <input
                        type="number"
                        min="0"
                        value={worldConfig.economy?.elementPrices?.['edge-d1'] ?? 10}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            economy: {
                              ...worldConfig.economy,
                              elementPrices: {
                                ...worldConfig.economy?.elementPrices,
                                'edge-d1': Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Диагональ 2 (/):</label>
                      <input
                        type="number"
                        min="0"
                        value={worldConfig.economy?.elementPrices?.['edge-d2'] ?? 10}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            economy: {
                              ...worldConfig.economy,
                              elementPrices: {
                                ...worldConfig.economy?.elementPrices,
                                'edge-d2': Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Глаз:</label>
                      <input
                        type="number"
                        min="0"
                        value={worldConfig.economy?.elementPrices?.['eye'] ?? 10}
                        onChange={(e) =>
                          setWorldConfig({
                            ...worldConfig,
                            economy: {
                              ...worldConfig.economy,
                              elementPrices: {
                                ...worldConfig.economy?.elementPrices,
                                eye: Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Save & Hot Reload Button */}
                <button
                  onClick={handleSaveAndHotReloadConfig}
                  disabled={isSavingConfig}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <RefreshCw className={`w-4 h-4 ${isSavingConfig ? 'animate-spin' : ''}`} />
                  <span>{isSavingConfig ? 'Сохранение...' : 'Сохранить в world_rules.json'}</span>
                </button>

                <div className="text-3xs text-slate-500 text-center">
                  💾 Изменения сохраняются в файл на сервере и загружаются автоматически при перезапуске
                </div>

                {configSavedToast && (
                  <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg text-center flex items-center justify-center gap-1.5 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Настройки экономики сохранены в файл и применены!</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spawn Creature Modal */}
      {showSpawnModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 text-white p-5 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <h3 className="font-bold text-amber-400 flex items-center gap-2">
                <PlusCircle className="w-5 h-5" />
                Создание чудика (Админ)
              </h3>
              <button
                onClick={() => setShowSpawnModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Имя:</label>
                <input
                  type="text"
                  value={spawnName}
                  onChange={(e) => setSpawnName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Цвет:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={spawnColor}
                    onChange={(e) => setSpawnColor(e.target.value)}
                    className="w-10 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <span className="font-mono text-slate-400">{spawnColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Пресет анатомии:</label>
                <select
                  value={spawnPresetIdx}
                  onChange={(e) => setSpawnPresetIdx(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {DEFAULT_PRESETS.map((p, idx) => (
                    <option key={idx} value={idx}>
                      {p.name} ({p.elements.length} элементов)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowSpawnModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleSpawnCreature}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg"
              >
                Спавнить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
