import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Creature, Food, GridTheme, Point, PendingPlacement } from '../types';
import { determineCreatureHeadAngle, isRandomMuscleTriggered, getRandomMuscleState, calculateKinematicBends, getCreatureElementWorldPositions, getBaseBounds, isInsideBase } from '../utils/creatures';
import { ZoomIn, ZoomOut, Maximize2, RotateCw, RotateCcw, X, Crosshair, Compass, Gamepad2, ArrowUp, ChevronDown, ChevronUp, Zap, Shield } from 'lucide-react';

interface GridCanvasProps {
  creatures: Creature[];
  foods: Food[];
  selectedCreatureId: string | null;
  selectedCreatureName?: string | null;
  focusTimestamp?: number;
  gridTheme: GridTheme;
  showNodes: boolean;
  pendingPlacement: PendingPlacement | null;
  worldRadius?: number;
  isSpacePressed?: boolean;
  isBraking?: boolean;
  onSetSpacePressed?: (pressed: boolean) => void;
  onToggleBrake?: () => void;
  onNodeClick: (x: number, y: number, isRightClick: boolean) => void;
  onSelectCreature: (id: string | null) => void;
  onPlaceCreature: (x: number, y: number, angleDeg: number) => void;
  onCancelPlacement: () => void;
  onChangePlacementAngle: (angleDeg: number) => void;
  onTurnPlayer?: (dir: 'left' | 'right') => void;
  onMovePlayerForward?: () => void;
}

const GridCanvasComponent: React.FC<GridCanvasProps> = ({
  creatures = [],
  foods = [],
  selectedCreatureId,
  selectedCreatureName,
  focusTimestamp,
  gridTheme,
  showNodes,
  pendingPlacement,
  worldRadius = 50,
  isSpacePressed = false,
  isBraking = false,
  onSetSpacePressed,
  onToggleBrake,
  onNodeClick,
  onSelectCreature,
  onPlaceCreature,
  onCancelPlacement,
  onChangePlacementAngle,
  onTurnPlayer,
  onMovePlayerForward,
}) => {
  const halfWorld = worldRadius;
  const worldSize = worldRadius * 2;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pan, zoom and placement state
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [hoverGridPos, setHoverGridPos] = useState<Point | null>(null);
  const [isPlayerHudCollapsed, setIsPlayerHudCollapsed] = useState<boolean>(false);
  const [isHintHidden, setIsHintHidden] = useState<boolean>(false);

  const [isCameraLocked, setIsCameraLocked] = useState<boolean>(true);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const lastOffsetRef = useRef<Point>({ x: 0, y: 0 });

  const CELL_SIZE = 40; // Base distance between grid nodes in pixels

  const activeOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const animStatesRef = useRef<Map<string, { displayX: number; displayY: number; displayAngle: number; muscleAnimStep: number }>>(new Map());
  const cameraOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const lastRenderTimeRef = useRef<number>(performance.now());

  // Trail history and boost particles system
  const trailsRef = useRef<Map<string, Array<{ x: number; y: number; angleDeg: number; color: string; isDashing: boolean; time: number }>>>(new Map());
  const boostParticlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; type: 'flame' | 'spark' | 'ink' | 'shockwave' }>>([]);
  const smoothedHudYRef = useRef<Map<string, number>>(new Map());
  const isSpacePressedRef = useRef<boolean>(isSpacePressed);
  isSpacePressedRef.current = isSpacePressed;
  const isBrakingRef = useRef<boolean>(isBraking);
  isBrakingRef.current = isBraking;

  const creaturesRef = useRef(creatures);
  const foodsRef = useRef(foods);
  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);
  const gridThemeRef = useRef(gridTheme);
  const showNodesRef = useRef(showNodes);
  const selectedCreatureIdRef = useRef(selectedCreatureId);
  const pendingPlacementRef = useRef(pendingPlacement);
  const isCameraLockedRef = useRef(isCameraLocked);
  const worldRadiusRef = useRef(worldRadius);

  // Synchronize refs synchronously on every render so requestAnimationFrame always has fresh data
  creaturesRef.current = creatures;
  foodsRef.current = foods;
  zoomRef.current = zoom;
  offsetRef.current = offset;
  gridThemeRef.current = gridTheme;
  showNodesRef.current = showNodes;
  selectedCreatureIdRef.current = selectedCreatureId;
  pendingPlacementRef.current = pendingPlacement;
  isCameraLockedRef.current = isCameraLocked;
  worldRadiusRef.current = worldRadius;

  // Center canvas on load or on active creature inside base
  useEffect(() => {
    if (canvasRef.current) {
      const { width, height } = canvasRef.current.getBoundingClientRect();
      const target = creatures.find((c) => c.id === selectedCreatureId) || creatures[0];
      if (target) {
        setOffset({
          x: width / 2 - target.x * CELL_SIZE * zoom,
          y: height / 2 - target.y * CELL_SIZE * zoom,
        });
      } else {
        const baseBounds = getBaseBounds(worldRadius);
        const centerX = (baseBounds.minX + baseBounds.maxX) / 2;
        const centerY = (baseBounds.minY + baseBounds.maxY) / 2;
        setOffset({
          x: width / 2 - centerX * CELL_SIZE * zoom,
          y: height / 2 - centerY * CELL_SIZE * zoom,
        });
      }
    }
  }, [selectedCreatureId]);

  const hoverGridPosRef = useRef<Point | null>(null);

  // Center view on selected creature whenever selection or focusTimestamp changes
  useEffect(() => {
    if (selectedCreatureId && canvasRef.current) {
      setIsCameraLocked(true);
      const target = (creaturesRef.current || []).find((c) => c.id === selectedCreatureId);
      if (target) {
        const animState = animStatesRef.current.get(selectedCreatureId);
        const tx = animState ? animState.displayX : target.x;
        const ty = animState ? animState.displayY : target.y;
        const width = canvasRef.current.width || canvasRef.current.clientWidth;
        const height = canvasRef.current.height || canvasRef.current.clientHeight;
        const newOffset = {
          x: width / 2 - tx * CELL_SIZE * zoom,
          y: height / 2 - ty * CELL_SIZE * zoom,
        };
        setOffset(newOffset);
        cameraOffsetRef.current = newOffset;
      }
    }
  }, [selectedCreatureId, focusTimestamp, zoom]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const parent = canvasRef.current.parentElement;
        if (parent) {
          canvasRef.current.width = parent.clientWidth;
          canvasRef.current.height = parent.clientHeight;
        }
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcut 'R' for rotating placement orientation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pendingPlacement) return;
      if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
        e.preventDefault();
        const nextAngle = (pendingPlacement.angleDeg + 45) % 360;
        onChangePlacementAngle(nextAngle);
      } else if (e.key === 'Escape') {
        onCancelPlacement();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingPlacement, onChangePlacementAngle, onCancelPlacement]);

  // Mouse to Grid coordinate conversion
  const screenToGrid = useCallback(
    (screenX: number, screenY: number): Point => {
      const curOffset = activeOffsetRef.current;
      const worldX = (screenX - curOffset.x) / zoom;
      const worldY = (screenY - curOffset.y) / zoom;
      return {
        x: Math.round(worldX / CELL_SIZE),
        y: Math.round(worldY / CELL_SIZE),
      };
    },
    [zoom]
  );

  // Grid to Screen coordinate conversion
  const gridToScreen = useCallback(
    (gridX: number, gridY: number): Point => {
      const curOffset = activeOffsetRef.current;
      return {
        x: curOffset.x + gridX * CELL_SIZE * zoom,
        y: curOffset.y + gridY * CELL_SIZE * zoom,
      };
    },
    [zoom]
  );

  // Mouse & Drag handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Right button (2), Middle button (1), or Shift+Left -> Drag/Pan view
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      isDraggingRef.current = true;
      setIsCameraLocked(false);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      lastOffsetRef.current = { ...activeOffsetRef.current };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const gridPos = screenToGrid(mouseX, mouseY);
      hoverGridPosRef.current = gridPos;
      if (pendingPlacementRef.current) {
        setHoverGridPos(gridPos);
      }
    }

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setOffset({
        x: lastOffsetRef.current.x + dx,
        y: lastOffsetRef.current.y + dy,
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      const distMoved = Math.hypot(
        e.clientX - dragStartRef.current.x,
        e.clientY - dragStartRef.current.y
      );
      isDraggingRef.current = false;
      if (distMoved > 3) {
        return;
      }
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const gridPos = screenToGrid(mouseX, mouseY);

    if (e.button === 0) {
      // If Placement Mode is active, place creature at this position
      if (pendingPlacement) {
        onPlaceCreature(gridPos.x, gridPos.y, pendingPlacement.angleDeg);
        return;
      }

      let bestMatch: { creatureId: string; distance: number } | null = null;

      for (const creature of creatures) {
        // Distance to creature center
        const centerDistGrid = Math.hypot(creature.x - gridPos.x, creature.y - gridPos.y);
        const centerDistScreen = Math.hypot(
          gridToScreen(creature.x, creature.y).x - mouseX,
          gridToScreen(creature.x, creature.y).y - mouseY
        );

        let minGridDist = centerDistGrid;

        // Also check distance to any element of the creature
        const elementPts = getCreatureElementWorldPositions(
          creature.x,
          creature.y,
          creature.angleDeg,
          creature.elements,
          creature.muscleStep,
          creature.forces
        );

        for (const pt of elementPts) {
          const ptDist = Math.hypot(pt.x - gridPos.x, pt.y - gridPos.y);
          if (ptDist < minGridDist) {
            minGridDist = ptDist;
          }
        }

        // Threshold: within 1.2 grid cells or 35px screen distance
        const maxScreenDistThreshold = Math.max(35, 1.2 * CELL_SIZE * zoom);
        const minScreenDist = minGridDist * CELL_SIZE * zoom;

        if (minScreenDist < maxScreenDistThreshold || centerDistScreen < 35) {
          const effectiveDist = Math.min(minScreenDist, centerDistScreen);
          if (!bestMatch || effectiveDist < bestMatch.distance) {
            bestMatch = { creatureId: creature.id, distance: effectiveDist };
          }
        }
      }

      if (bestMatch) {
        onSelectCreature(bestMatch.creatureId);
      } else {
        onNodeClick(gridPos.x, gridPos.y, false);
      }
    } else if (e.button === 2) {
      // Right click cancels placement / releases captured creature
      if (pendingPlacement) {
        onCancelPlacement();
        return;
      }

      // Right click deselects creature / releases camera focus
      if (selectedCreatureId) {
        onSelectCreature(null);
      }

      onNodeClick(gridPos.x, gridPos.y, true);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Non-passive wheel event listener for zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;

      setZoom((prevZoom) => {
        const newZoom = Math.max(0.3, Math.min(3.5, prevZoom * zoomFactor));
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setOffset((prevOffset) => ({
          x: mouseX - (mouseX - prevOffset.x) * (newZoom / prevZoom),
          y: mouseY - (mouseY - prevOffset.y) * (newZoom / prevZoom),
        }));

        return newZoom;
      });
    };

    canvas.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  // Reset View handler
  const handleResetView = () => {
    setZoom(1);
    if (canvasRef.current) {
      setOffset({
        x: canvasRef.current.width / 2,
        y: canvasRef.current.height / 2,
      });
    }
  };

  // Main Canvas Render Loop (Runs continuously at 60+ FPS via requestAnimationFrame without tearing down)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      const currentZoom = zoomRef.current;
      const currentGridTheme = gridThemeRef.current;
      const currentSelectedId = selectedCreatureIdRef.current;
      const currentPendingPlacement = pendingPlacementRef.current;
      const currentShowNodes = showNodesRef.current;
      const currentIsCameraLocked = isCameraLockedRef.current;

      // Theme Colors
      const isGameTheme = currentGridTheme === 'game' || currentGridTheme === 'game-light';

      let bgColor = '#090d16';
      let gridLineColor = 'rgba(255, 255, 255, 0.1)';
      let nodeDotColor = 'rgba(255, 255, 255, 0.3)';
      let mainInkColor = '#f1f5f9';

      if (currentGridTheme === 'notebook') {
        bgColor = '#fafaf9';
        gridLineColor = 'rgba(59, 130, 246, 0.22)';
        nodeDotColor = 'rgba(30, 58, 138, 0.4)';
        mainInkColor = '#1e293b';
      } else if (currentGridTheme === 'blueprint') {
        bgColor = '#0f172a';
        gridLineColor = 'rgba(56, 189, 248, 0.25)';
        nodeDotColor = '#38bdf8';
        mainInkColor = '#e0f2fe';
      } else if (currentGridTheme === 'game') {
        bgColor = '#0a0d1d';
        gridLineColor = 'rgba(168, 85, 247, 0.22)';
        nodeDotColor = '#ec4899';
        mainInkColor = '#ffffff';
      } else if (currentGridTheme === 'game-light') {
        bgColor = '#f0fdf4';
        gridLineColor = 'rgba(236, 72, 153, 0.22)';
        nodeDotColor = '#8b5cf6';
        mainInkColor = '#0f172a';
      }

      // Background fill
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      const now = performance.now();
      const dt = lastRenderTimeRef.current ? Math.min((now - lastRenderTimeRef.current) / 1000, 0.1) : 0.016;
      lastRenderTimeRef.current = now;

      const animMap = animStatesRef.current;
      const currentCreatures = creaturesRef.current || [];

      // Smoothly update display states for all creatures frame-by-frame
      currentCreatures.forEach((creature) => {
        let state = animMap.get(creature.id);
        if (!state) {
          state = {
            displayX: creature.x,
            displayY: creature.y,
            displayAngle: creature.angleDeg,
            muscleAnimStep: creature.muscleStep,
          };
          animMap.set(creature.id, state);
        } else {
          // Calculate target with toroidal wrap
          let targetX = creature.x;
          let targetY = creature.y;
          let targetAngle = creature.angleDeg;

          let dx = targetX - state.displayX;
          if (dx > halfWorld) targetX -= worldSize;
          if (dx < -halfWorld) targetX += worldSize;

          let dy = targetY - state.displayY;
          if (dy > halfWorld) targetY -= worldSize;
          if (dy < -halfWorld) targetY += worldSize;

          if (Math.abs(targetX - state.displayX) > halfWorld / 2) {
            state.displayX = creature.x;
            targetX = creature.x;
          }
          if (Math.abs(targetY - state.displayY) > halfWorld / 2) {
            state.displayY = creature.y;
            targetY = creature.y;
          }

          const lerpFactor = 1 - Math.exp(-22 * dt);

          state.displayX += (targetX - state.displayX) * lerpFactor;
          state.displayY += (targetY - state.displayY) * lerpFactor;

          if (state.displayX > halfWorld) state.displayX -= worldSize;
          if (state.displayX < -halfWorld) state.displayX += worldSize;
          if (state.displayY > halfWorld) state.displayY -= worldSize;
          if (state.displayY < -halfWorld) state.displayY += worldSize;

          let angleDiff = targetAngle - state.displayAngle;
          while (angleDiff > 180) angleDiff -= 360;
          while (angleDiff < -180) angleDiff += 360;

          state.displayAngle += angleDiff * lerpFactor;
          state.displayAngle = (state.displayAngle + 360) % 360;

          const distToTarget = Math.hypot(targetX - state.displayX, targetY - state.displayY);
          if (creature.state === 'moving' || creature.state === 'dashing' || distToTarget > 0.05) {
            state.muscleAnimStep += dt * 5.0;
          } else {
            state.muscleAnimStep = creature.muscleStep + Math.sin(now / 350) * 0.3;
          }
        }
      });

      // Compute effective camera offset with smooth lerp tracking
      let currentOffset = offsetRef.current;
      if (currentSelectedId && currentIsCameraLocked && !isDraggingRef.current) {
        const selectedAnimState = animMap.get(currentSelectedId);
        const targetCreature = currentCreatures.find((c) => c.id === currentSelectedId);
        if (selectedAnimState || targetCreature) {
          const targetX = selectedAnimState ? selectedAnimState.displayX : targetCreature!.x;
          const targetY = selectedAnimState ? selectedAnimState.displayY : targetCreature!.y;

          const targetCamX = width / 2 - targetX * CELL_SIZE * currentZoom;
          const targetCamY = height / 2 - targetY * CELL_SIZE * currentZoom;

          if (!cameraOffsetRef.current || (cameraOffsetRef.current.x === 0 && cameraOffsetRef.current.y === 0)) {
            cameraOffsetRef.current = { x: targetCamX, y: targetCamY };
          } else {
            const camLerp = 1 - Math.exp(-12 * dt);
            cameraOffsetRef.current.x += (targetCamX - cameraOffsetRef.current.x) * camLerp;
            cameraOffsetRef.current.y += (targetCamY - cameraOffsetRef.current.y) * camLerp;
          }
          currentOffset = cameraOffsetRef.current;
        }
      } else {
        cameraOffsetRef.current = { ...offsetRef.current };
        currentOffset = offsetRef.current;
      }
      activeOffsetRef.current = currentOffset;

      // Render Grid Lines
      const scaledCell = CELL_SIZE * currentZoom;
      const startX = Math.floor((-currentOffset.x) / scaledCell) - 1;
      const endX = Math.ceil((width - currentOffset.x) / scaledCell) + 1;
      const startY = Math.floor((-currentOffset.y) / scaledCell) - 1;
      const endY = Math.ceil((height - currentOffset.y) / scaledCell) + 1;

      ctx.beginPath();
      ctx.strokeStyle = gridLineColor;
      ctx.lineWidth = Math.max(1, 1.2 * currentZoom);

      for (let x = startX; x <= endX; x++) {
        const screenX = currentOffset.x + x * scaledCell;
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, height);
      }
      for (let y = startY; y <= endY; y++) {
        const screenY = currentOffset.y + y * scaledCell;
        ctx.moveTo(0, screenY);
        ctx.lineTo(width, screenY);
      }
      ctx.stroke();

      // Render Grid Intersections / Nodes
      if (currentShowNodes) {
        ctx.fillStyle = nodeDotColor;
        const dotRadius = Math.max(1.5, 2.5 * currentZoom);
        ctx.beginPath();
        for (let x = startX; x <= endX; x++) {
          const screenX = currentOffset.x + x * scaledCell;
          for (let y = startY; y <= endY; y++) {
            const screenY = currentOffset.y + y * scaledCell;
            ctx.moveTo(screenX + dotRadius, screenY);
            ctx.arc(screenX, screenY, dotRadius, 0, Math.PI * 2);
          }
        }
        ctx.fill();
      }

      // Render Field Arena Border Frame (Fast layered stroke, no expensive shadowBlur)
      const arenaTopLeft = {
        x: currentOffset.x + (-halfWorld) * scaledCell,
        y: currentOffset.y + (-halfWorld) * scaledCell,
      };
      const arenaW = worldSize * scaledCell;
      const arenaH = worldSize * scaledCell;

      const arenaColor = isGameTheme ? '#ec4899' : (currentGridTheme === 'blueprint' ? '#38bdf8' : '#3b82f6');
      ctx.save();
      ctx.strokeStyle = arenaColor + '33';
      ctx.lineWidth = Math.max(6, 10 * currentZoom);
      ctx.strokeRect(arenaTopLeft.x, arenaTopLeft.y, arenaW, arenaH);

      ctx.strokeStyle = arenaColor;
      ctx.lineWidth = Math.max(2, 3.5 * currentZoom);
      ctx.strokeRect(arenaTopLeft.x, arenaTopLeft.y, arenaW, arenaH);
      ctx.restore();

      // Render Safe Zone (БАЗА / Safe Zone in bottom-right corner)
      const baseBounds = getBaseBounds(halfWorld);
      const baseTopLeft = {
        x: currentOffset.x + baseBounds.minX * scaledCell,
        y: currentOffset.y + baseBounds.minY * scaledCell,
      };
      const baseWidth = baseBounds.size * scaledCell;
      const baseHeight = baseBounds.size * scaledCell;

      ctx.save();
      // Floor tint
      ctx.fillStyle = isGameTheme ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.08)';
      ctx.fillRect(baseTopLeft.x, baseTopLeft.y, baseWidth, baseHeight);

      // Left, Bottom, Right protective perimeter borders (dashed)
      ctx.strokeStyle = isGameTheme ? 'rgba(16, 185, 129, 0.7)' : 'rgba(14, 165, 233, 0.7)';
      ctx.lineWidth = Math.max(2, 3 * currentZoom);
      ctx.setLineDash([8 * currentZoom, 5 * currentZoom]);
      ctx.beginPath();
      // Left side
      ctx.moveTo(baseTopLeft.x, baseTopLeft.y);
      ctx.lineTo(baseTopLeft.x, baseTopLeft.y + baseHeight);
      // Bottom side
      ctx.lineTo(baseTopLeft.x + baseWidth, baseTopLeft.y + baseHeight);
      // Right side
      ctx.lineTo(baseTopLeft.x + baseWidth, baseTopLeft.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // =========================================================================
      // BRIGHT ONE-WAY TOP WALL (ЯРКАЯ СТЕНА: ВХОД СВЕРХУ ↓ / БЛОК СНИЗУ ⛔)
      // =========================================================================
      const wallY = baseTopLeft.y;
      const wallStartX = baseTopLeft.x;
      const wallEndX = baseTopLeft.x + baseWidth;
      const wallPulse = Math.sin(now / 130) * 0.25 + 0.75;
      const wallFastPulse = Math.sin(now / 70) * 0.15 + 0.85;

      // Layer 1: Wide Electric Cyan Glow
      ctx.beginPath();
      ctx.moveTo(wallStartX, wallY);
      ctx.lineTo(wallEndX, wallY);
      ctx.strokeStyle = isGameTheme
        ? `rgba(6, 182, 212, ${0.45 * wallPulse})`
        : `rgba(56, 189, 248, ${0.45 * wallPulse})`;
      ctx.lineWidth = Math.max(12, 18 * currentZoom);
      ctx.lineCap = 'round';
      ctx.stroke();

      // Layer 2: Vibrant Neon Plasma Barrier
      ctx.beginPath();
      ctx.moveTo(wallStartX, wallY);
      ctx.lineTo(wallEndX, wallY);
      ctx.strokeStyle = isGameTheme ? '#06b6d4' : '#0ea5e9';
      ctx.lineWidth = Math.max(5, 7 * currentZoom * wallFastPulse);
      ctx.stroke();

      // Layer 3: Laser Core
      ctx.beginPath();
      ctx.moveTo(wallStartX, wallY);
      ctx.lineTo(wallEndX, wallY);
      ctx.strokeStyle = '#a5f3fc';
      ctx.lineWidth = Math.max(2.5, 3.5 * currentZoom);
      ctx.stroke();

      // Layer 4: Hot White Center Filament
      ctx.beginPath();
      ctx.moveTo(wallStartX, wallY);
      ctx.lineTo(wallEndX, wallY);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.2, 1.8 * currentZoom);
      ctx.stroke();

      // Animated Downward Directional Flow Chevrons (indicating One-Way Entrance from Top)
      const arrowStep = Math.max(24, 32 * currentZoom);
      const arrowCount = Math.floor(baseWidth / arrowStep);
      const flowCycle = ((now / 20) % 16) / 16; // 0 to 1 cycle

      for (let ai = 1; ai < arrowCount; ai++) {
        const arrowX = wallStartX + ai * arrowStep;
        const arrowYOffset = flowCycle * 14 * currentZoom;
        const arrowY = wallY + arrowYOffset;
        const arrowAlpha = Math.sin(flowCycle * Math.PI) * 0.85;

        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.fillStyle = isGameTheme
          ? `rgba(34, 211, 238, ${arrowAlpha})`
          : `rgba(56, 189, 248, ${arrowAlpha})`;
        ctx.strokeStyle = `rgba(255, 255, 255, ${arrowAlpha * 0.9})`;
        ctx.lineWidth = Math.max(1, 1.5 * currentZoom);

        // Small stylish downward chevron
        const aw = 4 * currentZoom;
        const ah = 4 * currentZoom;
        ctx.beginPath();
        ctx.moveTo(-aw, -ah);
        ctx.lineTo(0, ah);
        ctx.lineTo(aw, -ah);
        ctx.stroke();
        ctx.restore();
      }

      // Energy Emitter Pylons at wall ends
      [wallStartX, wallEndX].forEach((pylonX) => {
        // Outer halo
        ctx.beginPath();
        ctx.arc(pylonX, wallY, (8 + wallPulse * 3) * currentZoom, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
        ctx.fill();

        // Solid diamond node
        ctx.beginPath();
        const pSize = 5 * currentZoom;
        ctx.moveTo(pylonX, wallY - pSize);
        ctx.lineTo(pylonX + pSize, wallY);
        ctx.lineTo(pylonX, wallY + pSize);
        ctx.lineTo(pylonX - pSize, wallY);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.8 * currentZoom;
        ctx.stroke();
      });

      // Wall Badge / Title Tag in center
      const badgeCenterX = wallStartX + baseWidth / 2;
      const badgeCenterY = wallY - 14 * currentZoom;
      const badgeText = '⚡ ВХОД СВЕРХУ ↓ (БЛОК ИЗНУТРИ ⛔)';
      ctx.font = `bold ${Math.max(10, 11 * currentZoom)}px system-ui, sans-serif`;
      const textMetrics = ctx.measureText(badgeText);
      const textW = textMetrics.width;
      const padX = 8 * currentZoom;
      const padY = 3.5 * currentZoom;

      // Badge background pill
      ctx.fillStyle = isGameTheme ? 'rgba(8, 51, 68, 0.92)' : 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = Math.max(1.2, 1.8 * currentZoom);
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(badgeCenterX - textW / 2 - padX, badgeCenterY - 7 * currentZoom - padY, textW + padX * 2, 14 * currentZoom + padY * 2, 6 * currentZoom);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(badgeCenterX - textW / 2 - padX, badgeCenterY - 7 * currentZoom - padY, textW + padX * 2, 14 * currentZoom + padY * 2);
        ctx.strokeRect(badgeCenterX - textW / 2 - padX, badgeCenterY - 7 * currentZoom - padY, textW + padX * 2, 14 * currentZoom + padY * 2);
      }

      ctx.fillStyle = '#22d3ee';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeCenterX, badgeCenterY);

      // Base Zone Info Label inside the base
      const baseLabel = '🛡️ БАЗА / SAFE ZONE';
      const subLabel = 'Иммунитет • Вход сверху через яркую стену • Депозит в Банк';
      ctx.font = `bold ${Math.max(12, 14 * currentZoom)}px system-ui, sans-serif`;
      ctx.fillStyle = isGameTheme ? '#34d399' : '#38bdf8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(baseLabel, baseTopLeft.x + 12 * currentZoom, baseTopLeft.y + 14 * currentZoom);

      ctx.font = `bold ${Math.max(9, 10.5 * currentZoom)}px monospace`;
      ctx.fillStyle = isGameTheme ? 'rgba(167, 243, 208, 0.85)' : 'rgba(186, 230, 253, 0.85)';
      ctx.fillText(subLabel, baseTopLeft.x + 12 * currentZoom, baseTopLeft.y + 34 * currentZoom);
      ctx.restore();

      // Render Food on nodes
      const nowTime = Date.now();
      const currentFoods = foodsRef.current || [];
      currentFoods.forEach((food) => {
        const pos = {
          x: currentOffset.x + food.x * scaledCell,
          y: currentOffset.y + food.y * scaledCell,
        };
        ctx.save();
        ctx.translate(pos.x, pos.y);

        const pulse = Math.sin(nowTime / 200 + food.x + food.y) * 2;
        const foodRadius = (6 + pulse) * currentZoom;

        if (isGameTheme) {
          const glowR = foodRadius * 2.2;
          const mainColor = food.type === 'golden' ? '#facc15' : (food.type === 'super' ? '#ec4899' : '#10b981');

          // Glowing aura
          ctx.fillStyle = mainColor + '44';
          ctx.beginPath();
          ctx.arc(0, 0, glowR, 0, Math.PI * 2);
          ctx.fill();

          // Shiny 3D candy sphere
          ctx.beginPath();
          ctx.arc(0, 0, foodRadius, 0, Math.PI * 2);
          ctx.fillStyle = mainColor;
          ctx.fill();

          // Shadow overlay
          ctx.beginPath();
          ctx.arc(0, foodRadius * 0.15, foodRadius * 0.85, 0, Math.PI);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
          ctx.fill();

          // White specular highlight
          ctx.beginPath();
          ctx.arc(-foodRadius * 0.3, -foodRadius * 0.3, foodRadius * 0.35, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.fill();
        } else {
          if (food.type === 'golden') {
            ctx.fillStyle = 'rgba(234, 179, 8, 0.25)';
            ctx.beginPath();
            ctx.arc(0, 0, foodRadius * 1.6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#eab308';
          } else if (food.type === 'super') {
            ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
            ctx.beginPath();
            ctx.arc(0, 0, foodRadius * 1.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#a855f7';
          } else {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
            ctx.beginPath();
            ctx.arc(0, 0, foodRadius * 1.4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#10b981';
          }

          ctx.beginPath();
          ctx.arc(0, 0, foodRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = mainInkColor;
          ctx.lineWidth = 1.5 * currentZoom;
          ctx.stroke();
        }

        ctx.restore();
      });

      // --- TRAIL & BOOST PARTICLES SYSTEM (Phase: Wake Trail & Boost Acceleration) ---
      const currentSpace = isSpacePressedRef.current;

      // 1. Update trail history points & spawn boost particles
      currentCreatures.forEach((creature) => {
        const animState = animMap.get(creature.id);
        const currentX = animState ? animState.displayX : creature.x;
        const currentY = animState ? animState.displayY : creature.y;
        const currentAngle = animState ? animState.displayAngle : creature.angleDeg;
        const isSelected = creature.id === currentSelectedId;
        const canDash = (creature.foodEaten ?? 0) > 0;
        const isDashing = (creature.state === 'dashing' || (creature as any).isDashing || (isSelected && currentSpace)) && canDash;

        let cTrail = trailsRef.current.get(creature.id);
        if (!cTrail) {
          cTrail = [];
          trailsRef.current.set(creature.id, cTrail);
        }

        const lastPt = cTrail[cTrail.length - 1];
        const distSq = lastPt ? Math.pow(currentX - lastPt.x, 2) + Math.pow(currentY - lastPt.y, 2) : 999;

        if (isDashing || distSq > 0.04 || !lastPt || (now - lastPt.time > 70)) {
          cTrail.push({
            x: currentX,
            y: currentY,
            angleDeg: currentAngle,
            color: creature.color || '#ec4899',
            isDashing,
            time: now,
          });
        }

        const maxAge = isDashing ? 850 : 450;
        while (cTrail.length > 0 && now - cTrail[0].time > maxAge) {
          cTrail.shift();
        }

        // Spawn dynamic boost wake particles when accelerating
        if (isDashing) {
          const rearAngleRad = ((currentAngle + 180) * Math.PI) / 180;
          const numParticles = currentGridTheme === 'notebook' ? 2 : 4;
          for (let p = 0; p < numParticles; p++) {
            const spread = (Math.random() - 0.5) * 0.8;
            const spd = 0.8 + Math.random() * 2.2;
            const vx = Math.cos(rearAngleRad + spread) * spd;
            const vy = Math.sin(rearAngleRad + spread) * spd;
            const life = 180 + Math.random() * 260;

            let pColor = '#f59e0b';
            let pType: 'flame' | 'spark' | 'ink' | 'shockwave' = 'flame';
            if (currentGridTheme === 'notebook') {
              pType = 'ink';
              pColor = Math.random() > 0.4 ? '#1e293b' : '#3b82f6';
            } else if (currentGridTheme === 'blueprint') {
              pType = 'spark';
              pColor = Math.random() > 0.5 ? '#38bdf8' : '#818cf8';
            } else {
              pType = Math.random() > 0.35 ? 'flame' : 'spark';
              pColor = Math.random() > 0.5 ? '#f59e0b' : (creature.color || '#ec4899');
            }

            boostParticlesRef.current.push({
              x: currentX - Math.cos((currentAngle * Math.PI) / 180) * 0.35,
              y: currentY - Math.sin((currentAngle * Math.PI) / 180) * 0.35,
              vx,
              vy,
              life,
              maxLife: life,
              size: 3 + Math.random() * 4.5,
              color: pColor,
              type: pType,
            });
          }

          if (Math.random() < 0.2) {
            boostParticlesRef.current.push({
              x: currentX,
              y: currentY,
              vx: 0,
              vy: 0,
              life: 280,
              maxLife: 280,
              size: 10,
              color: currentGridTheme === 'notebook' ? 'rgba(30, 41, 59, 0.45)' : 'rgba(245, 158, 11, 0.65)',
              type: 'shockwave',
            });
          }
        }
      });

      // 2. Render Motion Trails (Шлейф) for each creature
      trailsRef.current.forEach((cTrail) => {
        if (cTrail.length < 2) return;

        for (let i = 0; i < cTrail.length - 1; i++) {
          const p1 = cTrail[i];
          const p2 = cTrail[i + 1];
          const age = now - p1.time;
          const alpha = Math.max(0, 1 - age / 750);
          if (alpha <= 0.01) continue;

          // Skip wrapping segments across toroidal boundary
          if (Math.abs(p2.x - p1.x) > 5 || Math.abs(p2.y - p1.y) > 5) continue;

          const screenP1 = {
            x: currentOffset.x + p1.x * scaledCell,
            y: currentOffset.y + p1.y * scaledCell,
          };
          const screenP2 = {
            x: currentOffset.x + p2.x * scaledCell,
            y: currentOffset.y + p2.y * scaledCell,
          };

          ctx.save();
          if (currentGridTheme === 'notebook') {
            // Hand-drawn sketch speed trails (Чернильный / карандашный шлейф)
            ctx.beginPath();
            ctx.moveTo(screenP1.x, screenP1.y);
            ctx.lineTo(screenP2.x, screenP2.y);
            ctx.strokeStyle = p1.isDashing ? `rgba(225, 29, 72, ${alpha * 0.85})` : `rgba(30, 41, 59, ${alpha * 0.45})`;
            ctx.lineWidth = (p1.isDashing ? 3.5 : 2) * currentZoom;
            ctx.setLineDash(p1.isDashing ? [8 * currentZoom, 4 * currentZoom] : [4 * currentZoom, 4 * currentZoom]);
            ctx.stroke();

            // Parallel sketch speed streaks when dashing
            if (p1.isDashing) {
              const perpX = -(screenP2.y - screenP1.y);
              const perpY = screenP2.x - screenP1.x;
              const len = Math.hypot(perpX, perpY) || 1;
              const normPerx = (perpX / len) * 7 * currentZoom;
              const normPery = (perpY / len) * 7 * currentZoom;

              ctx.beginPath();
              ctx.moveTo(screenP1.x + normPerx, screenP1.y + normPery);
              ctx.lineTo(screenP2.x + normPerx, screenP2.y + normPery);
              ctx.strokeStyle = `rgba(59, 130, 246, ${alpha * 0.6})`;
              ctx.lineWidth = 1.5 * currentZoom;
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(screenP1.x - normPerx, screenP1.y - normPery);
              ctx.lineTo(screenP2.x - normPerx, screenP2.y - normPery);
              ctx.stroke();
            }
          } else {
            // Glowing neon ribbon trail for game / dark / blueprint themes
            const widthFactor = i / cTrail.length;
            const baseWidth = p1.isDashing ? 14 : 7;

            ctx.beginPath();
            ctx.moveTo(screenP1.x, screenP1.y);
            ctx.lineTo(screenP2.x, screenP2.y);
            ctx.lineWidth = Math.max(1, baseWidth * widthFactor * currentZoom);
            ctx.lineCap = 'round';
            ctx.strokeStyle = p1.isDashing
              ? `rgba(245, 158, 11, ${alpha * 0.85})`
              : `${p1.color}${Math.round(alpha * 120).toString(16).padStart(2, '0')}`;
            ctx.stroke();

            if (p1.isDashing) {
              ctx.beginPath();
              ctx.moveTo(screenP1.x, screenP1.y);
              ctx.lineTo(screenP2.x, screenP2.y);
              ctx.lineWidth = Math.max(1, 5 * widthFactor * currentZoom);
              ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.95})`;
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      });

      // 3. Render and update flying boost particles
      const remainingParticles: typeof boostParticlesRef.current = [];
      boostParticlesRef.current.forEach((pt) => {
        pt.life -= 16.6;
        if (pt.life <= 0) return;

        pt.x += pt.vx * 0.016;
        pt.y += pt.vy * 0.016;

        const progress = pt.life / pt.maxLife;
        const px = currentOffset.x + pt.x * scaledCell;
        const py = currentOffset.y + pt.y * scaledCell;

        ctx.save();
        if (pt.type === 'shockwave') {
          const currentRadius = (pt.size + (1 - progress) * 22) * currentZoom;
          ctx.beginPath();
          ctx.arc(px, py, currentRadius, 0, Math.PI * 2);
          ctx.strokeStyle = pt.color.replace(/[\d\.]+\)$/, `${progress * 0.6})`);
          ctx.lineWidth = 2 * currentZoom;
          ctx.stroke();
        } else if (pt.type === 'ink') {
          ctx.beginPath();
          ctx.arc(px, py, pt.size * progress * currentZoom, 0, Math.PI * 2);
          ctx.fillStyle = pt.color;
          ctx.globalAlpha = progress * 0.85;
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(px, py, pt.size * progress * currentZoom, 0, Math.PI * 2);
          ctx.fillStyle = pt.color;
          ctx.globalAlpha = progress;
          ctx.shadowColor = pt.color;
          ctx.shadowBlur = 8 * currentZoom;
          ctx.fill();
        }
        ctx.restore();

        remainingParticles.push(pt);
      });
      boostParticlesRef.current = remainingParticles;

      // Render Creatures with Physics Elements
      currentCreatures.forEach((creature) => {
        const animState = animMap.get(creature.id);
        const currentX = animState ? animState.displayX : creature.x;
        const currentY = animState ? animState.displayY : creature.y;
        const currentAngle = animState ? animState.displayAngle : creature.angleDeg;

        // Base head orientation angle and rotation delta
        const baseHeadAngle = determineCreatureHeadAngle(creature.elements);
        const rotationDelta = currentAngle - baseHeadAngle;

        const isSelected = creature.id === currentSelectedId;
        const animStep = animState ? animState.muscleAnimStep : creature.muscleStep;
        const currentContractFactor = 0.5 - 0.5 * Math.cos(animStep * Math.PI);
        const isMuscleContracted = currentContractFactor > 0.05;

        // Calculate kinematic bends ONCE per creature per frame
        const bentMap = calculateKinematicBends(creature.elements, animStep);

        // Toroidal wrapper offsets for seamless boundary transition
        const wrapOffsets: { x: number; y: number }[] = [{ x: 0, y: 0 }];
        const edgeThresh = halfWorld - 10;
        if (currentX > edgeThresh) wrapOffsets.push({ x: -worldSize, y: 0 });
        if (currentX < -edgeThresh) wrapOffsets.push({ x: worldSize, y: 0 });
        if (currentY > edgeThresh) wrapOffsets.push({ x: 0, y: -worldSize });
        if (currentY < -edgeThresh) wrapOffsets.push({ x: 0, y: worldSize });

        wrapOffsets.forEach((off) => {
          const centerPos = {
            x: currentOffset.x + (currentX + off.x) * scaledCell,
            y: currentOffset.y + (currentY + off.y) * scaledCell,
          };

          ctx.save();
          ctx.translate(centerPos.x, centerPos.y);
          ctx.rotate((rotationDelta * Math.PI) / 180);

          // Selection boundary
          if (isSelected) {
            ctx.beginPath();
            ctx.arc(0, 0, 36 * currentZoom, 0, Math.PI * 2);
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2 * currentZoom;
            ctx.setLineDash([6 * currentZoom, 4 * currentZoom]);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Dynamic Boost / Dash visual effect
          const canDash = (creature.foodEaten ?? 0) > 0;
          const isDashing = (creature.state === 'dashing' || (creature as any).isDashing || (isSelected && currentSpace)) && canDash;
          if (isDashing) {
            const t = performance.now() * 0.018;
            const flameLen = (28 + Math.sin(t * 6) * 10) * currentZoom;
            const flameWidth = 18 * currentZoom;

            ctx.save();
            const backAngleRad = ((baseHeadAngle + 180) * Math.PI) / 180;
            ctx.rotate(backAngleRad);

            // Outer flame
            ctx.beginPath();
            ctx.moveTo(-flameWidth / 2, 0);
            ctx.lineTo(0, flameLen);
            ctx.lineTo(flameWidth / 2, 0);
            ctx.closePath();
            ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 12 * currentZoom;
            ctx.fill();

            // Inner hot core
            ctx.beginPath();
            ctx.moveTo(-flameWidth / 3, 0);
            ctx.lineTo(0, flameLen * 0.65);
            ctx.lineTo(flameWidth / 3, 0);
            ctx.closePath();
            ctx.fillStyle = 'rgba(254, 240, 138, 0.95)';
            ctx.fill();

            ctx.restore();
          }

          // Render each physical element
          creature.elements.forEach((el) => {
            const bent = bentMap.get(el.id) || { relX: el.relX, relY: el.relY, rotationDeg: 0 };
            const elX = bent.relX * scaledCell;
            const elY = bent.relY * scaledCell;

            ctx.save();
            ctx.translate(elX, elY);
            ctx.rotate((bent.rotationDeg * Math.PI) / 180);

            if (el.type === 'head' || el.type === 'head-jaw') {
              const isJaw = el.type === 'head-jaw';
              if (isGameTheme) {
                const headR = (isJaw ? 16 : 14) * currentZoom;
                ctx.beginPath();
                ctx.arc(0, 0, headR, 0, Math.PI * 2);
                ctx.fillStyle = isJaw ? '#dc2626' : (creature.color || '#ec4899');
                ctx.fill();
                ctx.strokeStyle = isJaw ? '#fef08a' : '#ffffff';
                ctx.lineWidth = (isJaw ? 2.8 : 2) * currentZoom;
                ctx.stroke();

                // Predatory sharp teeth if jaw
                if (isJaw) {
                  ctx.fillStyle = '#ffffff';
                  // Front predatory fangs
                  const toothSize = 5 * currentZoom;
                  for (let t = -2; t <= 2; t++) {
                    const tx = t * 4.5 * currentZoom;
                    ctx.beginPath();
                    ctx.moveTo(tx - 2 * currentZoom, -headR + 2 * currentZoom);
                    ctx.lineTo(tx, -headR - toothSize);
                    ctx.lineTo(tx + 2 * currentZoom, -headR + 2 * currentZoom);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#991b1b';
                    ctx.lineWidth = 0.8 * currentZoom;
                    ctx.stroke();
                  }
                }

                // Two Cartoon Googly / Predator Eyes
                const eyeR = (isJaw ? 6 : 5.5) * currentZoom;
                const pupilR = (isJaw ? 3.2 : 2.8) * currentZoom;

                // Left Eye
                ctx.beginPath();
                ctx.arc(-5.5 * currentZoom, -5.5 * currentZoom, eyeR, 0, Math.PI * 2);
                ctx.fillStyle = isJaw ? '#fef08a' : '#ffffff';
                ctx.fill();
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1 * currentZoom;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(-4.5 * currentZoom, -4.5 * currentZoom, pupilR, 0, Math.PI * 2);
                ctx.fillStyle = isJaw ? '#991b1b' : '#0f172a';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(-5.5 * currentZoom, -5.5 * currentZoom, 1.2 * currentZoom, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();

                // Right Eye
                ctx.beginPath();
                ctx.arc(5.5 * currentZoom, -5.5 * currentZoom, eyeR, 0, Math.PI * 2);
                ctx.fillStyle = isJaw ? '#fef08a' : '#ffffff';
                ctx.fill();
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1 * currentZoom;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(6.5 * currentZoom, -4.5 * currentZoom, pupilR, 0, Math.PI * 2);
                ctx.fillStyle = isJaw ? '#991b1b' : '#0f172a';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(5.5 * currentZoom, -5.5 * currentZoom, 1.2 * currentZoom, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
              } else {
                const headR = (isJaw ? 13 : 11) * currentZoom;
                ctx.beginPath();
                ctx.arc(0, 0, headR, 0, Math.PI * 2);
                ctx.fillStyle = isJaw ? '#fee2e2' : '#fef08a';
                ctx.fill();
                ctx.strokeStyle = isJaw ? '#ef4444' : '#eab308';
                ctx.lineWidth = 2.5 * currentZoom;
                ctx.stroke();

                if (isJaw) {
                  // Draw blueprint/ink teeth
                  ctx.fillStyle = '#ef4444';
                  for (let t = -2; t <= 2; t++) {
                    const tx = t * 4 * currentZoom;
                    ctx.beginPath();
                    ctx.moveTo(tx - 2 * currentZoom, -headR);
                    ctx.lineTo(tx, -headR - 4 * currentZoom);
                    ctx.lineTo(tx + 2 * currentZoom, -headR);
                    ctx.fill();
                  }
                }

                ctx.beginPath();
                ctx.arc(0, 0, 4.5 * currentZoom, 0, Math.PI * 2);
                ctx.fillStyle = isJaw ? '#7f1d1d' : '#0f172a';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(-2 * currentZoom, -2 * currentZoom, 1.5 * currentZoom, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
              }
            } else if (el.type === 'joint') {
              if (isGameTheme) {
                const jointR = 9 * currentZoom;
                ctx.beginPath();
                ctx.arc(0, 0, jointR, 0, Math.PI * 2);
                ctx.fillStyle = '#06b6d4';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5 * currentZoom;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(-jointR * 0.3, -jointR * 0.3, jointR * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.fill();
              } else {
                ctx.beginPath();
                ctx.arc(0, 0, 8 * currentZoom, 0, Math.PI * 2);
                ctx.fillStyle = currentGridTheme === 'notebook' ? '#ffffff' : '#1e293b';
                ctx.fill();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2.5 * currentZoom;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(0, 0, 3 * currentZoom, 0, Math.PI * 2);
                ctx.fillStyle = '#0284c7';
                ctx.fill();
              }
            } else if (el.type.startsWith('edge-')) {
              let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
              if (el.type === 'edge-h') { x1 = -scaledCell / 2; x2 = scaledCell / 2; }
              else if (el.type === 'edge-v') { y1 = -scaledCell / 2; y2 = scaledCell / 2; }
              else if (el.type === 'edge-d1') { x1 = -scaledCell / 2; y1 = scaledCell / 2; x2 = scaledCell / 2; y2 = -scaledCell / 2; }
              else if (el.type === 'edge-d2') { x1 = -scaledCell / 2; y1 = -scaledCell / 2; x2 = scaledCell / 2; y2 = scaledCell / 2; }

              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.strokeStyle = creature.color || '#3b82f6';
              ctx.lineWidth = (isGameTheme ? 7.5 : 3.5) * currentZoom;
              ctx.lineCap = 'round';
              ctx.stroke();

              if (isGameTheme) {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
                ctx.lineWidth = 2.5 * currentZoom;
                ctx.lineCap = 'round';
                ctx.stroke();
              }
            } else if (el.type.startsWith('muscle-')) {
              const isLeft = el.type.includes('left');
              const isRandom = el.type.includes('random');

              let isFlexed = false;
              let isJustFlexed = false;

              if (!isRandom) {
                isFlexed = isMuscleContracted;
                isJustFlexed = isMuscleContracted;
              } else {
                const mState = getRandomMuscleState(el, animStep);
                isFlexed = mState.isFlexed;
                isJustFlexed = mState.justFlexed;
              }

              const muscleFlexFactor = isRandom ? (isFlexed ? currentContractFactor : 0) : currentContractFactor;
              const flex = 1.2 - 0.6 * muscleFlexFactor;
              const sign = isLeft ? -1 : 1;

              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.quadraticCurveTo(sign * 14 * currentZoom * flex, 10 * currentZoom, sign * 20 * currentZoom, 0);

              if (el.type === 'muscle-left') ctx.strokeStyle = '#f43f5e';
              else if (el.type === 'muscle-right') ctx.strokeStyle = '#a855f7';
              else if (el.type === 'muscle-random-left') ctx.strokeStyle = isFlexed ? '#ff8c00' : '#f97316';
              else if (el.type === 'muscle-random-right') ctx.strokeStyle = isFlexed ? '#e024c3' : '#d946ef';

              ctx.lineWidth = (isFlexed ? 4.5 : 3) * currentZoom;
              if (isRandom) {
                ctx.setLineDash([4 * currentZoom, 2 * currentZoom]);
              }
              ctx.stroke();
              ctx.setLineDash([]);

              if (isRandom && isJustFlexed) {
                ctx.beginPath();
                ctx.arc(sign * 12 * currentZoom, 4 * currentZoom, 5 * currentZoom, 0, Math.PI * 2);
                ctx.fillStyle = isLeft ? '#ff8c00' : '#e024c3';
                ctx.fill();
              }

              if (isRandom && el.randomChance) {
                ctx.fillStyle = isFlexed ? '#ffffff' : (isLeft ? '#f97316' : '#d946ef');
                ctx.font = `bold ${Math.max(8, 9 * currentZoom)}px monospace`;
                ctx.textAlign = 'center';
                ctx.fillText(`🎲${el.randomChance}%`, sign * 14 * currentZoom, 18 * currentZoom);
              }
            }

            ctx.restore();
          });

          ctx.restore();

          // --- TEXTUAL HUD OVERLAY OVER CREATURE ---
          ctx.save();
          ctx.translate(centerPos.x, centerPos.y);

          // Calculate stable upper bounding boundary of all rotated body elements
          // Using base rest positions with maximum wing-span margins to prevent frame-by-frame jumping when wings flap
          const rotRad = (rotationDelta * Math.PI) / 180;
          const cosR = Math.cos(rotRad);
          const sinR = Math.sin(rotRad);

          let targetMinRelY = -28 * currentZoom;

          creature.elements.forEach((el) => {
            // Using rest skeleton position (el.relX, el.relY) prevents oscillatory jittering during muscle contractions
            const elX = el.relX * scaledCell;
            const elY = el.relY * scaledCell;
            // Screen Y relative to centerPos
            const screenY = elX * sinR + elY * cosR;

            // Generous allowance for maximum wing/muscle extension and geometry
            let elemHalfSize = 16 * currentZoom;
            if (el.type.startsWith('edge-') || el.type.startsWith('muscle-')) {
              elemHalfSize = Math.max(22 * currentZoom, scaledCell * 0.72);
            } else if (el.type === 'head') {
              elemHalfSize = 18 * currentZoom;
            } else if (el.type === 'joint') {
              elemHalfSize = 14 * currentZoom;
            }

            const topPoint = screenY - elemHalfSize;
            if (topPoint < targetMinRelY) {
              targetMinRelY = topPoint;
            }
          });

          // Account for selection circle and boost flame if active
          if (isSelected) {
            targetMinRelY = Math.min(targetMinRelY, -40 * currentZoom);
          }
          if (isDashing) {
            targetMinRelY = Math.min(targetMinRelY, -44 * currentZoom);
          }

          // Smoothly interpolate HUD Y offset across frames (exponential damping) to make turning seamlessly smooth
          const prevSmoothedY = smoothedHudYRef.current.get(creature.id) ?? targetMinRelY;
          const hudSmoothingFactor = 1 - Math.exp(-16 * dt);
          const smoothedMinRelY = prevSmoothedY + (targetMinRelY - prevSmoothedY) * hudSmoothingFactor;
          smoothedHudYRef.current.set(creature.id, smoothedMinRelY);

          // Safe base Y coordinate strictly above creature body
          const safeTopY = smoothedMinRelY - 8 * currentZoom;
          const energyBarY = safeTopY - 4 * currentZoom;

          const f = creature.forces;
          const boostMultiplier = isDashing ? 1.6 : 1.0;
          const currentDisplaySpeed = (f.forwardSpeed * boostMultiplier).toFixed(2);
          const isCreatureBraking = creature.isBraking || creature.state === 'braking' || (isSelected && isBrakingRef.current);

          if (isGameTheme) {
            // Game Mode HUD Badge: Displays Creature Name, Mass, Speed and Food Count
            const brakeTag = isCreatureBraking ? ' 🛑[СТОП]' : '';
            const sleepTag = creature.isSleeping && !isCreatureBraking ? ' 💤' : '';
            const baseTag = creature.inBase ? ' 🛡️[БАЗА]' : '';
            const titleText = `🐍 ${creature.name}${brakeTag}${sleepTag}${baseTag}`;
            const speedStr = isCreatureBraking
              ? '🛑 НЕЙТРАЛЬ (N)'
              : isDashing
              ? `⚡ ${currentDisplaySpeed} (1.6x)`
              : `Скор: ${currentDisplaySpeed}`;
            const bankStr = creature.inBase ? ` (Банк: ${creature.bankFood || 0})` : '';
            const statsText = `Масса: ${f.totalMass.toFixed(1)}  •  ${speedStr}  •  Еда: ${creature.foodEaten || 0}${bankStr}`;

            ctx.font = `bold ${Math.max(11, 12.5 * currentZoom)}px system-ui, sans-serif`;
            const titleW = ctx.measureText(titleText).width;
            ctx.font = `bold ${Math.max(9, 10 * currentZoom)}px monospace`;
            const statsW = ctx.measureText(statsText).width;

            const badgeW = Math.max(titleW, statsW) + 20 * currentZoom;
            const badgeH = 34 * currentZoom;
            const badgeY = energyBarY - 6 * currentZoom - badgeH;

            ctx.fillStyle = currentGridTheme === 'game-light' ? 'rgba(255, 255, 255, 0.94)' : 'rgba(15, 23, 42, 0.92)';
            ctx.strokeStyle = isCreatureBraking ? '#f43f5e' : (creature.inBase ? '#10b981' : (isDashing ? '#f59e0b' : (creature.isSleeping ? '#94a3b8' : (creature.color || '#ec4899'))));
            ctx.lineWidth = (isCreatureBraking || creature.inBase || isDashing ? 2.5 : 1.5) * currentZoom;

            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(-badgeW / 2, badgeY, badgeW, badgeH, 8 * currentZoom);
            } else {
              ctx.rect(-badgeW / 2, badgeY, badgeW, badgeH);
            }
            ctx.fill();
            ctx.stroke();

            // Creature Name
            ctx.fillStyle = isCreatureBraking ? '#fb7185' : (creature.inBase ? '#34d399' : (currentGridTheme === 'game-light' ? '#0f172a' : '#ffffff'));
            ctx.font = `bold ${Math.max(11, 12.5 * currentZoom)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(titleText, 0, badgeY + 4 * currentZoom);

            // Mass, Speed, Food Count
            ctx.font = `bold ${Math.max(9, 10 * currentZoom)}px monospace`;
            ctx.fillStyle = isCreatureBraking ? '#fb7185' : (isDashing ? '#f59e0b' : (currentGridTheme === 'game-light' ? '#334155' : '#38bdf8'));
            ctx.fillText(statsText, 0, badgeY + 19 * currentZoom);
          } else {
            // Notebook / Blueprint / Dark / Paper HUD
            const statsY = energyBarY - 6 * currentZoom;
            const nameY = statsY - 14 * currentZoom;

            // Speed indicator dynamically highlights with 1.6x multiplier when boost is active!
            const speedLabel = isCreatureBraking ? '🛑СТОП [N]' : (isDashing ? `v:${currentDisplaySpeed} ⚡x1.6` : `v:${currentDisplaySpeed}`);
            const baseTag = creature.inBase ? ' 🛡️[БАЗА]' : '';
            const brakeTag = isCreatureBraking ? ' 🛑[СТОП]' : '';
            ctx.font = `bold ${Math.max(9, 10.5 * currentZoom)}px monospace`;
            ctx.fillStyle = isCreatureBraking ? '#f43f5e' : (isDashing ? '#f59e0b' : (creature.inBase ? '#10b981' : '#38bdf8'));
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(
              `m:${f.totalMass.toFixed(1)} | I:${f.totalInertia?.toFixed(1) ?? '1.0'} | ${speedLabel} | 🍎${creature.foodEaten || 0}${creature.inBase ? ` 🏦${creature.bankFood || 0}` : ''}`,
              0,
              statsY
            );

            ctx.fillStyle = isCreatureBraking ? '#f43f5e' : (creature.inBase ? '#10b981' : mainInkColor);
            ctx.font = `bold ${Math.max(11, 13 * currentZoom)}px system-ui, sans-serif`;
            const sleepTag = creature.isSleeping && !isCreatureBraking ? ' 💤' : '';
            ctx.fillText(`${creature.name}${brakeTag}${sleepTag}${baseTag}`, 0, nameY);
          }

          // Energy Bar
          const energyPct = Math.max(0, creature.energy / creature.maxEnergy);
          const barW = 36 * currentZoom;
          const barH = 4.5 * currentZoom;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(-barW / 2, energyBarY, barW, barH, 2 * currentZoom);
            ctx.fill();
            ctx.fillStyle = energyPct > 0.4 ? '#10b981' : '#f43f5e';
            ctx.beginPath();
            ctx.roundRect(-barW / 2, energyBarY, barW * energyPct, barH, 2 * currentZoom);
            ctx.fill();
          } else {
            ctx.fillRect(-barW / 2, energyBarY, barW, barH);
            ctx.fillStyle = energyPct > 0.4 ? '#10b981' : '#f43f5e';
            ctx.fillRect(-barW / 2, energyBarY, barW * energyPct, barH);
          }

          ctx.restore();
        });
      });

      // Render Ghost Preview during Placement Mode
      const activeHoverGridPos = hoverGridPosRef.current;
      if (currentPendingPlacement && activeHoverGridPos) {
        const centerPos = {
          x: currentOffset.x + activeHoverGridPos.x * scaledCell,
          y: currentOffset.y + activeHoverGridPos.y * scaledCell,
        };
        const baseHeadAngle = determineCreatureHeadAngle(currentPendingPlacement.elements);
        const rotationDelta = currentPendingPlacement.angleDeg - baseHeadAngle;

        ctx.save();
        ctx.translate(centerPos.x, centerPos.y);

        const pulse = Math.sin(Date.now() / 150) * 4;
        ctx.beginPath();
        ctx.arc(0, 0, (28 + pulse) * currentZoom, 0, Math.PI * 2);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 3 * currentZoom;
        ctx.setLineDash([8 * currentZoom, 4 * currentZoom]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(0, 0, 8 * currentZoom, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.fill();

        ctx.rotate((rotationDelta * Math.PI) / 180);
        ctx.globalAlpha = 0.75;

        currentPendingPlacement.elements.forEach((el) => {
          const elX = el.relX * scaledCell;
          const elY = el.relY * scaledCell;

          ctx.save();
          ctx.translate(elX, elY);

          if (el.type === 'head') {
            ctx.beginPath();
            ctx.arc(0, 0, 11 * currentZoom, 0, Math.PI * 2);
            ctx.fillStyle = '#fef08a';
            ctx.fill();
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 2.5 * currentZoom;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, 4.5 * currentZoom, 0, Math.PI * 2);
            ctx.fillStyle = '#0f172a';
            ctx.fill();
          } else if (el.type === 'joint') {
            ctx.beginPath();
            ctx.arc(0, 0, 8 * currentZoom, 0, Math.PI * 2);
            ctx.fillStyle = '#1e293b';
            ctx.fill();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2.5 * currentZoom;
            ctx.stroke();
          } else if (el.type.startsWith('edge-')) {
            ctx.beginPath();
            ctx.moveTo(-scaledCell / 2, 0);
            ctx.lineTo(scaledCell / 2, 0);
            ctx.strokeStyle = currentPendingPlacement.color || '#6366f1';
            ctx.lineWidth = 3.5 * currentZoom;
            ctx.stroke();
          } else if (el.type.startsWith('muscle-')) {
            const isLeft = el.type.includes('left');
            const sign = isLeft ? -1 : 1;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(sign * 14 * currentZoom, 10 * currentZoom, sign * 20 * currentZoom, 0);
            ctx.strokeStyle = el.type.includes('random') ? (isLeft ? '#f97316' : '#d946ef') : (isLeft ? '#f43f5e' : '#a855f7');
            ctx.lineWidth = 3 * currentZoom;
            if (el.type.includes('random')) ctx.setLineDash([4 * currentZoom, 2 * currentZoom]);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          ctx.restore();
        });

        ctx.restore();

        ctx.save();
        ctx.translate(centerPos.x, centerPos.y);
        ctx.fillStyle = '#6366f1';
        ctx.font = `bold ${Math.max(10, 12 * currentZoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`Нажмите для размещения (${currentPendingPlacement.angleDeg}°)`, 0, -36 * currentZoom);
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [halfWorld, worldSize]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-slate-950 cursor-crosshair">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        className="block w-full h-full"
      />

      {/* Top Banner overlay during Placement Mode */}
      {pendingPlacement && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 border border-indigo-500/60 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-center gap-3 text-xs text-slate-100 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500 animate-ping" />
            <span className="font-bold text-indigo-300">РАЗМЕЩЕНИЕ:</span>
            <span className="font-semibold text-slate-100">"{pendingPlacement.name}"</span>
          </div>

          {/* Orientation Angle selector buttons */}
          <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700/80">
            <Compass className="w-3.5 h-3.5 text-indigo-400 ml-1 mr-0.5" />
            {[270, 0, 90, 180, 315, 45, 135, 225].map((angle) => {
              const labelMap: Record<number, string> = {
                270: '↑ 270°',
                0: '→ 0°',
                90: '↓ 90°',
                180: '← 180°',
                315: '↗ 315°',
                45: '↘ 45°',
                135: '↙ 135°',
                225: '↖ 225°',
              };
              return (
                <button
                  key={angle}
                  onClick={() => onChangePlacementAngle(angle)}
                  className={`px-2 py-1 rounded-lg text-2xs font-bold transition ${
                    pendingPlacement.angleDeg === angle
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {labelMap[angle] || `${angle}°`}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onChangePlacementAngle((pendingPlacement.angleDeg + 45) % 360)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition text-2xs font-bold flex items-center gap-1"
              title="Повернуть на 45° (Клавиша R)"
            >
              <RotateCw className="w-3 h-3 text-indigo-400" />
              <span>Поворот (R)</span>
            </button>
            <button
              onClick={onCancelPlacement}
              className="px-2.5 py-1 bg-red-950/80 hover:bg-red-900 text-red-200 rounded-xl border border-red-800/60 transition text-2xs font-bold flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Отмена</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Canvas Hint overlay */}
      {!isHintHidden && (
        <div className="absolute bottom-4 left-4 z-20 text-xs bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 shadow-xl text-slate-300 flex items-center gap-3">
          {pendingPlacement ? (
            <span className="font-bold text-indigo-400">🎯 Нажмите ЛКМ на сетке для выбора позиции. Зажмите ПКМ для панорамы или клавишу 'R' для поворота!</span>
          ) : (
            <>
              <span>🖱️ ЛКМ: Выбрать / Добавить еду</span>
              <span className="text-slate-600">•</span>
              <span>🚀 Пробел (Space): Рывок x1.6 (требуется еда &gt; 0, расход 2 ед/сек)</span>
              <span className="text-slate-600">•</span>
              <span>A / D или (← / →): Поворот на 10°</span>
            </>
          )}
          <button
            onClick={() => setIsHintHidden(true)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition ml-1 cursor-pointer"
            title="Скрыть подсказку"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom Right Controls Stack (Player Creature Control HUD + Zoom Toolbar) */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2 max-w-[calc(100vw-2rem)]">
        {/* Player Control HUD Widget */}
        {onTurnPlayer && (() => {
          const activeControlCreature = creatures.find((c) => c.id === selectedCreatureId) || creatures[0];
          const activeMass = activeControlCreature?.forces?.totalMass?.toFixed(1) ?? '1.0';
          const baseSpeed = activeControlCreature?.forces?.forwardSpeed ?? 0.22;
          const activeFood = activeControlCreature?.foodEaten ?? 0;
          const hasFood = activeFood > 0;
          const isActuallyDashing = isSpacePressed && hasFood;
          const liveSpeed = (baseSpeed * (isActuallyDashing ? 1.6 : 1.0)).toFixed(2);

          return isPlayerHudCollapsed ? (
            <button
              onClick={() => setIsPlayerHudCollapsed(false)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-indigo-500/50 text-indigo-400 hover:bg-slate-800 transition shadow-xl text-xs font-bold cursor-pointer"
              title="Показать панель управления чудиком"
            >
              <Gamepad2 className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Управление</span>
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            </button>
          ) : (
            <div className="flex flex-col gap-1.5 bg-slate-900/95 backdrop-blur-md p-2.5 rounded-2xl border border-indigo-500/50 shadow-2xl text-xs text-slate-100 animate-in fade-in min-w-[230px]">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 px-0.5">
                <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
                  <Gamepad2 className="w-4 h-4 text-indigo-400" />
                  <span>Управление</span>
                </div>
                <div className="flex items-center gap-1">
                  {selectedCreatureName && (
                    <span className="text-2xs text-slate-300 max-w-[100px] truncate font-semibold">
                      {selectedCreatureName}
                    </span>
                  )}
                  <button
                    onClick={() => setIsPlayerHudCollapsed(true)}
                    className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                    title="Скрыть панель управления"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Live Telemetry Row: Mass, Speed (with dynamic 1.6x multiplier or Brake indicator), Food */}
              <div className="flex items-center justify-between gap-1 px-2 py-1 bg-slate-800/80 rounded-xl border border-slate-700/60 font-mono text-[11px]">
                <div className="flex items-center gap-1 text-slate-300" title="Масса чудика">
                  <span className="text-indigo-400 font-semibold">M:</span>
                  <span>{activeMass}</span>
                </div>
                <div className="w-px h-3 bg-slate-700" />
                <div className={`flex items-center gap-1 transition-colors ${isBraking ? 'text-rose-400 font-bold' : isActuallyDashing ? 'text-amber-300 font-bold' : 'text-emerald-400'}`} title={isBraking ? 'Тормоз (Нейтраль) включен' : 'Текущая скорость движения'}>
                  <span>{isBraking ? '🛑' : isActuallyDashing ? '⚡' : 'V:'}</span>
                  <span>{isBraking ? 'СТОП' : liveSpeed}</span>
                  {isActuallyDashing && !isBraking && <span className="text-[9px] text-amber-400 font-bold">x1.6</span>}
                </div>
                <div className="w-px h-3 bg-slate-700" />
                <div className={`flex items-center gap-1 ${hasFood ? 'text-amber-300' : 'text-red-400'}`} title="Количество съеденной еды">
                  <span>🍎</span>
                  <span className="font-bold">{activeFood}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  onClick={() => onTurnPlayer?.('left')}
                  className="flex-1 py-1.5 px-2 bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-500/50 rounded-xl font-bold flex items-center justify-center gap-1 transition text-xs active:scale-95 shadow-md cursor-pointer"
                  title="Повернуть влево на 10° (Стрелка влево ← или A)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>← 10°</span>
                </button>

                <button
                  onClick={() => onTurnPlayer?.('right')}
                  className="flex-1 py-1.5 px-2 bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-500/50 rounded-xl font-bold flex items-center justify-center gap-1 transition text-xs active:scale-95 shadow-md cursor-pointer"
                  title="Повернуть вправо на 10° (Стрелка вправо → или D)"
                >
                  <span>10° →</span>
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Neutral / Brake Action Button (N key) */}
              <div className="pt-0.5">
                <button
                  onClick={() => onToggleBrake?.()}
                  className={`w-full py-1.5 px-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition text-xs select-none cursor-pointer ${
                    isBraking
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/60 ring-2 ring-rose-300 animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                  title="Тормоз (Нейтраль) [N] — чудик замирает на месте до следующего нажатия кнопки N"
                >
                  <span>{isBraking ? '🛑' : '⏸️'}</span>
                  <span>{isBraking ? 'ТОРМОЗ ВКЛЮЧЕН [N]' : 'НЕЙТРАЛЬ / ТОРМОЗ [N]'}</span>
                </button>
              </div>

              {/* Dash / Boost Action Button */}
              <div className="pt-0.5">
                <button
                  disabled={!hasFood || isBraking}
                  onMouseDown={() => {
                    if (hasFood && !isBraking) onSetSpacePressed?.(true);
                  }}
                  onMouseUp={() => onSetSpacePressed?.(false)}
                  onTouchStart={() => {
                    if (hasFood && !isBraking) onSetSpacePressed?.(true);
                  }}
                  onTouchEnd={() => onSetSpacePressed?.(false)}
                  className={`w-full py-2 px-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition text-xs select-none ${
                    !hasFood || isBraking
                      ? 'bg-slate-800/60 text-slate-500 border border-slate-700/40 cursor-not-allowed opacity-70'
                      : isActuallyDashing
                      ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/50 scale-[1.02] ring-2 ring-amber-300 cursor-pointer'
                      : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 cursor-pointer'
                  }`}
                  title={
                    isBraking
                      ? 'Ускорение недоступно: чудик на тормозе (N)'
                      : !hasFood
                      ? 'Ускорение недоступно: запас еды равен 0. Соберите еду на поле!'
                      : 'Рывок и ускорение в 1.6 раз. Зажмите ПРОБЕЛ. Расход: 2 ед. еды в секунду'
                  }
                >
                  <Zap className={`w-3.5 h-3.5 ${!hasFood || isBraking ? 'text-slate-500' : isActuallyDashing ? 'animate-pulse text-slate-950' : 'text-amber-400'}`} />
                  <span>
                    {isBraking
                      ? '🛑 НА ТОРМОЗЕ'
                      : !hasFood
                      ? '❌ НЕТ ЕДЫ ДЛЯ РЫВКА (0)'
                      : isActuallyDashing
                      ? '⚡ РЫВОК АКТИВЕН (1.6x)'
                      : '⚡ РЫВОК (ПРОБЕЛ) x1.6'}
                  </span>
                </button>
              </div>

              <div className="text-[10px] text-amber-300/80 text-center font-mono pt-0.5">
                {isBraking
                  ? '🛑 Чудик на тормозе. Нажмите N для возобновления'
                  : !hasFood
                  ? 'N: Тормоз • A/D: Поворот • Требуется еда > 0 для ускорения'
                  : 'N: Тормоз (Нейтраль) • Space: Рывок (1.6x) • A/D: Поворот'}
              </div>
            </div>
          );
        })()}

        {/* On-screen Canvas Zoom & View Controls Toolbar */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl text-xs font-mono text-slate-300">
          <button
            onClick={() => setZoom((z) => Math.min(3.5, z * 1.2))}
            className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-200"
            title="Приблизить поле (+)"
          >
            <ZoomIn className="w-4 h-4 text-indigo-400" />
          </button>
          <span className="px-2 text-2xs font-bold text-indigo-400 select-none">
            {(zoom * 100).toFixed(0)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.max(0.3, z / 1.2))}
            className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-200"
            title="Отдалить поле (-)"
          >
            <ZoomOut className="w-4 h-4 text-indigo-400" />
          </button>
          <div className="w-px h-4 bg-slate-800 mx-0.5" />
          <button
            onClick={() => {
              const nextState = !isCameraLocked;
              setIsCameraLocked(nextState);
              if (nextState && selectedCreatureId && canvasRef.current) {
                const target = (creaturesRef.current || []).find((c) => c.id === selectedCreatureId);
                if (target) {
                  const width = canvasRef.current.width || canvasRef.current.clientWidth;
                  const height = canvasRef.current.height || canvasRef.current.clientHeight;
                  setOffset({
                    x: width / 2 - target.x * CELL_SIZE * zoom,
                    y: height / 2 - target.y * CELL_SIZE * zoom,
                  });
                }
              }
            }}
            className={`p-2 rounded-lg transition ${
              isCameraLocked && selectedCreatureId
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
            title={
              isCameraLocked && selectedCreatureId
                ? 'Авто-слежение за чудиком (Включено)'
                : 'Включить авто-слежение за чудиком'
            }
          >
            <Crosshair className="w-4 h-4 text-indigo-400" />
          </button>
          <button
            onClick={handleResetView}
            className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-200"
            title="Сбросить масштаб (100%) и центрировать"
          >
            <Maximize2 className="w-4 h-4 text-slate-400 hover:text-slate-200" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const GridCanvas = React.memo(GridCanvasComponent);
export default GridCanvas;
