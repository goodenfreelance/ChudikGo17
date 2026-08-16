import React, { useState, useEffect } from 'react';
import { X, Plus, RotateCcw, Sparkles, Scale, Zap, Trash2, ArrowUp, ArrowRight, ArrowDown, ArrowLeft, ZoomIn, ZoomOut, Maximize2, Edit3, Crosshair, AlertTriangle, Coins, ShieldCheck, RefreshCw } from 'lucide-react';
import { Creature, CreatureElement, ElementType } from '../types';
import { calculatePhysicsForces, getCreatureConnectivity, STARTER_PRESET, ELEMENT_PRICES, calculateCreatureCost, calculateElementsPrice, getElementLabel, IS_UNLIMITED_MODE, getElementPrice } from '../utils/creatures';

interface CreatureEditorProps {
  isOpen: boolean;
  editingCreature?: Creature | null;
  token?: string | null;
  food?: number;
  bankFood?: number;
  onSpendFood?: (cost: number) => Promise<boolean> | boolean;
  onDepositFood?: (amount: number) => Promise<boolean> | boolean;
  onSpendBankFood?: (cost: number) => Promise<boolean> | boolean;
  onDepositBankFood?: (amount: number) => Promise<boolean> | boolean;
  onClose: () => void;
  onSpawnCreature?: (name: string, elements: CreatureElement[], color: string, editingCreatureId?: string) => void;
  onSave?: (name: string, elements: CreatureElement[], color: string, editingCreatureId?: string) => void;
  onSaveToDB?: (name: string, elements: CreatureElement[], color: string) => void;
}

const ELEMENT_TOOLS: { type: ElementType | 'eraser'; label: string; symbol: string; weight: number; price: number; desc: string }[] = [
  {
    type: 'head-jaw',
    label: 'Челюсть к голове (🦷)',
    symbol: '🦷',
    weight: 0,
    price: 180,
    desc: 'Крепится строго к голове (👁️). Активирует канибализм: кусает врагов в секторе 60° по направлению головы',
  },
  {
    type: 'head',
    label: 'Голова обычная (👁️)',
    symbol: '👁️',
    weight: 0,
    price: 50,
    desc: 'Задает ВПЕРЕД для чудика и ориентацию глаз',
  },
  {
    type: 'joint',
    label: 'Шарнир (◯)',
    symbol: '◯',
    weight: 0,
    price: 10,
    desc: 'Узел вращения на пересечении клеток (Вес = 0)',
  },
  {
    type: 'edge-h',
    label: 'Ребро гориз. (—)',
    symbol: '—',
    weight: 1,
    price: 10,
    desc: 'Каркасная балка длиной 1 клетка (Вес = 1)',
  },
  {
    type: 'edge-v',
    label: 'Ребро вертик. (|)',
    symbol: '|',
    weight: 1,
    price: 10,
    desc: 'Каркасная балка длиной 1 клетка (Вес = 1)',
  },
  {
    type: 'edge-d1',
    label: 'Ребро диаг. / (↙-↗)',
    symbol: '/',
    weight: 1,
    price: 10,
    desc: 'Диагональ / (Вес = 1)',
  },
  {
    type: 'edge-d2',
    label: 'Ребро диаг. \\ (↖-↘)',
    symbol: '\\',
    weight: 1,
    price: 10,
    desc: 'Диагональ \\ (Вес = 1)',
  },
  {
    type: 'muscle-left',
    label: 'Мышца влево (⟲)',
    symbol: '⟲',
    weight: 0,
    price: 25,
    desc: 'Крепится к шарниру (◯). Тяга влево',
  },
  {
    type: 'muscle-right',
    label: 'Мышца вправо (⟳)',
    symbol: '⟳',
    weight: 0,
    price: 25,
    desc: 'Крепится к шарниру (◯). Тяга вправо',
  },
  {
    type: 'muscle-random-left',
    label: 'Случ. мышца влево (🎲⟲)',
    symbol: '🎲⟲',
    weight: 0,
    price: 35,
    desc: 'Случайный шанс сокращения (5%-90%)',
  },
  {
    type: 'muscle-random-right',
    label: 'Случ. мышца вправо (🎲⟳)',
    symbol: '🎲⟳',
    weight: 0,
    price: 35,
    desc: 'Случайный шанс сокращения (5%-90%)',
  },
  {
    type: 'eraser',
    label: 'Удалить / Ластик (❌)',
    symbol: '❌',
    weight: 0,
    price: 0,
    desc: 'Нажмите на любой элемент для его удаления и возврата еды',
  },
];

export const CreatureEditor: React.FC<CreatureEditorProps> = ({
  isOpen,
  editingCreature,
  token,
  food,
  bankFood,
  onSpendFood,
  onDepositFood,
  onSpendBankFood,
  onDepositBankFood,
  onClose,
  onSpawnCreature,
  onSave,
  onSaveToDB,
}) => {
  const [name, setName] = useState<string>('Мой Физический Чудик');
  const [selectedTool, setSelectedTool] = useState<ElementType | 'eraser'>('head');
  const [selectedColor, setSelectedColor] = useState<string>('#6366f1');
  const [headAngle, setHeadAngle] = useState<number>(270); // 270 = Up (вверх)
  const [randomChance, setRandomChance] = useState<number>(35); // Настраиваемая вероятность случайных мышц (5% - 90%)
  const [placementWarning, setPlacementWarning] = useState<string | null>(null);
  const [initialElementsCost, setInitialElementsCost] = useState<number>(0);
  const [refundNotification, setRefundNotification] = useState<{ message: string; amount: number; id: number } | null>(null);
  
  // Editor Camera & Grid Radius State
  const [gridRadius, setGridRadius] = useState<number>(4); // Радиус сетки (4 = 9x9, 5 = 11x11, 6 = 13x13, 7 = 15x15)
  const [editorZoom, setEditorZoom] = useState<number>(1); // Масштабирование (0.3x - 3.0x)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 }); // Панорамирование камеры
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState<boolean>(false);

  // Hover & selection states for interactive element editing
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Interactive Node Grid Elements
  const [elements, setElements] = useState<CreatureElement[]>([]);

  // Rotate head angle (270 -> 0 -> 90 -> 180 -> 270)
  const handleRotateHead = (id: string) => {
    setElements((prev) =>
      prev.map((el) => {
        if (el.id === id && (el.type === 'head' || el.type === 'head-jaw')) {
          const current = el.headAngle ?? 270;
          const nextAngle = current === 270 ? 0 : current === 0 ? 90 : current === 90 ? 180 : 270;
          return { ...el, headAngle: nextAngle };
        }
        return el;
      })
    );
  };

  const handleLoadStarter = () => {
    setName('Стартовый чудик');
    const starterElements = JSON.parse(JSON.stringify(STARTER_PRESET.elements));
    setElements(starterElements);
    setInitialElementsCost(calculateElementsPrice(starterElements));
    setSelectedColor('#10b981');
    setPlacementWarning(null);
    setRefundNotification(null);
  };

  // Trigger temporary refund notification badge
  const triggerRefundNotice = (amount: number, label: string) => {
    if (amount <= 0) return;
    setRefundNotification({
      message: `+${amount} еды возвращено за: ${label}`,
      amount,
      id: Date.now(),
    });
  };

  // Auto-dismiss refund notification after 2.8s
  useEffect(() => {
    if (refundNotification) {
      const timer = setTimeout(() => setRefundNotification(null), 3200);
      return () => clearTimeout(timer);
    }
  }, [refundNotification]);

  // Clean disconnected elements with 1 click and refund food
  const handleCleanDisconnected = () => {
    if (connectivity.disconnectedIds.size === 0) return;
    const toRemove = elements.filter((el) => connectivity.disconnectedIds.has(el.id));
    const refund = toRemove.reduce((sum, el) => sum + getElementPrice(el.type), 0);
    setElements((prev) => prev.filter((el) => !connectivity.disconnectedIds.has(el.id)));
    triggerRefundNotice(refund, `${toRemove.length} оторванных деталей`);
    setPlacementWarning(null);
  };

  // Clean unattached muscles with 1 click and refund food
  const handleCleanUnattachedMuscles = () => {
    if (connectivity.unattachedMuscleIds.size === 0) return;
    const toRemove = elements.filter((el) => connectivity.unattachedMuscleIds.has(el.id));
    const refund = toRemove.reduce((sum, el) => sum + getElementPrice(el.type), 0);
    setElements((prev) => prev.filter((el) => !connectivity.unattachedMuscleIds.has(el.id)));
    triggerRefundNotice(refund, `${toRemove.length} мышц без шарниров`);
    setPlacementWarning(null);
  };

  // Clean unattached jaws with 1 click and refund food
  const handleCleanUnattachedJaws = () => {
    if (connectivity.unattachedJawIds.size === 0) return;
    const toRemove = elements.filter((el) => connectivity.unattachedJawIds.has(el.id));
    const refund = toRemove.reduce((sum, el) => sum + getElementPrice(el.type), 0);
    setElements((prev) => prev.filter((el) => !connectivity.unattachedJawIds.has(el.id)));
    triggerRefundNotice(refund, `${toRemove.length} челюстей без головы`);
    setPlacementWarning(null);
  };

  // Change random muscle chance (+ / -)
  const handleChangeRandomChance = (id: string, delta: number) => {
    setElements((prev) =>
      prev.map((el) => {
        if (el.id === id && (el.type === 'muscle-random-left' || el.type === 'muscle-random-right')) {
          const current = el.randomChance ?? 35;
          const next = Math.min(95, Math.max(5, current + delta));
          return { ...el, randomChance: next };
        }
        return el;
      })
    );
  };

  // Click directly on an SVG element shape
  const handleElementClick = (el: CreatureElement) => {
    if (selectedTool === 'eraser') {
      handleDeleteElement(el.id);
      setSelectedElementId(null);
      return;
    }
    if (selectedTool === 'head' && el.type === 'head') {
      handleRotateHead(el.id);
      return;
    }
    if (
      (selectedTool === 'muscle-random-left' || selectedTool === 'muscle-random-right') &&
      el.type === selectedTool
    ) {
      handleChangeRandomChance(el.id, 2);
      return;
    }
    // Toggle selection on element click
    setSelectedElementId((prev) => (prev === el.id ? null : el.id));
  };

  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const editingCreatureId = editingCreature?.id;

  // Non-passive wheel event listener for zoom in editor
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !isOpen) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        setEditorZoom((z) => Math.min(3.0, z + 0.15));
      } else {
        setEditorZoom((z) => Math.max(0.3, z - 0.15));
      }
    };

    svg.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      svg.removeEventListener('wheel', handleWheelNative);
    };
  }, [isOpen]);

  // Load creature data & calculate initial cost
  useEffect(() => {
    if (isOpen) {
      let activeElements: CreatureElement[];
      let initCost = 0;
      if (editingCreature && Array.isArray(editingCreature.elements)) {
        setName(editingCreature.name);
        setSelectedColor(editingCreature.color);
        activeElements = JSON.parse(JSON.stringify(editingCreature.elements));
        initCost = calculateElementsPrice(activeElements);
      } else {
        setName('Мой Физический Чудик');
        setSelectedColor('#6366f1');
        activeElements = [];
        initCost = 0;
      }
      setElements(activeElements);
      setInitialElementsCost(initCost);
      setRefundNotification(null);

      // Auto-fit grid radius to contain creature elements
      let maxAbs = 3;
      activeElements.forEach((el) => {
        maxAbs = Math.max(maxAbs, Math.abs(el.relX), Math.abs(el.relY));
      });
      setGridRadius(Math.max(4, maxAbs + 1));

      // Reset camera & selection
      setPan({ x: 0, y: 0 });
      setEditorZoom(1);
      setSelectedElementId(null);
      setHoveredElementId(null);
    }
  }, [isOpen, editingCreatureId]);

  // Keyboard shortcut: Delete / Backspace removes selected element and refunds food
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA'
        ) {
          return;
        }
        e.preventDefault();
        handleDeleteElement(selectedElementId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedElementId, elements]);

  // Fit creature into view (Auto-center and zoom)
  const handleFitCreature = () => {
    if (elements.length === 0) {
      setPan({ x: 0, y: 0 });
      setEditorZoom(1);
      return;
    }
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    elements.forEach((el) => {
      minX = Math.min(minX, el.relX);
      maxX = Math.max(maxX, el.relX);
      minY = Math.min(minY, el.relY);
      maxY = Math.max(maxY, el.relY);
    });
    const centerX = ((minX + maxX) / 2) * 40;
    const centerY = ((minY + maxY) / 2) * 40;
    const spanX = (maxX - minX + 2) * 40;
    const spanY = (maxY - minY + 2) * 40;
    const maxSpan = Math.max(spanX, spanY, 180);
    const targetZoom = Math.min(2.5, Math.max(0.4, 260 / maxSpan));
    setPan({ x: centerX, y: centerY });
    setEditorZoom(targetZoom);
  };

  if (!isOpen) return null;

  // Real-time dynamic economy and physics calculations
  const physics = calculatePhysicsForces(elements, 0);
  const connectivity = getCreatureConnectivity(elements);
  const currentElementsCost = calculateElementsPrice(elements);
  const costDiff = currentElementsCost - initialElementsCost;
  const editingCreatureFood = editingCreature ? Math.max(editingCreature.foodEaten ?? 0, editingCreature.bankFood ?? 0) : 0;
  const currentFood = editingCreature
    ? (editingCreatureFood > 0 ? editingCreatureFood : (typeof food === 'number' ? food : (typeof bankFood === 'number' ? bankFood : 0)))
    : (typeof food === 'number' ? food : (typeof bankFood === 'number' ? bankFood : 0));
  // Available food points for building / replacing parts dynamically
  const availableFood = IS_UNLIMITED_MODE ? 999999 : (currentFood - costDiff);
  const refundedFromDismantling = Math.max(0, initialElementsCost - currentElementsCost);
  const canAfford = IS_UNLIMITED_MODE || availableFood >= 0;

  // Auto-dismiss placement warning after 3.5s
  useEffect(() => {
    if (placementWarning) {
      const timer = setTimeout(() => setPlacementWarning(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [placementWarning]);

  // Toggle, edit or add element on node grid click
  const handleNodeClick = (relX: number, relY: number) => {
    if (selectedTool === 'eraser') {
      const toDelete = elements.filter((el) => el.relX === relX && el.relY === relY);
      if (toDelete.length > 0) {
        const refundAmount = toDelete.reduce((sum, el) => sum + getElementPrice(el.type), 0);
        const labels = toDelete.map((el) => getElementLabel(el.type)).join(', ');
        setElements((prev) => prev.filter((el) => !(el.relX === relX && el.relY === relY)));
        triggerRefundNotice(refundAmount, labels);
      }
      return;
    }

    // Правило: Мышцы должны крепиться только к шарнирам (◯)
    if (selectedTool.startsWith('muscle-')) {
      const hasJointHere = elements.some(
        (el) => el.type === 'joint' && el.relX === relX && el.relY === relY
      );
      if (!hasJointHere) {
        setPlacementWarning(
          `⚠️ Мышцы крепятся только к шарнирам (◯)! Сначала установите шарнир в узел (${relX}, ${relY}).`
        );
        return;
      }
    }

    // Правило: Челюсть (🦷) можно крепить только к голове (👁️)
    if (selectedTool === 'head-jaw') {
      const headAtNode = elements.find(
        (el) => el.type === 'head' && el.relX === relX && el.relY === relY
      );
      if (!headAtNode) {
        setPlacementWarning(
          `⚠️ Челюсть можно крепить только к голове (👁️)! Сначала установите обычную голову в узел (${relX}, ${relY}).`
        );
        return;
      }
    }

    // Check if an element of the exact same tool type exists at this node
    const existingSame = elements.find(
      (el) => el.relX === relX && el.relY === relY && el.type === selectedTool
    );

    if (existingSame) {
      if (selectedTool === 'head' || selectedTool === 'head-jaw') {
        // Rotate head/jaw angle on click if same tool
        handleRotateHead(existingSame.id);
      } else {
        // Remove element if same tool clicked again -> triggers dynamic refund!
        handleDeleteElement(existingSame.id);
      }
      return;
    }

    // Check budget for new element
    const toolPrice = getElementPrice(selectedTool as ElementType);
    const toolDef = ELEMENT_TOOLS.find((t) => t.type === selectedTool);
    if (!IS_UNLIMITED_MODE && availableFood < toolPrice) {
      setPlacementWarning(
        `⚠️ Недостаточно еды! "${toolDef?.label || selectedTool}" стоит ${toolPrice} еды (доступно: ${availableFood}). Удалите другие элементы для возврата очков или соберите еду на поле!`
      );
      return;
    }

    // Clear any previous placement warning
    setPlacementWarning(null);

    // Add new element at this node location (joints, muscles, heads and edges can co-exist at a node)
    const isRandomMuscle = selectedTool === 'muscle-random-left' || selectedTool === 'muscle-random-right';
    const isHeadOrJaw = selectedTool === 'head' || selectedTool === 'head-jaw';
    
    // For jaw, inherit head angle if placed on existing head
    let effectiveHeadAngle = headAngle;
    if (selectedTool === 'head-jaw') {
      const parentHead = elements.find((el) => el.type === 'head' && el.relX === relX && el.relY === relY);
      if (parentHead && parentHead.headAngle !== undefined) {
        effectiveHeadAngle = parentHead.headAngle;
      }
    }

    const newEl: CreatureElement = {
      id: `el-${Date.now()}-${Math.random()}`,
      relX,
      relY,
      type: selectedTool as ElementType,
      weight: toolDef ? toolDef.weight : 1,
      headAngle: isHeadOrJaw ? effectiveHeadAngle : undefined,
      randomChance: isRandomMuscle ? randomChance : undefined,
    };
    setElements((prev) => [...prev, newEl]);

    // Expand grid radius if clicked near border
    if (Math.abs(relX) >= gridRadius - 1 || Math.abs(relY) >= gridRadius - 1) {
      if (gridRadius < 7) setGridRadius((r) => Math.min(7, r + 1));
    }
  };

  const handleDeleteElement = (id: string) => {
    const target = elements.find((e) => e.id === id);
    if (!target) return;

    let refundAmount = getElementPrice(target.type);
    let label = getElementLabel(target.type);

    if (target.type === 'joint') {
      // При удалении шарнира также автоматически удаляем прикрепленные к нему мышцы и возвращаем их стоимость
      const attachedMuscles = elements.filter(
        (el) => el.type.startsWith('muscle-') && el.relX === target.relX && el.relY === target.relY
      );
      if (attachedMuscles.length > 0) {
        const extraMuscleCost = attachedMuscles.reduce((sum, m) => sum + getElementPrice(m.type), 0);
        refundAmount += extraMuscleCost;
        label = `Шарнир и ${attachedMuscles.length} мышц(ы)`;
      }

      setElements((prev) =>
        prev.filter(
          (el) =>
            el.id !== id &&
            !(el.type.startsWith('muscle-') && el.relX === target.relX && el.relY === target.relY)
        )
      );
    } else if (target.type === 'head') {
      // При удалении головы также автоматически удаляем прикрепленные челюсти и возвращаем их стоимость
      const attachedJaws = elements.filter(
        (el) => el.type === 'head-jaw' && el.relX === target.relX && el.relY === target.relY
      );
      if (attachedJaws.length > 0) {
        const extraJawCost = attachedJaws.reduce((sum, j) => sum + getElementPrice(j.type), 0);
        refundAmount += extraJawCost;
        label = `Голова и ${attachedJaws.length} челюсть(и)`;
      }

      setElements((prev) =>
        prev.filter(
          (el) =>
            el.id !== id &&
            !(el.type === 'head-jaw' && el.relX === target.relX && el.relY === target.relY)
        )
      );
    } else {
      setElements((prev) => prev.filter((el) => el.id !== id));
    }

    triggerRefundNotice(refundAmount, label);
    if (selectedElementId === id) setSelectedElementId(null);
    setPlacementWarning(null);
  };

  const handleClear = () => {
    if (elements.length === 0) return;
    const totalValue = calculateElementsPrice(elements);
    setElements([]);
    setSelectedElementId(null);
    setPlacementWarning(null);
    if (totalValue > 0) {
      triggerRefundNotice(totalValue, 'всю конструкцию');
    }
  };

  const handleSaveAndSpawn = async () => {
    if (elements.length === 0) {
      setPlacementWarning('⚠️ Добавьте хотя бы одну деталь чудика перед сохранением!');
      return;
    }
    if (!connectivity.isConnected) {
      setPlacementWarning('⚠️ Нельзя сохранить: детали оторваны от тела чудика! Нажмите кнопку «Удалить оторванные» или соедините их ребрами.');
      return;
    }
    if (connectivity.unattachedMuscleIds.size > 0) {
      setPlacementWarning('⚠️ Нельзя сохранить: мышцы могут крепиться только к шарнирам (◯)! Нажмите «Удалить и вернуть еду» или установите шарниры.');
      return;
    }
    if (connectivity.unattachedJawIds.size > 0) {
      setPlacementWarning('⚠️ Нельзя сохранить: челюсти (🦷) могут крепиться только к голове (👁️)! Нажмите «Удалить и вернуть еду» или установите головы.');
      return;
    }
    if (!canAfford) {
      setPlacementWarning(`⚠️ Недостаточно очков еды (доступно: ${availableFood}). Удалите часть элементов для возврата очков.`);
      return;
    }

    const spendFn = onSpendFood || onSpendBankFood;
    const depositFn = onDepositFood || onDepositBankFood;

    if (costDiff > 0 && spendFn) {
      const ok = await spendFn(costDiff);
      if (!ok) {
        setPlacementWarning(`⚠️ Недостаточно очков еды для доплаты (${currentFood}/${costDiff})!`);
        return;
      }
    } else if (costDiff < 0 && depositFn) {
      await depositFn(-costDiff);
    }

    const saveFn = onSpawnCreature || onSave;
    if (typeof saveFn === 'function') {
      saveFn(name, elements, selectedColor, editingCreature?.id);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-900/50 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                {editingCreature ? `Редактирование: ${editingCreature.name}` : 'Конструктор Физических Чудиков'}
              </h2>
              <p className="text-xs text-slate-400">
                {editingCreature ? 'Удаляйте элементы для возврата очков и заменяйте их новыми деталями' : 'Задайте Голову/Челюсть (направление вперед), Шарниры (0), Ребра (1) и Мышцы'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Grid */}
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto flex-1 min-h-0">
          {/* Left Panel: Tools & Color */}
          <div className="md:col-span-5 flex flex-col gap-4">
            {/* Quick Starter Preset Loader & Dynamic Bank/Available Food Indicator */}
            <div className="flex flex-col gap-2 p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl">
              {IS_UNLIMITED_MODE && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/90 border border-emerald-400/80 rounded-lg text-emerald-300 text-2xs font-bold shadow-xs animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>РЕЖИМ БЕЗЛИМИТ: Все элементы 0 еды!</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-emerald-950/70 border border-emerald-500/50 px-2.5 py-1 rounded-lg">
                  <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs text-slate-300">Доступно еды:</span>
                  <strong className={`font-mono text-sm ${availableFood >= 0 || IS_UNLIMITED_MODE ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}`}>
                    {IS_UNLIMITED_MODE ? '∞ (Безлимит)' : availableFood}
                  </strong>
                </div>

                <button
                  onClick={handleLoadStarter}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-2xs font-bold text-emerald-200 bg-emerald-800/60 hover:bg-emerald-700/80 border border-emerald-400/50 rounded-lg transition"
                  title="Загрузить бесплатный стартовый чудик"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Стартовый (0 еды)</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-2xs text-slate-400 px-1 pt-1 border-t border-slate-700/50">
                <span>Баланс еды: <strong className="text-emerald-400 font-mono">{currentFood}</strong></span>
                <span>В чудике: <strong className="text-indigo-300 font-mono">{IS_UNLIMITED_MODE ? '0 (Безлимит)' : currentElementsCost}</strong></span>
                {refundedFromDismantling > 0 && !IS_UNLIMITED_MODE && (
                  <span className="text-emerald-400 font-mono font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-600/30 animate-pulse">
                    ♻️ Возврат: +{refundedFromDismantling}
                  </span>
                )}
              </div>

              {/* Dynamic Refund notification banner */}
              {refundNotification && (
                <div className="flex items-center gap-2 p-2 bg-emerald-950/90 border border-emerald-400 text-emerald-300 text-xs rounded-lg shadow-md animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="font-bold">{refundNotification.message}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-2xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                Имя Чудика:
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/80 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-2xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                Выбор инструмента:
              </label>
              <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                {ELEMENT_TOOLS.map((tool) => {
                  const dynamicPrice = tool.type === 'eraser' ? 0 : getElementPrice(tool.type as ElementType);
                  const isAffordable = tool.type === 'eraser' || IS_UNLIMITED_MODE || availableFood >= dynamicPrice;
                  const isSelected = selectedTool === tool.type;
                  return (
                    <button
                      key={tool.type}
                      onClick={() => setSelectedTool(tool.type)}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs text-left transition ${
                        isSelected
                          ? tool.type === 'eraser'
                            ? 'border-red-500 bg-red-950/50 text-red-300 font-semibold'
                            : 'border-indigo-500 bg-indigo-950/50 text-indigo-300 font-semibold shadow-xs'
                          : isAffordable
                          ? 'border-slate-800 hover:bg-slate-800/60 text-slate-300'
                          : 'border-slate-800/60 bg-slate-900/40 text-slate-400 opacity-75 hover:border-amber-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 flex items-center justify-center bg-slate-800 rounded font-mono font-bold text-slate-200 border border-slate-700/50 shrink-0">
                          {tool.symbol}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium">{tool.label}</span>
                            {tool.type !== 'eraser' && (
                              <span className={`text-3xs font-mono font-bold px-1 py-0.2 rounded ${
                                isAffordable ? 'text-emerald-400 bg-emerald-950/60' : 'text-rose-400 bg-rose-950/60'
                              }`}>
                                {dynamicPrice} еды
                              </span>
                            )}
                          </div>
                          <div className="text-2xs text-slate-500">{tool.desc}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Direction Selector for Head / Predator Jaw */}
            {(selectedTool === 'head' || selectedTool === 'head-jaw') && (
              <div className={`p-3 rounded-xl border ${selectedTool === 'head-jaw' ? 'bg-red-950/30 border-red-800/40' : 'bg-amber-950/30 border-amber-800/40'}`}>
                <label className={`block text-2xs font-bold uppercase tracking-widest mb-2 ${selectedTool === 'head-jaw' ? 'text-red-400' : 'text-amber-400'}`}>
                  Направление атаки / взгляда ({selectedTool === 'head-jaw' ? '🦷 Челюсть' : '👁️ Голова'}):
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => setHeadAngle(270)}
                    className={`flex items-center justify-center p-2 rounded-lg border text-xs transition ${
                      headAngle === 270
                        ? (selectedTool === 'head-jaw' ? 'bg-red-500 text-white font-bold border-red-400' : 'bg-amber-500 text-slate-950 font-bold border-amber-400')
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setHeadAngle(0)}
                    className={`flex items-center justify-center p-2 rounded-lg border text-xs transition ${
                      headAngle === 0
                        ? (selectedTool === 'head-jaw' ? 'bg-red-500 text-white font-bold border-red-400' : 'bg-amber-500 text-slate-950 font-bold border-amber-400')
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setHeadAngle(90)}
                    className={`flex items-center justify-center p-2 rounded-lg border text-xs transition ${
                      headAngle === 90
                        ? (selectedTool === 'head-jaw' ? 'bg-red-500 text-white font-bold border-red-400' : 'bg-amber-500 text-slate-950 font-bold border-amber-400')
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setHeadAngle(180)}
                    className={`flex items-center justify-center p-2 rounded-lg border text-xs transition ${
                      headAngle === 180
                        ? (selectedTool === 'head-jaw' ? 'bg-red-500 text-white font-bold border-red-400' : 'bg-amber-500 text-slate-950 font-bold border-amber-400')
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Probability Selector for Random Muscle (5% - 90%) */}
            {(selectedTool === 'muscle-random-left' || selectedTool === 'muscle-random-right') && (
              <div className="p-3 bg-orange-950/40 border border-orange-800/50 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-2xs font-bold text-orange-400 uppercase tracking-widest">
                  <span>Вероятность срабатывания (🎲):</span>
                  <span className="text-sm font-mono font-bold text-orange-200">{randomChance}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="90"
                  step="5"
                  value={randomChance}
                  onChange={(e) => setRandomChance(Number(e.target.value))}
                  className="w-full accent-orange-500 bg-slate-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex items-center justify-between gap-1 pt-1">
                  {[
                    { label: '15% Редко', val: 15 },
                    { label: '35% Норма', val: 35 },
                    { label: '60% Часто', val: 60 },
                    { label: '85% Хаос', val: 85 },
                  ].map((p) => (
                    <button
                      key={p.val}
                      onClick={() => setRandomChance(p.val)}
                      className={`text-3xs px-1.5 py-0.5 rounded font-mono border transition ${
                        randomChance === p.val
                          ? 'bg-orange-500 text-slate-950 border-orange-400 font-bold'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Muscle-to-Joint Attachment Rule Helper */}
            {selectedTool.startsWith('muscle-') && (() => {
              const jointCount = elements.filter((e) => e.type === 'joint').length;
              return (
                <div
                  className={`p-3 rounded-xl border text-xs transition-all ${
                    jointCount > 0
                      ? 'bg-sky-950/40 border-sky-600/50 text-sky-200'
                      : 'bg-amber-950/50 border-amber-500/60 text-amber-200 animate-pulse'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 mb-1 text-2xs uppercase tracking-wider">
                    <span>{jointCount > 0 ? '⚡ Правило крепления мышц:' : '⚠️ Внимание: Требуется шарнир!'}</span>
                  </div>
                  <p className="text-2xs leading-relaxed opacity-90">
                    {jointCount > 0
                      ? `Мышцы крепятся только к шарнирам (◯). Доступных шарниров: ${jointCount}. Нажмите на подсвеченный шарнир на чертеже.`
                      : 'Мышцы можно устанавливать ТОЛЬКО на шарниры (◯)! Сначала выберите инструмент "Шарнир (◯)" и установите его на сетку.'}
                  </p>
                </div>
              );
            })()}

            {/* Jaw-to-Head Attachment Rule Helper */}
            {selectedTool === 'head-jaw' && (() => {
              const headCount = elements.filter((e) => e.type === 'head').length;
              return (
                <div
                  className={`p-3 rounded-xl border text-xs transition-all ${
                    headCount > 0
                      ? 'bg-red-950/40 border-red-600/50 text-red-200'
                      : 'bg-amber-950/50 border-amber-500/60 text-amber-200 animate-pulse'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 mb-1 text-2xs uppercase tracking-wider">
                    <span>{headCount > 0 ? '🦷 Правило челюсти и канибализма:' : '⚠️ Внимание: Требуется голова (👁️)!'}</span>
                  </div>
                  <p className="text-2xs leading-relaxed opacity-90">
                    {headCount > 0
                      ? `Челюсть крепится строго к голове (👁️). Доступных голов: ${headCount}. Нажмите на голову на чертеже. Челюсть кусает врагов в секторе 60° по направлению взгляда головы!`
                      : 'Челюсть можно устанавливать ТОЛЬКО на голову (👁️)! Сначала выберите инструмент "Голова обычная (👁️)" и установите её на сетку.'}
                  </p>
                </div>
              );
            })()}

            <div>
              <label className="block text-2xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                Цвет каркаса:
              </label>
              <div className="flex items-center gap-2">
                {['#6366f1', '#10b981', '#f43f5e', '#a855f7', '#f59e0b', '#38bdf8'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full border-2 transition ${
                      selectedColor === c
                        ? 'border-white ring-2 ring-indigo-500 scale-110'
                        : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: Raised Canvas & Controls Directly Opposite Tool Selector */}
          <div className="md:col-span-7 flex flex-col items-center bg-slate-950/60 border border-slate-800 rounded-xl p-4 gap-3">
            {/* Top Toolbar: Compact Grid Size & Clear Button */}
            <div className="w-full flex items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 rounded-xl p-2 text-2xs font-mono">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="font-bold text-slate-400 shrink-0">Поле:</span>
                {[
                  { r: 2, label: '5x5' },
                  { r: 3, label: '7x7' },
                  { r: 4, label: '9x9' },
                  { r: 5, label: '11x11' },
                  { r: 6, label: '13x13' },
                  { r: 7, label: '15x15' },
                ].map((item) => (
                  <button
                    key={item.r}
                    onClick={() => setGridRadius(item.r)}
                    className={`px-2 py-0.5 rounded-lg border font-bold transition shrink-0 ${
                      gridRadius === item.r
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-900/40 scale-105'
                        : 'bg-slate-800/90 border-slate-700/80 text-slate-400 hover:text-slate-100 hover:bg-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleClear}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition shrink-0"
                title="Очистить все детали"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Сброс</span>
              </button>
            </div>

            {/* Raised Visual Vector Blueprint Canvas (directly opposite tool selector!) */}
            <div className="relative w-full max-w-md aspect-square border border-indigo-900/40 rounded-xl bg-slate-900/90 p-1 shadow-inner flex items-center justify-center overflow-hidden group">
              {/* Floating Zoom & Pan Controls for Constructor Canvas */}
              <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-slate-950/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 shadow-lg">
                <button
                  onClick={() => setEditorZoom((z) => Math.min(3.0, z + 0.25))}
                  className="p-1.5 hover:bg-slate-800 rounded-lg transition text-slate-200"
                  title="Увеличить чертеж (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 text-2xs font-bold text-indigo-400 select-none">
                  {(editorZoom * 100).toFixed(0)}%
                </span>
                <button
                  onClick={() => setEditorZoom((z) => Math.max(0.3, z - 0.25))}
                  className="p-1.5 hover:bg-slate-800 rounded-lg transition text-slate-200"
                  title="Уменьшить чертеж (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setPan({ x: 0, y: 0 });
                    setEditorZoom(1);
                  }}
                  className="p-1.5 hover:bg-slate-800 rounded-lg transition text-slate-200"
                  title="Сбросить камеру в центр (🎯)"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleFitCreature}
                  className="p-1.5 hover:bg-slate-800 rounded-lg transition text-indigo-400 font-bold"
                  title="Вписать чудика в центр экрана (📐)"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Hint banner */}
              <div className="absolute bottom-2 left-2 right-2 z-20 pointer-events-none text-2xs text-slate-400/80 font-mono text-center bg-slate-950/70 backdrop-blur-xs py-0.5 px-2 rounded-lg border border-slate-800/50">
                💡 Перетаскивайте мышью для перемещения | Колесико — масштаб
              </div>

              {(() => {
                const maxGridPx = (gridRadius + 1) * 40;
                const viewBoxWidth = 300 / editorZoom;
                const viewBoxHeight = 300 / editorZoom;
                const viewBoxMinX = 150 + pan.x - viewBoxWidth / 2;
                const viewBoxMinY = 150 + pan.y - viewBoxHeight / 2;

                return (
                  <svg
                    ref={svgRef}
                    viewBox={`${viewBoxMinX} ${viewBoxMinY} ${viewBoxWidth} ${viewBoxHeight}`}
                    onMouseDown={(e) => {
                      setIsDragging(true);
                      setHasMoved(false);
                      setDragStart({ x: e.clientX, y: e.clientY });
                      setPanStart({ x: pan.x, y: pan.y });
                    }}
                    onMouseMove={(e) => {
                      if (!isDragging) return;
                      const dx = e.clientX - dragStart.x;
                      const dy = e.clientY - dragStart.y;
                      if (Math.hypot(dx, dy) > 4) setHasMoved(true);
                      const svgDx = -dx / editorZoom;
                      const svgDy = -dy / editorZoom;
                      setPan({ x: panStart.x + svgDx, y: panStart.y + svgDy });
                    }}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                    className="w-full h-full select-none cursor-grab active:cursor-grabbing overflow-visible transition-all duration-75"
                  >
                    <defs>
                      <pattern
                        id="blueprint-grid"
                        width="40"
                        height="40"
                        patternUnits="userSpaceOnUse"
                        x="10"
                        y="10"
                      >
                        <path
                          d="M 40 0 L 0 0 0 40"
                          fill="none"
                          stroke="rgba(56, 189, 248, 0.15)"
                          strokeWidth="1"
                        />
                      </pattern>
                    </defs>

                    {/* Extended Grid Background Pattern */}
                    <rect
                      x={150 - maxGridPx}
                      y={150 - maxGridPx}
                      width={maxGridPx * 2}
                      height={maxGridPx * 2}
                      fill="url(#blueprint-grid)"
                      rx="12"
                    />

                    {/* Center Axes Lines */}
                    <line
                      x1={150}
                      y1={150 - maxGridPx}
                      x2={150}
                      y2={150 + maxGridPx}
                      stroke="rgba(56, 189, 248, 0.35)"
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                    />
                    <line
                      x1={150 - maxGridPx}
                      y1={150}
                      x2={150 + maxGridPx}
                      y2={150}
                      stroke="rgba(56, 189, 248, 0.35)"
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                    />

                    {/* Render Placed Structural Elements */}
                    {elements.map((el) => {
                      const px = 150 + el.relX * 40;
                      const py = 150 + el.relY * 40;
                      const isHovered = hoveredElementId === el.id;
                      const isSelected = selectedElementId === el.id;
                      const isEraser = selectedTool === 'eraser';
                      const isDisconnected = connectivity.disconnectedIds.has(el.id);

                      const handleElClick = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (!hasMoved) {
                          handleElementClick(el);
                        }
                      };

                      const commonProps = {
                        className: "cursor-pointer group/el transition-all duration-150",
                        onClick: handleElClick,
                        onMouseEnter: () => setHoveredElementId(el.id),
                        onMouseLeave: () => setHoveredElementId(null),
                      };

                      const renderDisconnectedRing = () => {
                        if (!isDisconnected) return null;
                        return (
                          <g>
                            <circle
                              cx={px}
                              cy={py}
                              r="20"
                              fill="rgba(239, 68, 68, 0.2)"
                              stroke="#ef4444"
                              strokeWidth="2"
                              strokeDasharray="4 2"
                            />
                            <text x={px + 10} y={py - 10} fontSize="11" fill="#ef4444" fontWeight="bold">⚠️</text>
                          </g>
                        );
                      };

                      if (el.type === 'head' || el.type === 'head-jaw') {
                        const isJaw = el.type === 'head-jaw';
                        const angle = el.headAngle ?? 270;
                        const rad = (angle * Math.PI) / 180;
                        const pupilX = px + Math.cos(rad) * 6;
                        const pupilY = py + Math.sin(rad) * 6;
                        const arrowSymbol = angle === 270 ? '⬆️' : angle === 0 ? '➡️' : angle === 90 ? '⬇️' : '⬅️';

                        return (
                          <g key={el.id} {...commonProps}>
                            {/* Glow aura */}
                            {(isHovered || isSelected || isEraser) && (
                              <circle
                                cx={px}
                                cy={py}
                                r="18"
                                fill={isEraser ? 'rgba(239, 68, 68, 0.25)' : isJaw ? 'rgba(239, 68, 68, 0.3)' : 'rgba(250, 204, 21, 0.3)'}
                                stroke={isEraser ? '#ef4444' : isJaw ? '#dc2626' : '#eab308'}
                                strokeWidth="2"
                                strokeDasharray="3 3"
                              />
                            )}
                            <circle
                              cx={px}
                              cy={py}
                              r={isJaw ? 15 : 13}
                              fill={isJaw ? '#fee2e2' : '#fef08a'}
                              stroke={isJaw ? '#dc2626' : '#eab308'}
                              strokeWidth="2.5"
                            />
                            {/* Predatory teeth if head-jaw */}
                            {isJaw && (
                              <g>
                                <polygon
                                  points={`${px - 8},${py - 12} ${px - 4},${py - 17} ${px},${py - 12}`}
                                  fill="#dc2626"
                                />
                                <polygon
                                  points={`${px},${py - 12} ${px + 4},${py - 17} ${px + 8},${py - 12}`}
                                  fill="#dc2626"
                                />
                              </g>
                            )}
                            {/* Direction pupil */}
                            <circle cx={pupilX} cy={pupilY} r={isJaw ? 4.8 : 4.5} fill={isJaw ? '#991b1b' : '#0f172a'} />
                            <circle cx={pupilX - 1} cy={pupilY - 1} r="1.5" fill="#ffffff" />
                            <text x={px + 14} y={py + 4} fill={isJaw ? '#ef4444' : '#fef08a'} fontSize="10" fontWeight="bold">
                              {arrowSymbol}
                            </text>
                          </g>
                        );
                      }

                      if (el.type === 'edge-h') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <line
                                x1={px - 22}
                                y1={py}
                                x2={px + 22}
                                y2={py}
                                stroke={isEraser ? '#ef4444' : '#38bdf8'}
                                strokeWidth="10"
                                strokeOpacity="0.4"
                                strokeLinecap="round"
                              />
                            )}
                            <line
                              x1={px - 20}
                              y1={py}
                              x2={px + 20}
                              y2={py}
                              stroke={selectedColor}
                              strokeWidth="5"
                              strokeLinecap="round"
                            />
                          </g>
                        );
                      }

                      if (el.type === 'edge-v') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <line
                                x1={px}
                                y1={py - 22}
                                x2={px}
                                y2={py + 22}
                                stroke={isEraser ? '#ef4444' : '#38bdf8'}
                                strokeWidth="10"
                                strokeOpacity="0.4"
                                strokeLinecap="round"
                              />
                            )}
                            <line
                              x1={px}
                              y1={py - 20}
                              x2={px}
                              y2={py + 20}
                              stroke={selectedColor}
                              strokeWidth="5"
                              strokeLinecap="round"
                            />
                          </g>
                        );
                      }

                      if (el.type === 'edge-d1') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <line
                                x1={px - 22}
                                y1={py + 22}
                                x2={px + 22}
                                y2={py - 22}
                                stroke={isEraser ? '#ef4444' : '#38bdf8'}
                                strokeWidth="10"
                                strokeOpacity="0.4"
                                strokeLinecap="round"
                              />
                            )}
                            <line
                              x1={px - 20}
                              y1={py + 20}
                              x2={px + 20}
                              y2={py - 20}
                              stroke={selectedColor}
                              strokeWidth="5"
                              strokeLinecap="round"
                            />
                          </g>
                        );
                      }

                      if (el.type === 'edge-d2') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <line
                                x1={px - 22}
                                y1={py - 22}
                                x2={px + 22}
                                y2={py + 22}
                                stroke={isEraser ? '#ef4444' : '#38bdf8'}
                                strokeWidth="10"
                                strokeOpacity="0.4"
                                strokeLinecap="round"
                              />
                            )}
                            <line
                              x1={px - 20}
                              y1={py - 20}
                              x2={px + 20}
                              y2={py + 20}
                              stroke={selectedColor}
                              strokeWidth="5"
                              strokeLinecap="round"
                            />
                          </g>
                        );
                      }

                      if (el.type === 'joint') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <circle
                                cx={px}
                                cy={py}
                                r="15"
                                fill={isEraser ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.3)'}
                                stroke={isEraser ? '#ef4444' : '#38bdf8'}
                                strokeWidth="2"
                              />
                            )}
                            <circle
                              cx={px}
                              cy={py}
                              r="9"
                              fill="#0f172a"
                              stroke="#38bdf8"
                              strokeWidth="2.5"
                            />
                            <circle cx={px} cy={py} r="3" fill="#38bdf8" />
                          </g>
                        );
                      }

                      if (el.type === 'muscle-left') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <circle
                                cx={px - 11}
                                cy={py + 6}
                                r="14"
                                fill={isEraser ? 'rgba(239, 68, 68, 0.25)' : 'rgba(244, 63, 94, 0.3)'}
                              />
                            )}
                            <path
                              d={`M ${px} ${py} Q ${px - 16} ${py + 12} ${px - 22} ${py}`}
                              fill="none"
                              stroke="#f43f5e"
                              strokeWidth="4"
                              strokeLinecap="round"
                            />
                          </g>
                        );
                      }

                      if (el.type === 'muscle-right') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <circle
                                cx={px + 11}
                                cy={py + 6}
                                r="14"
                                fill={isEraser ? 'rgba(239, 68, 68, 0.25)' : 'rgba(168, 85, 247, 0.3)'}
                              />
                            )}
                            <path
                              d={`M ${px} ${py} Q ${px + 16} ${py + 12} ${px + 22} ${py}`}
                              fill="none"
                              stroke="#a855f7"
                              strokeWidth="4"
                              strokeLinecap="round"
                            />
                          </g>
                        );
                      }

                      if (el.type === 'muscle-random-left') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <circle
                                cx={px - 11}
                                cy={py + 6}
                                r="14"
                                fill={isEraser ? 'rgba(239, 68, 68, 0.25)' : 'rgba(249, 115, 22, 0.3)'}
                              />
                            )}
                            <path
                              d={`M ${px} ${py} Q ${px - 16} ${py + 12} ${px - 22} ${py}`}
                              fill="none"
                              stroke="#f97316"
                              strokeWidth="4"
                              strokeDasharray="4 2"
                              strokeLinecap="round"
                            />
                            <text
                              x={px - 32}
                              y={py + 14}
                              fill="#f97316"
                              fontSize="9"
                              fontWeight="bold"
                            >
                              🎲{el.randomChance ?? 10}%
                            </text>
                          </g>
                        );
                      }

                      if (el.type === 'muscle-random-right') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <circle
                                cx={px + 11}
                                cy={py + 6}
                                r="14"
                                fill={isEraser ? 'rgba(239, 68, 68, 0.25)' : 'rgba(217, 70, 239, 0.3)'}
                              />
                            )}
                            <path
                              d={`M ${px} ${py} Q ${px + 16} ${py + 12} ${px + 22} ${py}`}
                              fill="none"
                              stroke="#d946ef"
                              strokeWidth="4"
                              strokeDasharray="4 2"
                              strokeLinecap="round"
                            />
                            <text
                              x={px + 16}
                              y={py + 14}
                              fill="#d946ef"
                              fontSize="9"
                              fontWeight="bold"
                            >
                              🎲{el.randomChance ?? 10}%
                            </text>
                          </g>
                        );
                      }
                      return null;
                    })}

                    {/* Dynamic Grid Intersection Interactive Touch/Click Nodes (-gridRadius .. +gridRadius) */}
                    {Array.from({ length: gridRadius * 2 + 1 }).flatMap((_, row) => {
                      const relY = row - gridRadius;
                      return Array.from({ length: gridRadius * 2 + 1 }).map((__, col) => {
                        const relX = col - gridRadius;
                        const px = 150 + relX * 40;
                        const py = 150 + relY * 40;

                        const hasElementsHere = elements.some(
                          (e) => e.relX === relX && e.relY === relY
                        );
                        const hasJointHere = elements.some(
                          (e) => e.type === 'joint' && e.relX === relX && e.relY === relY
                        );
                        const hasHeadHere = elements.some(
                          (e) => e.type === 'head' && e.relX === relX && e.relY === relY
                        );
                        const isMuscleTool = selectedTool.startsWith('muscle-');
                        const isJawTool = selectedTool === 'head-jaw';

                        return (
                          <g
                            key={`node-${relX}-${relY}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!hasMoved) handleNodeClick(relX, relY);
                            }}
                            className="cursor-pointer group"
                          >
                            {/* Special visual ring for joints when a muscle tool is active */}
                            {isMuscleTool && hasJointHere && (
                              <circle
                                cx={px}
                                cy={py}
                                r="18"
                                fill="rgba(56, 189, 248, 0.2)"
                                stroke="#38bdf8"
                                strokeWidth="1.5"
                                strokeDasharray="3 2"
                              />
                            )}

                            {/* Special visual ring for heads when jaw tool is active */}
                            {isJawTool && hasHeadHere && (
                              <circle
                                cx={px}
                                cy={py}
                                r="18"
                                fill="rgba(239, 68, 68, 0.2)"
                                stroke="#ef4444"
                                strokeWidth="1.5"
                                strokeDasharray="3 2"
                              />
                            )}

                            {/* Dot at Grid Node */}
                            <circle
                              cx={px}
                              cy={py}
                              r={hasElementsHere ? '3.5' : '2'}
                              fill={hasJointHere ? '#38bdf8' : hasHeadHere ? '#f59e0b' : hasElementsHere ? '#818cf8' : 'rgba(255, 255, 255, 0.35)'}
                              className="transition-transform group-hover:scale-150"
                            />

                            {/* Interactive Click Radius */}
                            <circle
                              cx={px}
                              cy={py}
                              r={16}
                              fill="transparent"
                              className={
                                (isMuscleTool && !hasJointHere) || (isJawTool && !hasHeadHere)
                                  ? 'group-hover:fill-red-500/20'
                                  : 'group-hover:fill-indigo-500/20'
                              }
                            />
                          </g>
                        );
                      });
                    })}
                  </svg>
                );
              })()}
            </div>







            {/* Notification / Toast Banner if user tries to attach muscle or jaw incorrectly */}
            {placementWarning && (
              <div className="w-full bg-amber-950/90 border border-amber-500/80 rounded-xl p-2.5 text-xs text-amber-200 flex items-center gap-2.5 shadow-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="flex-1 text-2xs font-semibold">{placementWarning}</div>
                <button
                  onClick={() => setPlacementWarning(null)}
                  className="text-amber-400 hover:text-amber-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Warning banner if jaws are unattached to heads */}
            {connectivity.unattachedJawIds.size > 0 && (
              <div className="w-full bg-red-950/90 border border-red-500/80 rounded-xl p-2.5 text-xs text-red-200 flex items-center justify-between gap-2.5 shadow-lg animate-pulse">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  <div>
                    <div className="font-bold text-red-300">Ошибка: Челюсть без головы!</div>
                    <div className="text-2xs text-red-200/90 mt-0.5">
                      {connectivity.unattachedJawIds.size === 1
                        ? '1 челюсть (🦷) установлена не на голову (👁️).'
                        : `${connectivity.unattachedJawIds.size} челюстей (🦷) установлены не на головы (👁️).`}
                      {' Челюсти можно устанавливать только на узел с головой.'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCleanUnattachedJaws}
                  className="px-2.5 py-1 text-2xs font-bold bg-red-800 hover:bg-red-700 text-red-100 rounded-lg transition shrink-0 shadow-sm"
                  title="Удалить все неприкрепленные челюсти и вернуть еду"
                >
                  ♻️ Удалить и вернуть еду
                </button>
              </div>
            )}

            {/* Warning banner if muscles are unattached to joints */}
            {connectivity.unattachedMuscleIds.size > 0 && (
              <div className="w-full bg-rose-950/90 border border-rose-500/80 rounded-xl p-2.5 text-xs text-rose-200 flex items-center justify-between gap-2.5 shadow-lg animate-pulse">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  <div>
                    <div className="font-bold text-rose-300">Ошибка: Мышцы без шарниров!</div>
                    <div className="text-2xs text-rose-200/90 mt-0.5">
                      {connectivity.unattachedMuscleIds.size === 1
                        ? '1 мышца установлена не на шарнир (◯).'
                        : `${connectivity.unattachedMuscleIds.size} мышц(ы) установлены не на шарниры (◯).`}
                      {' Мышцы должны крепиться строго к шарнирам.'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCleanUnattachedMuscles}
                  className="px-2.5 py-1 text-2xs font-bold bg-rose-800 hover:bg-rose-700 text-rose-100 rounded-lg transition shrink-0 shadow-sm"
                  title="Удалить все неприкрепленные мышцы и вернуть еду"
                >
                  ♻️ Удалить и вернуть еду
                </button>
              </div>
            )}

            {/* Warning banner if elements are disconnected */}
            {!connectivity.isConnected && (
              <div className="w-full bg-red-950/90 border border-red-500/80 rounded-xl p-2.5 text-xs text-red-200 flex items-center justify-between gap-2.5 shadow-lg animate-pulse">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  <div>
                    <div className="font-bold text-red-300">Ошибка конструкции: Оторванные элементы!</div>
                    <div className="text-2xs text-red-200/90 mt-0.5">
                      {connectivity.disconnectedIds.size === 1
                        ? '1 деталь оторвана от тела чудика.'
                        : `${connectivity.disconnectedIds.size} дет. оторваны от тела чудика.`}
                      {' Все элементы чудика должны быть соединены вместе.'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCleanDisconnected}
                  className="px-2.5 py-1 text-2xs font-bold bg-red-800 hover:bg-red-700 text-red-100 rounded-lg transition shrink-0 shadow-sm"
                  title="Удалить оторванные детали и вернуть за них еду"
                >
                  ♻️ Удалить оторванные
                </button>
              </div>
            )}

            {/* Compact Real-time Physics Readout Card */}
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-xs space-y-1.5 shadow-md">
              <div className="flex items-center justify-between font-bold flex-wrap gap-2 text-2xs">
                <span className="flex items-center gap-1 text-indigo-400" title="Общая масса M = sum(m_i)">
                  <Scale className="w-3.5 h-3.5" />
                  <span>Масса: {physics.totalMass.toFixed(1)}</span>
                </span>
                <span className="flex items-center gap-1 text-sky-400" title="Момент инерции вокруг центра масс по теореме Гюйгенса-Штейнера: I = sum(I_local + m*d^2)">
                  <span>📐 I: {physics.totalInertia.toFixed(2)}</span>
                </span>
                <span className="flex items-center gap-1 text-emerald-400" title="Скорость прямо пропорциональна тяге и обратно пропорциональна массе (v = Thrust / Mass)">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Скорость: {physics.forwardSpeed.toFixed(2)} кл/шаг</span>
                </span>
                <span className="flex items-center gap-1 text-amber-400" title="Угловая скорость w = (Torque / I) * C">
                  <span>🔄 Разворот: {Math.abs(physics.netRotationDeg).toFixed(1)}°/шаг</span>
                </span>
              </div>
              <div className="text-3xs text-slate-400 font-mono flex items-center justify-between border-t border-slate-800/80 pt-1 flex-wrap gap-1">
                <span>CoM (ЦМ): ({physics.centerOfMassX?.toFixed(2) ?? '0.00'}, {physics.centerOfMassY?.toFixed(2) ?? '0.00'})</span>
                <span>Плечи: L:{physics.leftMass.toFixed(1)} / R:{physics.rightMass.toFixed(1)}</span>
                <span>Тяга мышц: L:{physics.leftTorque.toFixed(1)} / R:{physics.rightTorque.toFixed(1)}</span>
              </div>
            </div>

            {/* List of Placed Elements with Individual Controls & Deletion */}
            <div className="w-full mt-3 bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 max-h-36 overflow-y-auto">
              <div className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1 flex items-center justify-between">
                <span>Размещенные элементы ({elements.length}):</span>
                <span className="text-slate-500 font-normal">Нажмите 🗑️ для удаления</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {elements.map((el) => {
                  const toolDef = ELEMENT_TOOLS.find((t) => t.type === el.type);
                  const isHovered = hoveredElementId === el.id;
                  const isSelected = selectedElementId === el.id;
                  const isDisconnected = connectivity.disconnectedIds.has(el.id);
                  const isUnattachedMuscle = connectivity.unattachedMuscleIds.has(el.id);

                  return (
                    <div
                      key={el.id}
                      onMouseEnter={() => setHoveredElementId(el.id)}
                      onMouseLeave={() => setHoveredElementId(null)}
                      className={`flex items-center justify-between border rounded-lg px-2 py-1 text-2xs transition ${
                        isDisconnected || isUnattachedMuscle
                          ? 'bg-red-950/60 border-red-500/80 text-red-200 shadow-xs'
                          : isHovered || isSelected
                          ? 'bg-indigo-950/70 border-indigo-500/80 text-indigo-200 shadow-xs'
                          : 'bg-slate-800/90 border-slate-700/60 text-slate-200'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5 font-mono">
                        <span className="font-bold text-indigo-400">{toolDef?.symbol || '•'}</span>
                        <span className="font-semibold">{toolDef?.label.split(' ')[0]}</span>
                        <span className="text-slate-400">({el.relX},{el.relY})</span>
                        {isDisconnected && (
                          <span className="px-1 py-0.2 bg-red-900/90 border border-red-500/80 text-red-200 rounded text-3xs font-bold" title="Элемент оторван от тела!">
                            ⚠️ Оторван
                          </span>
                        )}
                        {isUnattachedMuscle && (
                          <span className="px-1 py-0.2 bg-rose-900/90 border border-rose-500/80 text-rose-200 rounded text-3xs font-bold" title="Мышца должна быть на шарнире!">
                            ⚠️ Без шарнира
                          </span>
                        )}
                      </span>

                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {/* Special controls for Head / Predator Jaw: Rotate button */}
                        {(el.type === 'head' || el.type === 'head-jaw') && (
                          <button
                            onClick={() => handleRotateHead(el.id)}
                            className={`flex items-center gap-0.5 px-1 py-0.5 rounded font-bold transition border ${
                              el.type === 'head-jaw'
                                ? 'bg-red-950/80 border-red-500/40 hover:bg-red-900/90 text-red-300'
                                : 'bg-amber-950/80 border-amber-500/40 hover:bg-amber-900/90 text-amber-300'
                            }`}
                            title="Повернуть направление на 90°"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>{el.headAngle === 270 ? '⬆️' : el.headAngle === 0 ? '➡️' : el.headAngle === 90 ? '⬇️' : '⬅️'}</span>
                          </button>
                        )}

                        {/* Special controls for Random Muscles: - / + Chance */}
                        {(el.type === 'muscle-random-left' || el.type === 'muscle-random-right') && (
                          <div className="flex items-center gap-1 bg-slate-900 px-1 py-0.5 rounded border border-slate-700 font-mono">
                            <button
                              onClick={() => handleChangeRandomChance(el.id, -2)}
                              className="px-1 hover:bg-slate-700 text-slate-300 rounded"
                              title="Уменьшить шанс (-2%)"
                            >
                              -
                            </button>
                            <span className="text-orange-400 font-bold">{el.randomChance ?? 10}%</span>
                            <button
                              onClick={() => handleChangeRandomChance(el.id, 2)}
                              className="px-1 hover:bg-slate-700 text-slate-300 rounded"
                              title="Увеличить шанс (+2%)"
                            >
                              +
                            </button>
                          </div>
                        )}

                        {/* Trash / Delete button with refund info */}
                        <button
                          onClick={() => handleDeleteElement(el.id)}
                          className="text-slate-400 hover:text-red-400 hover:bg-red-950/50 p-1 rounded transition flex items-center gap-0.5"
                          title={`Удалить деталь и вернуть +${getElementPrice(el.type)} еды в доступный баланс`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Clear Button */}
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-1 text-xs text-slate-400 hover:text-red-400 transition"
                title="Очистить все детали и вернуть их полную стоимость"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Очистить всю конструкцию</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between flex-wrap gap-3 flex-none">
          <div className="flex items-center gap-3 text-xs font-mono flex-wrap">
            <span className="text-slate-400">
              Элементов: {elements.length}
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1">
              <span className="text-slate-400">Стоимость:</span>
              <span className="text-indigo-300 font-bold font-mono">
                💰 {currentElementsCost} еды
              </span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1">
              <span className="text-slate-400">Доступно очков:</span>
              <strong className={canAfford ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {availableFood} еды
              </strong>
            </span>
            {costDiff !== 0 && (
              <>
                <span className="text-slate-600">•</span>
                <span className={costDiff < 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {costDiff < 0 ? `♻️ Возврат в банк: +${-costDiff} еды` : `💳 Списание из банка: -${costDiff} еды`}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition"
            >
              Отмена
            </button>
            {token && onSaveToDB && (
              <button
                onClick={() => {
                  if (elements.length > 0 && connectivity.isValid) {
                    onSaveToDB(name, elements, selectedColor);
                  }
                }}
                disabled={elements.length === 0 || !connectivity.isValid}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 rounded-xl transition disabled:opacity-50"
                title="Сохранить в базу данных персональной коллекции"
              >
                <span>💾 Сохранить в БД</span>
              </button>
            )}
            <button
              onClick={handleSaveAndSpawn}
              disabled={elements.length === 0 || !connectivity.isValid || !canAfford}
              title={
                !connectivity.isConnected
                  ? 'Все детали чудика должны быть соединены вместе (нельзя оставлять элементы в воздухе)!'
                  : connectivity.unattachedMuscleIds.size > 0
                  ? 'Мышцы должны крепиться только к шарнирам (◯)!'
                  : !canAfford
                  ? `Недостаточно еды (доступно: ${availableFood}). Удалите часть элементов для возврата очков.`
                  : ''
              }
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-900/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingCreature ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>
                {IS_UNLIMITED_MODE
                  ? (editingCreature ? 'Сохранить (Безлимит 0 еды)' : 'Создать (Безлимит 0 еды)')
                  : editingCreature
                  ? costDiff > 0
                    ? `Сохранить (-${costDiff} еды)`
                    : costDiff < 0
                    ? `Сохранить (+${-costDiff} еды в банк)`
                    : 'Сохранить изменения'
                  : costDiff > 0
                  ? `Создать (-${costDiff} еды)`
                  : 'Создать (Бесплатно)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
