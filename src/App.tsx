import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronUp, ChevronDown, Wifi, WifiOff } from 'lucide-react';
import { Creature, CreatureElement, Food, GridTheme, SimulationStats, PendingPlacement, CreatureLogEntry, SavedPreset, User } from './types';
import { createCreature, calculatePhysicsForces, determineCreatureHeadAngle, DEFAULT_PRESETS, isInsideBase, getBaseBounds, updateElementPrices } from './utils/creatures';
import { soundFx } from './utils/audio';
import { gameWs, LeaderboardEntry, ServerStats, WSChatMessage } from './utils/websocket';
import { GridCanvas } from './components/GridCanvas';
import { Controls } from './components/Controls';
import { StatsPanel } from './components/StatsPanel';
import { CreatureEditor } from './components/CreatureEditor';
import { AnatomyLegendModal } from './components/AnatomyLegendModal';
import { CreaturesLogModal } from './components/CreaturesLogModal';
import { LeaderboardOverlay } from './components/LeaderboardOverlay';
import { MultiplayerChat } from './components/MultiplayerChat';
import { ServerLogsModal } from './components/ServerLogsModal';
import { AuthModal } from './components/AuthModal';
import { UserCreaturesModal } from './components/UserCreaturesModal';
import { AdminPanel } from './components/AdminPanel';

export default function App() {
  // Simulation State
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const [autoFood, setAutoFood] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [gridTheme, setGridTheme] = useState<GridTheme>('notebook');
  const [showNodes, setShowNodes] = useState<boolean>(true);
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>('c-1');
  const [editingCreatureId, setEditingCreatureId] = useState<string | null>(null);
  const [focusTimestamp, setFocusTimestamp] = useState<number>(0);
  const [isHeaderVisible, setIsHeaderVisible] = useState<boolean>(true);

  // Multiplayer State from Go Server
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [yourCreatureId, setYourCreatureId] = useState<string | null>(null);
  const yourCreatureIdRef = useRef<string | null>(null);
  yourCreatureIdRef.current = yourCreatureId;
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [chatMessages, setChatMessages] = useState<WSChatMessage[]>([]);
  const [pingMs, setPingMs] = useState<number>(0);
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('creatures_player_name') || 'Чудик-Игрок';
  });
  const [playerColor, setPlayerColor] = useState<string>('#6366f1');

  // Placement Mode State
  const [pendingPlacement, setPendingPlacement] = useState<PendingPlacement | null>(null);

  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isAnatomyOpen, setIsAnatomyOpen] = useState<boolean>(false);
  const [isLogsOpen, setIsLogsOpen] = useState<boolean>(false);
  const [isServerLogsOpen, setIsServerLogsOpen] = useState<boolean>(false);
  const [serverErrorCount, setServerErrorCount] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // User Auth & DB Collection State
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('creatures_auth_token'));
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isUserCreaturesOpen, setIsUserCreaturesOpen] = useState<boolean>(false);
  const [controlledCreatureId, setControlledCreatureId] = useState<string | null>(null);

  // Economy Unified Food State (for sprint & base upgrades)
  const [localFood, setLocalFood] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('creatures_food') || localStorage.getItem('creatures_bank_food');
      if (saved) return parseInt(saved, 10);
    } catch (e) {
      console.error(e);
    }
    return 0;
  });

  useEffect(() => {
    try {
      localStorage.setItem('creatures_food', localFood.toString());
      localStorage.setItem('creatures_bank_food', localFood.toString());
    } catch (e) {
      console.error(e);
    }
  }, [localFood]);

  const handleSpendFood = useCallback(async (amount: number): Promise<boolean> => {
    if (amount <= 0) return true;
    if (authToken) {
      try {
        const res = await fetch('/api/user/food/spend', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ amount }),
        });
        const data = await res.json();
        if (res.ok && data.status === 'ok') {
          const balance = data.food ?? data.bankFood ?? 0;
          setLocalFood(balance);
          if (authUser) {
            setAuthUser((prev) => prev ? { ...prev, food: balance, bankFood: balance } : null);
          }
          gameWs.send({ type: 'spend_bank_food', bankFoodAmount: amount });
          return true;
        }
      } catch (e) {
        console.error('Error spending food on server:', e);
      }
    }

    setLocalFood((prev) => Math.max(0, prev - amount));
    gameWs.send({ type: 'spend_bank_food', bankFoodAmount: amount });
    return true;
  }, [authToken, authUser]);

  const handleDepositFood = useCallback(async (amount: number): Promise<boolean> => {
    if (amount <= 0) return true;
    if (authToken) {
      try {
        const res = await fetch('/api/user/food/deposit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ amount }),
        });
        const data = await res.json();
        if (res.ok && data.status === 'ok') {
          const balance = data.food ?? data.bankFood ?? 0;
          setLocalFood(balance);
          if (authUser) {
            setAuthUser((prev) => prev ? { ...prev, food: balance, bankFood: balance } : null);
          }
          gameWs.send({ type: 'deposit_bank_food', bankFoodAmount: amount });
          return true;
        }
      } catch (e) {
        console.error('Error depositing food on server:', e);
      }
    }

    setLocalFood((prev) => prev + amount);
    gameWs.send({ type: 'deposit_bank_food', bankFoodAmount: amount });
    return true;
  }, [authToken, authUser]);

  // Validate token on mount
  useEffect(() => {
    if (authToken) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'ok' && data.user) {
            setAuthUser(data.user);
            const foodVal = data.user.food ?? data.user.bankFood;
            if (typeof foodVal === 'number') {
              setLocalFood(foodVal);
            }
          } else {
            localStorage.removeItem('creatures_auth_token');
            setAuthToken(null);
            setAuthUser(null);
          }
        })
        .catch(() => {
          // backend temporary offline or network error
        });
    }
  }, [authToken]);

  // Fetch user creatures from DB when logged in and merge into savedPresets
  const fetchUserDbCreatures = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/user/creatures', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status === 'ok' && Array.isArray(data.creatures)) {
        const dbPresets: SavedPreset[] = data.creatures.map((c: any) => ({
          id: c.id,
          name: c.name,
          description: `Сохранено в БД (${c.created_at})`,
          color: c.color,
          createdAt: c.created_at || new Date().toLocaleDateString('ru-RU'),
          elements: c.elements,
          isDb: true,
          userId: c.user_id,
        }));

        setSavedPresets((prev) => {
          const nonDb = prev.filter((p) => !p.isDb);
          return [...dbPresets, ...nonDb];
        });
      }
    } catch (e) {
      console.error('Error loading user creatures from DB:', e);
    }
  }, []);

  useEffect(() => {
    if (authToken) {
      fetchUserDbCreatures(authToken);
    } else {
      setSavedPresets((prev) => prev.filter((p) => !p.isDb));
    }
  }, [authToken, fetchUserDbCreatures]);

  // Load world rules & economy prices on mount
  useEffect(() => {
    fetch('/api/rules')
      .then((res) => res.json())
      .then((cfg) => {
        if (cfg) {
          updateElementPrices(cfg.economy?.elementPrices, cfg.world?.unlimitedElements);
        }
      })
      .catch(() => {});
  }, []);

  const handleAuthSuccess = (user: { id: string; username: string }, token: string) => {
    setAuthUser(user);
    setAuthToken(token);
    setToastMessage(`Добро пожаловать, ${user.username}!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem('creatures_auth_token');
    setAuthToken(null);
    setAuthUser(null);
    setToastMessage('Вы вышли из аккаунта');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSaveToDB = async (name: string, elements: CreatureElement[], color: string) => {
    if (!authToken) {
      setIsAuthOpen(true);
      return;
    }
    try {
      const response = await fetch('/api/user/creatures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name, color, elements }),
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Ошибка сохранения');
      }
      soundFx.playEvolve();
      setToastMessage(`Чудик "${name}" сохранен в вашей базе данных!`);
      setTimeout(() => setToastMessage(null), 3000);
      if (authToken) {
        fetchUserDbCreatures(authToken);
      }
    } catch (err: any) {
      alert(err.message || 'Не удалось сохранить чудика в БД');
    }
  };

  // Logger & Saved Presets State
  const [logEntries, setLogEntries] = useState<CreatureLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('creatures_log_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: 'log-1',
        timestamp: new Date().toLocaleString('ru-RU'),
        creatureId: 'c-1',
        name: 'Чудик-Маятник',
        color: '#6366f1',
        action: 'создан',
        initialX: 0,
        initialY: 0,
        initialAngleDeg: 0,
        elementCount: 9,
        leftMass: 3,
        rightMass: 3,
        totalMass: 6,
        randomMusclesInfo: 'Стандартные физические мышцы',
        elements: DEFAULT_PRESETS[0].elements,
      },
    ];
  });

  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(() => {
    try {
      const saved = localStorage.getItem('creatures_saved_presets');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Save log entries to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('creatures_log_history', JSON.stringify(logEntries));
    } catch (e) {
      console.error(e);
    }
  }, [logEntries]);

  // Save custom presets to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('creatures_saved_presets', JSON.stringify(savedPresets));
    } catch (e) {
      console.error(e);
    }
  }, [savedPresets]);

  // Helper to append a record to the log
  const addLogEntry = useCallback((
    creatureId: string,
    name: string,
    color: string,
    action: 'создан' | 'размещен' | 'изменен' | 'сохранен' | 'пресет',
    x: number,
    y: number,
    angleDeg: number,
    elements: CreatureElement[]
  ) => {
    const forces = calculatePhysicsForces(elements, 0);
    const randomMuscles = elements.filter((e) => e.type.startsWith('muscle-random'));
    let randomInfo = '';
    if (randomMuscles.length > 0) {
      const chances = randomMuscles.map((rm) => `${rm.randomChance || 10}%`).join(', ');
      randomInfo = `Случайных мышц: ${randomMuscles.length} (шансы: ${chances})`;
    } else {
      randomInfo = 'Стандартные физические мышцы';
    }

    const newEntry: CreatureLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleString('ru-RU'),
      creatureId,
      name,
      color,
      action,
      initialX: x,
      initialY: y,
      initialAngleDeg: angleDeg,
      elementCount: elements.length,
      leftMass: forces.leftMass,
      rightMass: forces.rightMass,
      totalMass: forces.totalMass,
      randomMusclesInfo: randomInfo,
      elements: JSON.parse(JSON.stringify(elements)),
    };

    setLogEntries((prev) => [newEntry, ...prev]);
  }, []);

  // Stats
  const [worldRadius, setWorldRadius] = useState<number>(50);
  const [stats, setStats] = useState<SimulationStats>({
    foodEatenTotal: 0,
    creaturesCreated: 2,
    currentStep: 0,
  });

  // Main Creatures & Foods state synchronized with Go Backend
  const [creatures, setCreatures] = useState<Creature[]>(() => [
    createCreature('c-1', 'Чудик-Маятник', 40, 40, 0, '#6366f1'),
    createCreature('c-2', 'Асимметричный Вращатель', 44, 42, 1, '#f43f5e'),
  ]);

  const [foods, setFoods] = useState<Food[]>(() => [
    { id: 'f-1', x: 38, y: 36, value: 10, type: 'berry', spawnTime: Date.now() },
    { id: 'f-2', x: 42, y: 35, value: 10, type: 'berry', spawnTime: Date.now() },
    { id: 'f-3', x: 35, y: 40, value: 25, type: 'golden', spawnTime: Date.now() },
  ]);

  // Connect Go Server WebSockets
  useEffect(() => {
    gameWs.connect(playerName, playerColor, DEFAULT_PRESETS[0].elements, 0);

    const unsubscribe = gameWs.subscribe((msg) => {
      if (msg.type === 'init') {
        setYourCreatureId(msg.yourId);
        yourCreatureIdRef.current = msg.yourId;
        setSelectedCreatureId(msg.yourId);
        setIsConnected(true);
        if (msg.config) {
          updateElementPrices(msg.config.economy?.elementPrices, msg.config.world?.unlimitedElements);
        }
      } else if (msg.type === 'config_updated') {
        if (msg.config) {
          updateElementPrices(msg.config.economy?.elementPrices, msg.config.world?.unlimitedElements);
        }
      } else if (msg.type === 'state') {
        if (msg.worldRadius) {
          setWorldRadius(msg.worldRadius);
        }
        if (msg.creatures) {
          const myId = yourCreatureIdRef.current;
          if (myId) {
            const me = msg.creatures.find((c: any) => c.id === myId);
            if (me) {
              const currentFoodVal = typeof me.foodEaten === 'number' ? me.foodEaten : (me.bankFood ?? 0);
              setLocalFood(currentFoodVal);
            }
          }
          setCreatures((prev) => {
            const incomingMap = new Map<string, any>(msg.creatures.map((c: any) => [c.id, c]));
            const prevMap = new Map<string, Creature>(prev.map((c) => [c.id, c]));

            // Update existing creatures in their exact existing order
            const updated: Creature[] = prev
              .filter((c) => incomingMap.has(c.id))
              .map((c) => {
                const incoming = incomingMap.get(c.id)!;
                return {
                  ...incoming,
                  moveProgress: 1,
                  prevX: c.x,
                  prevY: c.y,
                  prevAngleDeg: c.angleDeg,
                };
              });

            // Append newly spawned creatures at the end
            for (const inc of msg.creatures) {
              if (!prevMap.has(inc.id)) {
                updated.push({
                  ...inc,
                  moveProgress: 1,
                  prevX: inc.x,
                  prevY: inc.y,
                  prevAngleDeg: inc.angleDeg,
                });
              }
            }

            return updated;
          });
        }
        if (msg.foods) {
          setFoods(msg.foods);
        }
        if (msg.leaderboard) {
          setLeaderboard(msg.leaderboard);
        }
        if (msg.stats) {
          setServerStats(msg.stats);
          setStats((s) => ({
            ...s,
            currentStep: msg.stats.step,
          }));
        }
      } else if (msg.type === 'chat') {
        setChatMessages((prev) => [...prev.slice(-30), msg]);
      } else if (msg.type === 'kicked') {
        alert(`Вас кикнул администратор! Причина: ${msg.kickedReason || 'Кикнут'}`);
        gameWs.disconnect();
        setIsConnected(false);
      }
    });

    const pingTimer = setInterval(() => {
      setPingMs(gameWs.currentPingMs);
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(pingTimer);
      gameWs.disconnect();
    };
  }, [playerName, playerColor]);

  // State for holding Spacebar for 1.6x boost / dash
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  // State for Neutral / Brake mode (N key toggle)
  const [isBraking, setIsBraking] = useState<boolean>(false);

  const handleToggleBrake = useCallback(() => {
    setIsBraking((prev) => {
      const next = !prev;
      soundFx.playFlex();
      setToastMessage(
        next
          ? '🛑 Тормоз (Нейтраль) включен [N] — чудик замер'
          : '▶️ Тормоз отключен [N] — движение возобновлено'
      );
      setTimeout(() => setToastMessage(null), 2500);

      if (isConnected) {
        const targetId = controlledCreatureId || yourCreatureId || selectedCreatureId || creatures[0]?.id;
        if (targetId) {
          const cr = creatures.find((cur) => cur.id === targetId);
          if (cr) {
            if (controlledCreatureId) {
              gameWs.sendAdminControlInput(
                controlledCreatureId,
                cr.targetAngleDeg ?? cr.angleDeg,
                cr.x,
                cr.y,
                false,
                false,
                next
              );
            } else {
              gameWs.sendInput(
                cr.targetAngleDeg ?? cr.angleDeg,
                cr.x,
                cr.y,
                false,
                false,
                next
              );
            }
          }
        }
      }
      return next;
    });
  }, [isConnected, controlledCreatureId, yourCreatureId, selectedCreatureId, creatures]);

  // Base Exit Check: If creature leaves the base while editor is open, close editor immediately without saving
  useEffect(() => {
    if (!isEditorOpen || !editingCreatureId) return;

    const currentEditing = (creatures || []).find((c) => c.id === editingCreatureId);
    if (!currentEditing) {
      setIsEditorOpen(false);
      setEditingCreatureId(null);
      setToastMessage('⚠️ Чудик погиб или удален! Редактор закрыт.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    const inBase = currentEditing.inBase || isInsideBase(currentEditing.x, currentEditing.y, worldRadius);
    if (!inBase) {
      setIsEditorOpen(false);
      setEditingCreatureId(null);
      soundFx.playFlex?.();
      setToastMessage('⚠️ Чудик покинул Базу! Редактирование прервано без сохранения.');
      setTimeout(() => setToastMessage(null), 4000);
    }
  }, [creatures, isEditorOpen, editingCreatureId, worldRadius]);

  // Synchronize Dash input with Go Server whenever Space is held/released
  useEffect(() => {
    if (!isConnected) return;
    const targetId = controlledCreatureId || yourCreatureId || selectedCreatureId || creatures[0]?.id;
    if (!targetId) return;

    const c = creatures.find((cr) => cr.id === targetId);
    const hasFood = (c?.foodEaten ?? 0) > 0;
    const effectiveDashing = isSpacePressed && hasFood;

    // If space was pressed but food dropped to 0, automatically clear space state
    if (isSpacePressed && !hasFood) {
      setIsSpacePressed(false);
      setToastMessage('Еда закончилась! Ускорение отключено.');
      setTimeout(() => setToastMessage(null), 2500);
    }

    const sendDashState = (dashing: boolean) => {
      const cr = creatures.find((cur) => cur.id === targetId);
      if (!cr) return;
      const canDash = (cr.foodEaten ?? 0) > 0;
      const reallyDashing = dashing && canDash;
      if (controlledCreatureId) {
        gameWs.sendAdminControlInput(controlledCreatureId, cr.targetAngleDeg ?? cr.angleDeg, cr.x, cr.y, false, reallyDashing);
      } else {
        gameWs.sendInput(cr.targetAngleDeg ?? cr.angleDeg, cr.x, cr.y, false, reallyDashing);
      }
    };

    sendDashState(effectiveDashing);

    if (effectiveDashing) {
      const timer = setInterval(() => {
        sendDashState(true);
      }, 50);
      return () => clearInterval(timer);
    }
  }, [isSpacePressed, isConnected, yourCreatureId, controlledCreatureId, selectedCreatureId, creatures]);

  // Local physics simulation fallback when disconnected from server
  useEffect(() => {
    if (isConnected) return;
    if (!isRunning) return;

    const intervalMs = Math.max(20, Math.round(50 / speed));
    const dt = intervalMs / 1000.0;
    const foodCostPerSec = 2.0;

    const timer = setInterval(() => {
      setCreatures((prevCreatures) => {
        const activeId = controlledCreatureId || yourCreatureId || selectedCreatureId || prevCreatures[0]?.id;
        return prevCreatures.map((c) => {
          const isThisBraking = ((c.id === activeId && isBraking) || Boolean((c as any).isBraking));
          if (isThisBraking) {
            return {
              ...c,
              state: 'braking',
              isBraking: true,
              prevX: c.x,
              prevY: c.y,
              prevAngleDeg: c.angleDeg,
            } as any;
          }

          let foodEaten = c.foodEaten || 0;
          const isThisDashing = isSpacePressed && c.id === activeId && foodEaten > 0;
          let nextFoodAccum = (c as any).dashFoodAccum || 0;

          if (isThisDashing && foodEaten > 0) {
            nextFoodAccum += foodCostPerSec * dt;
            if (nextFoodAccum >= 1.0) {
              const consumed = Math.floor(nextFoodAccum);
              foodEaten = Math.max(0, foodEaten - consumed);
              nextFoodAccum -= consumed;
              if (foodEaten <= 0) {
                foodEaten = 0;
                nextFoodAccum = 0;
              }
            }
          } else {
            nextFoodAccum = 0;
          }

          const effectiveDashing = isThisDashing && foodEaten > 0;
          const nextMuscleStep = (c.muscleStep || 0) + 1;
          const rawForces = calculatePhysicsForces(c.elements, nextMuscleStep);
          const dashMultiplier = effectiveDashing ? 1.6 : 1.0;
          const forces = {
            ...rawForces,
            forwardSpeed: rawForces.forwardSpeed * dashMultiplier,
          };

          let targetAngle = c.targetAngleDeg ?? c.angleDeg;
          if (Math.abs(forces.netRotationDeg) > 0.001) {
            targetAngle = (targetAngle + forces.netRotationDeg + 360) % 360;
          }

          let angleDiff = targetAngle - c.angleDeg;
          while (angleDiff > 180) angleDiff -= 360;
          while (angleDiff < -180) angleDiff += 360;

          const turnRate = Math.max(2.0, Math.min(15.0, 5.0 + Math.abs(forces.netRotationDeg) * 0.15));
          let nextAngle = c.angleDeg;
          if (Math.abs(angleDiff) > turnRate) {
            nextAngle += angleDiff > 0 ? turnRate : -turnRate;
          } else {
            nextAngle = targetAngle;
          }
          nextAngle = (nextAngle + 360) % 360;

          const rad = (nextAngle * Math.PI) / 180;
          const dx = Math.cos(rad);
          const dy = Math.sin(rad);
          const spd = (forces.forwardSpeed || 0.08);

          let nextX = c.x + dx * spd;
          let nextY = c.y + dy * spd;

          const halfW = worldRadius;
          const fullW = worldRadius * 2;
          if (nextX > halfW) nextX -= fullW;
          if (nextX < -halfW) nextX += fullW;
          if (nextY > halfW) nextY -= fullW;
          if (nextY < -halfW) nextY += fullW;

          // One-way base top wall: permeable from above, impermeable from below on base side
          const baseBounds = getBaseBounds(halfW);
          if (nextX >= baseBounds.minX - 0.5 && nextX <= baseBounds.maxX + 0.5) {
            if (c.y >= baseBounds.minY && nextY < baseBounds.minY) {
              nextY = baseBounds.minY;
            }
          }

          return {
            ...c,
            x: nextX,
            y: nextY,
            angleDeg: nextAngle,
            targetAngleDeg: targetAngle,
            muscleStep: nextMuscleStep,
            state: effectiveDashing ? 'dashing' : 'moving',
            isDashing: effectiveDashing,
            isBraking: false,
            foodEaten,
            dashFoodAccum: nextFoodAccum,
            forces,
            prevX: c.x,
            prevY: c.y,
            prevAngleDeg: c.angleDeg,
          } as any;
        });
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isConnected, isRunning, speed, worldRadius, isSpacePressed, isBraking, controlledCreatureId, yourCreatureId, selectedCreatureId]);

  // Handle Steering Keyboard Controls (A/D / Arrows Left/Right, Space for Boost, N for Neutral/Brake)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      // Neutral / Brake key (N) toggle
      if (e.code === 'KeyN' || e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') {
        e.preventDefault();
        if (!e.repeat) {
          handleToggleBrake();
        }
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (!e.repeat) {
          const targetId = controlledCreatureId || yourCreatureId || selectedCreatureId || creatures[0]?.id;
          const currentCreature = creatures.find((cr) => cr.id === targetId);
          const hasFood = (currentCreature?.foodEaten ?? 0) > 0;
          if (hasFood) {
            setIsSpacePressed(true);
          } else {
            setIsSpacePressed(false);
            setToastMessage('Нельзя ускоряться: запас еды равен 0! Соберите еду.');
            setTimeout(() => setToastMessage(null), 2500);
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        if (controlledCreatureId) {
          setControlledCreatureId(null);
        }
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф') {
        e.preventDefault();
        handleTurnPlayer('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') {
        e.preventDefault();
        handleTurnPlayer('right');
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц') {
        e.preventDefault();
        handleMovePlayerForward();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        setIsSpacePressed(false);
      }
    };

    const handleBlur = () => {
      setIsSpacePressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [yourCreatureId, creatures, controlledCreatureId, isSpacePressed, isBraking, handleToggleBrake]);

  // Turn Player Creature
  const handleTurnPlayer = (dir: 'left' | 'right') => {
    if (controlledCreatureId) {
      soundFx.playTurn();
      setCreatures((prev) =>
        prev.map((c) => {
          if (c.id === controlledCreatureId) {
            const delta = dir === 'left' ? -10 : 10;
            const nextAngle = (c.angleDeg + delta + 360) % 360;
            const canDash = (c.foodEaten || 0) > 0;
            gameWs.sendAdminControlInput(controlledCreatureId, nextAngle, c.x, c.y, true, isSpacePressed && canDash, isBraking);
            return {
              ...c,
              targetAngleDeg: nextAngle,
              angleDeg: nextAngle,
              muscleStep: c.muscleStep + 1,
            };
          }
          return c;
        })
      );
      return;
    }

    const targetId = yourCreatureId || selectedCreatureId || creatures[0]?.id;
    if (!targetId) return;

    soundFx.playTurn();
    setCreatures((prev) =>
      prev.map((c) => {
        if (c.id === targetId) {
          const delta = dir === 'left' ? -10 : 10;
          const nextAngle = (c.angleDeg + delta + 360) % 360;
          const canDash = (c.foodEaten || 0) > 0;
          gameWs.sendInput(nextAngle, c.x, c.y, true, isSpacePressed && canDash, isBraking);
          return {
            ...c,
            targetAngleDeg: nextAngle,
            angleDeg: nextAngle,
            muscleStep: c.muscleStep + 1,
          };
        }
        return c;
      })
    );
  };

  // Move Player Forward
  const handleMovePlayerForward = () => {
    if (controlledCreatureId) {
      soundFx.playFlex();
      setCreatures((prev) =>
        prev.map((c) => {
          if (c.id === controlledCreatureId) {
            const rad = (c.angleDeg * Math.PI) / 180;
            const step = c.forces?.forwardSpeed || 0.25;
            const nx = c.x + Math.cos(rad) * step;
            const ny = c.y + Math.sin(rad) * step;
            const canDash = (c.foodEaten || 0) > 0;
            gameWs.sendAdminControlInput(controlledCreatureId, c.angleDeg, nx, ny, true, isSpacePressed && canDash, isBraking);
            return {
              ...c,
              x: nx,
              y: ny,
              muscleStep: c.muscleStep + 1,
            };
          }
          return c;
        })
      );
      return;
    }

    const targetId = yourCreatureId || selectedCreatureId || creatures[0]?.id;
    if (!targetId) return;

    soundFx.playFlex();
    setCreatures((prev) =>
      prev.map((c) => {
        if (c.id === targetId) {
          const rad = (c.angleDeg * Math.PI) / 180;
          const step = c.forces?.forwardSpeed || 0.25;
          const nx = c.x + Math.cos(rad) * step;
          const ny = c.y + Math.sin(rad) * step;
          const canDash = (c.foodEaten || 0) > 0;
          gameWs.sendInput(c.angleDeg, nx, ny, true, isSpacePressed && canDash, isBraking);
          return {
            ...c,
            x: nx,
            y: ny,
            muscleStep: c.muscleStep + 1,
          };
        }
        return c;
      })
    );
  };

  // Toggle Sound
  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      soundFx.enabled = !prev;
      return !prev;
    });
  };

  // Add Food at specific node
  const addFoodAt = useCallback((x: number, y: number, type: 'berry' | 'super' | 'golden' = 'berry') => {
    soundFx.playSpawnFood();
    gameWs.sendSpawnFood(x, y, type);
  }, []);

  // Add random food
  const handleAddRandomFood = useCallback(() => {
    const rx = Math.floor(Math.random() * 40) - 20;
    const ry = Math.floor(Math.random() * 40) - 20;
    const types: ('berry' | 'super' | 'golden')[] = ['berry', 'berry', 'super', 'golden'];
    const chosenType = types[Math.floor(Math.random() * types.length)];
    addFoodAt(rx, ry, chosenType);
  }, [addFoodAt]);

  // Click on Canvas Grid Node
  const handleNodeClick = (x: number, y: number, isRightClick: boolean) => {
    if (isRightClick) {
      addFoodAt(x, y, 'golden');
    } else {
      addFoodAt(x, y, 'berry');
    }
  };

  // Select Creature & Focus Camera on it
  const handleSelectCreature = (id: string | null) => {
    const validId = typeof id === 'string' ? id : null;
    setSelectedCreatureId(validId);
    if (validId) {
      setFocusTimestamp(Date.now());
    }
  };

  // Open Editor for Creating NEW Creature
  const handleOpenNewEditor = () => {
    setEditingCreatureId(null);
    setIsEditorOpen(true);
  };

  // Open Editor for Editing EXISTING Selected Creature (Allowed ONLY on Base)
  const handleEditCreature = (id?: string | unknown) => {
    const targetId = typeof id === 'string' ? id : (typeof selectedCreatureId === 'string' ? selectedCreatureId : yourCreatureId);
    if (!targetId) {
      setToastMessage('Выберите чудика для редактирования!');
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }

    const targetCreature = creatures.find((c) => c.id === targetId);
    if (!targetCreature) return;

    const inBase = targetCreature.inBase || isInsideBase(targetCreature.x, targetCreature.y, worldRadius);
    if (!inBase) {
      soundFx.playFlex?.();
      setToastMessage('⛔ Редактирование чудика доступно только на БАЗЕ! Зайдите в Safe Zone.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    setEditingCreatureId(targetId);
    setSelectedCreatureId(targetId);
    setFocusTimestamp(Date.now());
    setIsEditorOpen(true);
  };

  // Prepare Preset Creature for Interactive Placement
  const handleAddPresetCreature = (presetIndex: number) => {
    soundFx.playEvolve();
    const preset = DEFAULT_PRESETS[presetIndex % DEFAULT_PRESETS.length];
    const initialAngle = determineCreatureHeadAngle(preset.elements);
    setPendingPlacement({
      name: `Чудик #${stats.creaturesCreated + 1}`,
      elements: JSON.parse(JSON.stringify(preset.elements)),
      color: '#6366f1',
      angleDeg: initialAngle,
    });
  };

  // Save Custom Creature from Editor
  const handleSaveCustomCreature = (
    name: string,
    elements: CreatureElement[],
    color: string,
    editingId?: string
  ) => {
    soundFx.playEvolve();
    const initialAngle = determineCreatureHeadAngle(elements);

    setPlayerName(name);
    setPlayerColor(color);
    localStorage.setItem('creatures_player_name', name);

    if (editingId) {
      // Direct in-place update for existing creature on the Base!
      const existing = creatures.find((c) => c.id === editingId);
      const curX = existing ? existing.x : 40;
      const curY = existing ? existing.y : 40;
      const curAngle = existing ? existing.angleDeg : initialAngle;

      gameWs.send({
        type: 'join',
        name,
        color,
        elements,
        targetX: curX,
        targetY: curY,
        targetAngleDeg: curAngle,
      });

      gameWs.send({
        type: 'edit_creature',
        name,
        color,
        elements,
      });

      setCreatures((prev) =>
        prev.map((c) =>
          c.id === editingId
            ? {
                ...c,
                name,
                color,
                elements,
                angleDeg: curAngle,
                targetAngleDeg: curAngle,
                forces: calculatePhysicsForces(elements, c.muscleStep || 0),
              }
            : c
        )
      );

      addLogEntry(
        editingId,
        name,
        color,
        'изменен',
        curX,
        curY,
        curAngle,
        elements
      );

      setToastMessage(`Чудик "${name}" успешно модифицирован на Базе!`);
      setTimeout(() => setToastMessage(null), 3000);
    } else {
      // Put newly created creature in placement mode so player can place it on the grid!
      setPendingPlacement({
        name,
        elements,
        color,
        angleDeg: initialAngle,
      });
    }

    setIsEditorOpen(false);
  };

  // Confirm Placement at Grid Node
  const handlePlaceCreature = (x: number, y: number, angleDeg: number) => {
    if (!pendingPlacement) return;
    soundFx.playEvolve();

    gameWs.send({
      type: 'join',
      name: pendingPlacement.name,
      color: pendingPlacement.color,
      elements: pendingPlacement.elements,
      targetX: x,
      targetY: y,
      targetAngleDeg: angleDeg,
    });

    addLogEntry(
      yourCreatureId || 'new-placed',
      pendingPlacement.name,
      pendingPlacement.color,
      'размещен',
      x,
      y,
      angleDeg,
      pendingPlacement.elements
    );

    setPendingPlacement(null);
  };

  const handleCancelPlacement = () => {
    setPendingPlacement(null);
  };

  const handleChangePlacementAngle = (angleDeg: number) => {
    if (pendingPlacement) {
      setPendingPlacement({
        ...pendingPlacement,
        angleDeg,
      });
    }
  };

  // Save Custom Preset to Presets Drawer
  const handleSaveAsPreset = (preset: SavedPreset) => {
    setSavedPresets((prev) => [preset, ...prev]);
    setToastMessage(`Пресет "${preset.name}" сохранен!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Send Chat Message
  const handleSendChatMessage = (text: string) => {
    const name = playerName || 'Игрок';
    gameWs.sendChatMessage(name, playerColor, text);
  };

  const selectedCreature = (creatures || []).find((c) => c.id === selectedCreatureId);
  const isSelectedInBase = selectedCreature ? Boolean(selectedCreature.inBase || isInsideBase(selectedCreature.x, selectedCreature.y, worldRadius)) : false;

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-slate-950 font-sans text-slate-100 antialiased select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-4 border border-indigo-400/50">
          {toastMessage}
        </div>
      )}

      {/* Main Canvas Viewport */}
      <div className="relative flex-1 w-full h-full">
        <GridCanvas
          creatures={creatures}
          foods={foods}
          selectedCreatureId={selectedCreatureId}
          selectedCreatureName={selectedCreature?.name}
          focusTimestamp={focusTimestamp}
          gridTheme={gridTheme}
          showNodes={showNodes}
          pendingPlacement={pendingPlacement}
          worldRadius={worldRadius}
          isSpacePressed={isSpacePressed}
          isBraking={isBraking}
          onSetSpacePressed={setIsSpacePressed}
          onToggleBrake={handleToggleBrake}
          onNodeClick={handleNodeClick}
          onSelectCreature={handleSelectCreature}
          onPlaceCreature={handlePlaceCreature}
          onCancelPlacement={handleCancelPlacement}
          onChangePlacementAngle={handleChangePlacementAngle}
          onTurnPlayer={handleTurnPlayer}
          onMovePlayerForward={handleMovePlayerForward}
        />

        {/* Slither.io Style Leaderboard Overlay */}
        <LeaderboardOverlay
          leaderboard={leaderboard}
          stats={serverStats}
          yourCreatureId={yourCreatureId}
          pingMs={pingMs}
        />

        {/* Multiplayer Live Chat */}
        <MultiplayerChat
          chatMessages={chatMessages}
          onSendMessage={handleSendChatMessage}
          playerName={playerName}
        />

        {/* Controls Overlay Header */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-4xl w-[92%] transition-all duration-300">
          {isHeaderVisible ? (
            <div className="relative">
              <Controls
                isRunning={isRunning}
                speed={speed}
                autoFood={autoFood}
                soundEnabled={soundEnabled}
                gridTheme={gridTheme}
                showNodes={showNodes}
                selectedCreatureId={selectedCreatureId}
                selectedCreatureName={selectedCreature?.name}
                isCreatureInBase={isSelectedInBase}
                username={authUser?.username}
                token={authToken}
                food={localFood}
                bankFood={localFood}
                isBraking={isBraking}
                onToggleBrake={handleToggleBrake}
                onOpenAuth={() => setIsAuthOpen(true)}
                onOpenUserCreatures={() => setIsUserCreaturesOpen(true)}
                onLogout={handleLogout}
                onToggleRunning={() => setIsRunning((r) => !r)}
                onStep={() => {
                  soundFx.playFlex();
                }}
                onChangeSpeed={setSpeed}
                onToggleAutoFood={() => setAutoFood((a) => !a)}
                onToggleSound={handleToggleSound}
                onChangeTheme={setGridTheme}
                onToggleNodes={() => setShowNodes((n) => !n)}
                onAddFoodRandom={handleAddRandomFood}
                onEditSelectedCreature={handleEditCreature}
                onOpenAnatomy={() => setIsAnatomyOpen(true)}
                onOpenLogs={() => setIsLogsOpen(true)}
                onOpenServerLogs={() => setIsServerLogsOpen(true)}
                serverErrorCount={serverErrorCount}
                onReset={() => {
                  soundFx.playEvolve();
                  setFoods([]);
                  setSelectedCreatureId(null);
                  setToastMessage('Поле очищено!');
                  setTimeout(() => setToastMessage(null), 2500);
                }}
              />
              <button
                onClick={() => setIsHeaderVisible(false)}
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700 text-slate-400 hover:text-slate-200 p-0.5 rounded-full shadow-lg transition cursor-pointer"
                title="Свернуть верхнее меню"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsHeaderVisible(true)}
              className="mx-auto flex items-center gap-2 px-3 py-1 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-full text-2xs text-slate-300 shadow-xl backdrop-blur-md transition cursor-pointer"
            >
              <span>Развернуть настройки</span>
              <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          )}
        </div>

        {/* Statistics & Creatures Panel (Top Left) */}
        <StatsPanel
          creatures={creatures}
          foodCount={foods.length}
          stats={stats}
          selectedCreatureId={selectedCreatureId}
          savedPresets={savedPresets}
          username={authUser?.username}
          token={authToken}
          worldRadius={worldRadius}
          onOpenAuth={() => setIsAuthOpen(true)}
          onSelectCreature={handleSelectCreature}
          onAddPresetCreature={handleAddPresetCreature}
          onRemoveCreature={(id) => {
            setCreatures((prev) => prev.filter((c) => c.id !== id));
            if (selectedCreatureId === id) setSelectedCreatureId(null);
          }}
          onEditCreature={handleEditCreature}
          onEditSavedPreset={(sp) => {
            setIsRunning(false);
            setEditingCreatureId(null);
            setPendingPlacement({
              name: sp.name,
              elements: JSON.parse(JSON.stringify(sp.elements)),
              color: sp.color,
              angleDeg: determineCreatureHeadAngle(sp.elements),
            });
            setIsEditorOpen(true);
          }}
          onSaveCreature={async (id) => {
            const creature = creatures.find((c) => c.id === id);
            if (!creature) return;
            if (authToken) {
              await handleSaveToDB(creature.name, creature.elements, creature.color);
            } else {
              const newPreset: SavedPreset = {
                id: `preset-${Date.now()}`,
                name: creature.name,
                description: `Сохраненный чудик из ${creature.elements.length} элементов`,
                color: creature.color,
                createdAt: new Date().toLocaleDateString('ru-RU'),
                elements: JSON.parse(JSON.stringify(creature.elements)),
                isDb: false,
              };
              handleSaveAsPreset(newPreset);
              setToastMessage('Чудик сохранен локально. Войдите в аккаунт, чтобы сохранять в БД!');
              setTimeout(() => setToastMessage(null), 4000);
            }
          }}
          onOpenLogs={() => setIsLogsOpen(true)}
          onAddSavedPreset={(sp) => {
            soundFx.playEvolve();
            const initialAngle = determineCreatureHeadAngle(sp.elements);
            setPendingPlacement({
              name: sp.name,
              elements: JSON.parse(JSON.stringify(sp.elements)),
              color: sp.color,
              angleDeg: initialAngle,
            });
          }}
          onRemoveSavedPreset={async (id) => {
            const target = savedPresets.find((p) => p.id === id);
            if (target?.isDb && authToken) {
              try {
                await fetch(`/api/user/creatures/${id}`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${authToken}` },
                });
                setToastMessage(`Чудик "${target.name}" удален из базы данных`);
                setTimeout(() => setToastMessage(null), 2500);
              } catch (e) {
                console.error(e);
              }
            }
            setSavedPresets((prev) => prev.filter((p) => p.id !== id));
          }}
        />

        {/* Admin Control Panel */}
        <AdminPanel
          user={authUser}
          token={authToken}
          creatures={creatures}
          stats={serverStats || undefined}
          controlledCreatureId={controlledCreatureId}
          setControlledCreatureId={setControlledCreatureId}
          onSpawnPreset={(preset) => {
            soundFx.playEvolve();
            const angle = determineCreatureHeadAngle(preset.elements);
            setPendingPlacement({
              name: preset.name,
              elements: JSON.parse(JSON.stringify(preset.elements)),
              color: preset.color,
              angleDeg: angle,
            });
            setToastMessage(`Чудик "${preset.name}" готов к размещению админом! Кликните на поле.`);
            setTimeout(() => setToastMessage(null), 3500);
          }}
        />
      </div>

      {/* Creature Editor Modal */}
      {isEditorOpen && (() => {
        const activeEditingCreature = (creatures || []).find((c) => c.id === editingCreatureId) || null;
        const targetCreatureFood = activeEditingCreature ? Math.max(activeEditingCreature.foodEaten ?? 0, activeEditingCreature.bankFood ?? 0) : 0;
        const effectiveFood = activeEditingCreature ? (targetCreatureFood > 0 ? targetCreatureFood : localFood) : localFood;
        return (
          <CreatureEditor
            isOpen={isEditorOpen}
            editingCreature={activeEditingCreature}
            token={authToken}
            food={effectiveFood}
            bankFood={effectiveFood}
            onSpendFood={handleSpendFood}
            onDepositFood={handleDepositFood}
            onSpendBankFood={handleSpendFood}
            onDepositBankFood={handleDepositFood}
            onClose={() => {
              setIsEditorOpen(false);
            }}
            onSpawnCreature={handleSaveCustomCreature}
            onSave={handleSaveCustomCreature}
            onSaveToDB={handleSaveToDB}
          />
        );
      })()}

      {/* Anatomy Legend Modal */}
      {isAnatomyOpen && (
        <AnatomyLegendModal
          isOpen={isAnatomyOpen}
          onClose={() => setIsAnatomyOpen(false)}
        />
      )}

      {/* History Log Modal */}
      {isLogsOpen && (
        <CreaturesLogModal
          isOpen={isLogsOpen}
          onClose={() => setIsLogsOpen(false)}
          logEntries={logEntries}
          savedPresets={savedPresets}
          onClearLogs={() => setLogEntries([])}
          onLoadFromLog={(entry) => {
            setIsLogsOpen(false);
            soundFx.playEvolve();
            const angle = determineCreatureHeadAngle(entry.elements);
            setPendingPlacement({
              name: entry.name,
              elements: JSON.parse(JSON.stringify(entry.elements)),
              color: entry.color,
              angleDeg: angle,
            });
          }}
        />
      )}

      {/* Server Logs & Diagnostics Modal */}
      <ServerLogsModal
        isOpen={isServerLogsOpen}
        onClose={() => setIsServerLogsOpen(false)}
        onErrorCountUpdate={setServerErrorCount}
      />

      {/* Auth Modal (Login / Register) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* User Creatures Collection Modal (Database) */}
      <UserCreaturesModal
        isOpen={isUserCreaturesOpen}
        token={authToken}
        onClose={() => setIsUserCreaturesOpen(false)}
        onLoadCreature={(creature) => {
          setIsUserCreaturesOpen(false);
          soundFx.playEvolve();
          const angle = determineCreatureHeadAngle(creature.elements);
          setPendingPlacement({
            name: creature.name,
            elements: JSON.parse(JSON.stringify(creature.elements)),
            color: creature.color,
            angleDeg: angle,
          });
          setToastMessage(`Выбран чудик "${creature.name}" из базы данных! Кликните на поле для спавна.`);
          setTimeout(() => setToastMessage(null), 3500);
        }}
      />
    </div>
  );
}
