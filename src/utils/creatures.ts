import { Creature, CreatureElement, Food, PhysicsForces, JointPhysics, Point, ElementType } from '../types';

export const STARTER_PRESET: { name: string; description: string; elements: CreatureElement[] } = {
  name: 'Стартовый Чудик (Бесплатный)',
  description: '1 шарнир, 1 позвоночник, 2 боковых ребра и 2 прямые мышцы. Стоимость: 0 еды.',
  elements: [
    { id: 'joint-c', relX: 0, relY: 0, type: 'joint', weight: 0, isStarter: true },
    { id: 'edge-spine', relX: 0, relY: -1, type: 'edge-v', weight: 1, isStarter: true },
    { id: 'edge-wing-l', relX: -1, relY: 0, type: 'edge-h', weight: 1, isStarter: true },
    { id: 'edge-wing-r', relX: 1, relY: 0, type: 'edge-h', weight: 1, isStarter: true },
    { id: 'muscle-l', relX: 0, relY: 0, type: 'muscle-left', weight: 0, isStarter: true },
    { id: 'muscle-r', relX: 0, relY: 0, type: 'muscle-right', weight: 0, isStarter: true },
  ],
};

export const DEFAULT_ECONOMY_CONFIG = {
  starterBankFood: 100,
  foodBerryValue: 1,
  foodGoldenValue: 5,
  elementPrices: {
    'head-jaw': 180,
    'head': 50,
    'muscle-random-left': 35,
    'muscle-random-right': 35,
    'muscle-left': 25,
    'muscle-right': 25,
    'joint': 10,
    'edge-h': 10,
    'edge-v': 10,
    'edge-d1': 10,
    'edge-d2': 10,
    'eye': 10,
    'mouth': 10,
  } as Record<string, number>,
};

export let ELEMENT_PRICES: Record<ElementType, number> = {
  'head-jaw': 180,
  'head': 50,
  'muscle-random-left': 35,
  'muscle-random-right': 35,
  'muscle-left': 25,
  'muscle-right': 25,
  'joint': 10,
  'edge-h': 10,
  'edge-v': 10,
  'edge-d1': 10,
  'edge-d2': 10,
  'eye': 10,
  'mouth': 10,
};

export let IS_UNLIMITED_MODE = false;

export function setUnlimitedMode(unlimited: boolean) {
  IS_UNLIMITED_MODE = !!unlimited;
}

export function updateElementPrices(customPrices?: Record<string, number>, isUnlimited?: boolean) {
  if (typeof isUnlimited === 'boolean') {
    IS_UNLIMITED_MODE = isUnlimited;
  }
  if (!customPrices) return;
  for (const [key, val] of Object.entries(customPrices)) {
    if (typeof val === 'number' && val >= 0) {
      (ELEMENT_PRICES as any)[key] = val;
    }
  }
}

export function getElementPrice(type: ElementType): number {
  if (IS_UNLIMITED_MODE) return 0;
  return ELEMENT_PRICES[type] ?? 10;
}

// Проверка нахождения внутри Базы (Safe Zone в правом нижнем углу)
export function isInsideBase(x: number, y: number, worldRadius: number = 50): boolean {
  const baseSize = Math.max(15, worldRadius * 0.35);
  return x >= (worldRadius - baseSize) && y >= (worldRadius - baseSize);
}

export function getBaseBounds(worldRadius: number = 50) {
  const baseSize = Math.max(15, worldRadius * 0.35);
  return {
    minX: worldRadius - baseSize,
    maxX: worldRadius,
    minY: worldRadius - baseSize,
    maxY: worldRadius,
    size: baseSize,
  };
}

export function getElementLabel(type: ElementType): string {
  switch (type) {
    case 'head-jaw':
      return 'Хищная челюсть';
    case 'head':
      return 'Голова';
    case 'muscle-random-left':
      return 'Случайная мышца (L)';
    case 'muscle-random-right':
      return 'Случайная мышца (R)';
    case 'muscle-left':
      return 'Прямая мышца (L)';
    case 'muscle-right':
      return 'Прямая мышца (R)';
    case 'joint':
      return 'Шарнир';
    case 'edge-h':
      return 'Горизонтальное ребро';
    case 'edge-v':
      return 'Вертикальное ребро';
    case 'edge-d1':
      return 'Диагональное ребро (\\)';
    case 'edge-d2':
      return 'Диагональное ребро (/)';
    case 'eye':
      return 'Глаз';
    case 'mouth':
      return 'Рот';
    default:
      return 'Деталь чудика';
  }
}

export function calculateElementsPrice(elements: CreatureElement[]): number {
  if (IS_UNLIMITED_MODE) return 0;
  return elements.reduce((sum, el) => sum + (ELEMENT_PRICES[el.type] ?? 10), 0);
}

export function calculateCreatureCost(elements: CreatureElement[]): { totalCost: number; refundableCost: number; purchasedCount: number; isFreeStarter: boolean } {
  let totalCost = 0;
  let refundableCost = 0;
  let purchasedCount = 0;

  for (const el of elements) {
    const price = IS_UNLIMITED_MODE ? 0 : (ELEMENT_PRICES[el.type] ?? 10);
    if (!el.isStarter) {
      totalCost += price;
      refundableCost += price;
      purchasedCount++;
    }
  }

  const isFreeStarter = elements.length > 0 && elements.every((el) => el.isStarter);

  return { totalCost, refundableCost, purchasedCount, isFreeStarter };
}

// Новые пресеты чудиков, полностью соответствующие правилам: Ребра (вес 1), Шарниры (вес 0), Мышцы (крепятся только на шарниры), Голова (направление)
export const DEFAULT_PRESETS: { name: string; description: string; elements: CreatureElement[] }[] = [
  {
    name: 'Чудик-Маятник (Шарнир + Голова + 2 Мышцы)',
    description: 'Центральный шарнир с головой вверху, симметричными ребрами и противоположными мышцами на шарнире. Бежит вперед!',
    elements: [
      { id: 'head-top', relX: 0, relY: -1, type: 'head', weight: 0, headAngle: 270 },
      { id: 'joint-center', relX: 0, relY: 0, type: 'joint', weight: 0 },
      { id: 'edge-l1', relX: -1, relY: 0, type: 'edge-h', weight: 1 },
      { id: 'edge-r1', relX: 1, relY: 0, type: 'edge-h', weight: 1 },
      { id: 'edge-v1', relX: 0, relY: -1, type: 'edge-v', weight: 1 },
      { id: 'muscle-l', relX: 0, relY: 0, type: 'muscle-left', weight: 0 },
      { id: 'muscle-r', relX: 0, relY: 0, type: 'muscle-right', weight: 0 },
    ],
  },
  {
    name: 'Асимметричный Вращатель',
    description: 'Имеет голову и больше ребер на левом плече. Мышца на центральном шарнире вращает легкое правое плечо.',
    elements: [
      { id: 'head-top', relX: 0, relY: -1, type: 'head', weight: 0, headAngle: 270 },
      { id: 'joint-center', relX: 0, relY: 0, type: 'joint', weight: 0 },
      { id: 'edge-l1', relX: -1, relY: 0, type: 'edge-h', weight: 1 },
      { id: 'edge-l2', relX: -1, relY: 1, type: 'edge-v', weight: 1 },
      { id: 'edge-r1', relX: 1, relY: 0, type: 'edge-h', weight: 1 },
      { id: 'muscle-l', relX: 0, relY: 0, type: 'muscle-left', weight: 0 },
    ],
  },
  {
    name: 'Диагональный Бегун (45°)',
    description: 'Использует диагональные ребра (/) и (\\) с ведущей головой и мышцами на центральном шарнире для быстрого бега.',
    elements: [
      { id: 'head-top', relX: 0, relY: -1, type: 'head', weight: 0, headAngle: 270 },
      { id: 'joint-center', relX: 0, relY: 0, type: 'joint', weight: 0 },
      { id: 'edge-d1', relX: -1, relY: -1, type: 'edge-d2', weight: 1 },
      { id: 'edge-d2', relX: 1, relY: -1, type: 'edge-d1', weight: 1 },
      { id: 'edge-d3', relX: -1, relY: 1, type: 'edge-d1', weight: 1 },
      { id: 'edge-d4', relX: 1, relY: 1, type: 'edge-d2', weight: 1 },
      { id: 'muscle-l', relX: 0, relY: 0, type: 'muscle-left', weight: 0 },
      { id: 'muscle-r', relX: 0, relY: 0, type: 'muscle-right', weight: 0 },
    ],
  },
  {
    name: 'Двухшарнирный Сороконожка',
    description: 'Два шарнира с мышцами сгибания на каждом шарнире и головой, создающими волновое движение вперед.',
    elements: [
      { id: 'head-top', relX: 0, relY: -2, type: 'head', weight: 0, headAngle: 270 },
      { id: 'joint-1', relX: 0, relY: -1, type: 'joint', weight: 0 },
      { id: 'joint-2', relX: 0, relY: 1, type: 'joint', weight: 0 },
      { id: 'edge-v', relX: 0, relY: 0, type: 'edge-v', weight: 1 },
      { id: 'edge-h1', relX: -1, relY: -1, type: 'edge-h', weight: 1 },
      { id: 'edge-h2', relX: 1, relY: -1, type: 'edge-h', weight: 1 },
      { id: 'edge-h3', relX: -1, relY: 1, type: 'edge-h', weight: 1 },
      { id: 'edge-h4', relX: 1, relY: 1, type: 'edge-h', weight: 1 },
      { id: 'muscle-1', relX: 0, relY: -1, type: 'muscle-left', weight: 0 },
      { id: 'muscle-2', relX: 0, relY: 1, type: 'muscle-right', weight: 0 },
    ],
  },
  {
    name: 'Хаотичный Бегун (Случайные Мышцы 🎲)',
    description: 'Использует случайные мышцы на центральном шарнире с вероятностью срабатывания (35%). Непредсказуемый бег!',
    elements: [
      { id: 'head-top', relX: 0, relY: -1, type: 'head', weight: 0, headAngle: 270 },
      { id: 'joint-center', relX: 0, relY: 0, type: 'joint', weight: 0 },
      { id: 'edge-l1', relX: -1, relY: 0, type: 'edge-h', weight: 1 },
      { id: 'edge-r1', relX: 1, relY: 0, type: 'edge-h', weight: 1 },
      { id: 'edge-v1', relX: 0, relY: -1, type: 'edge-v', weight: 1 },
      { id: 'muscle-rnd-l', relX: 0, relY: 0, type: 'muscle-random-left', weight: 0, randomChance: 35 },
      { id: 'muscle-rnd-r', relX: 0, relY: 0, type: 'muscle-random-right', weight: 0, randomChance: 35 },
    ],
  },
  {
    name: 'Хищник с Челюстью (🦷 Сектор 60°)',
    description: 'Челюсть установлена на голове (👁️). Кусает других чудиков в секторе 60° по направлению взгляда головы!',
    elements: [
      { id: 'head-top', relX: 0, relY: -1, type: 'head', weight: 0, headAngle: 270 },
      { id: 'jaw-top', relX: 0, relY: -1, type: 'head-jaw', weight: 0, headAngle: 270 },
      { id: 'joint-center', relX: 0, relY: 0, type: 'joint', weight: 0 },
      { id: 'edge-l1', relX: -1, relY: 0, type: 'edge-h', weight: 1 },
      { id: 'edge-r1', relX: 1, relY: 0, type: 'edge-h', weight: 1 },
      { id: 'edge-v1', relX: 0, relY: -1, type: 'edge-v', weight: 1 },
      { id: 'muscle-l', relX: 0, relY: 0, type: 'muscle-left', weight: 0 },
      { id: 'muscle-r', relX: 0, relY: 0, type: 'muscle-right', weight: 0 },
    ],
  },
];

// Детерминированная проверка срабатывания случайной мышцы для конкретного цикла
export function isRandomMuscleTriggered(el: CreatureElement, cycle: number): boolean {
  if (cycle <= 0) return true; // При сбросе / в редакторе показываем мышцу как способную сработать
  const chance = el.randomChance ?? 35;
  let hash = 0;
  const str = `${el.id}_c_${cycle}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const val = Math.abs(hash) % 100;
  return val < chance;
}

export interface RandomMuscleState {
  isFlexed: boolean;       // Мышца согнута (сокращена) в данный момент
  justFlexed: boolean;     // Произошел сгиб на данном шаге (однократный импульс поворота)
  justUnflexed: boolean;   // Произошел розгиб на данном шаге по вероятности
}

// Расчет состояния случайной мышцы (сгиб только по вероятности)
export function getRandomMuscleState(el: CreatureElement, step: number): RandomMuscleState {
  const intStep = Math.abs(Math.floor(step));
  if (intStep <= 0) {
    return { isFlexed: false, justFlexed: false, justUnflexed: false };
  }

  const isTriggeredNow = isRandomMuscleTriggered(el, intStep);
  const isTriggeredPrev = isRandomMuscleTriggered(el, intStep - 1);

  return {
    isFlexed: isTriggeredNow,
    justFlexed: isTriggeredNow && !isTriggeredPrev,
    justUnflexed: !isTriggeredNow && isTriggeredPrev,
  };
}

export function determineCreatureHeadAngle(elements: CreatureElement[]): number {
  const headEl = elements.find((e) => e.type === 'head' || e.type === 'head-jaw');
  if (headEl) {
    if (headEl.headAngle !== undefined) return headEl.headAngle;
    if (headEl.relX !== 0 || headEl.relY !== 0) {
      const rad = Math.atan2(headEl.relY, headEl.relX);
      let deg = Math.round((rad * 180) / Math.PI);
      if (deg < 0) deg += 360;
      return deg;
    }
  }
  return 270; // По умолчанию ВВЕРХ (270°)
}

// Расчет момента инерции по теореме Гюйгенса-Штейнера и центра масс
export function calculateHuygensSteinerInertia(elements: CreatureElement[]): {
  totalMass: number;
  comX: number;
  comY: number;
  totalInertia: number;
} {
  if (elements.length === 0) {
    return { totalMass: 1.0, comX: 0, comY: 0, totalInertia: 0.5 };
  }

  let sumMass = 0;
  let weightedX = 0;
  let weightedY = 0;
  const masses: number[] = [];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    let m = el.weight ?? 0;
    if (el.type === 'head' || el.type === 'head-jaw') m = 1.0;
    else if (el.type === 'joint') m = 0.2;
    else if (el.type.startsWith('edge-')) m = m > 0 ? m : 1.0;
    else if (el.type.startsWith('muscle-')) m = 0.1;
    else if (el.type === 'eye') m = 0.2;
    else if (el.type === 'mouth') m = 0.5;
    else if (m <= 0) m = 0.1;

    masses.push(m);
    sumMass += m;
    weightedX += m * el.relX;
    weightedY += m * el.relY;
  }

  if (sumMass < 0.1) sumMass = 1.0;
  const comX = weightedX / sumMass;
  const comY = weightedY / sumMass;

  let sumInertia = 0;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const m = masses[i];

    let iLocal = 0;
    switch (el.type) {
      case 'head':
      case 'head-jaw':
      case 'joint':
      case 'eye':
      case 'mouth':
        iLocal = 0.5 * m * 0.25; // Диск/точка R=0.5
        break;
      case 'edge-h':
      case 'edge-v':
        iLocal = (1 / 12) * m * 1.0; // Стержень L=1.0
        break;
      case 'edge-d1':
      case 'edge-d2':
        iLocal = (1 / 12) * m * 2.0; // Диагональный стержень L=sqrt(2)
        break;
      default:
        iLocal = (1 / 12) * m * 1.0;
    }

    const dx = el.relX - comX;
    const dy = el.relY - comY;
    const distSq = dx * dx + dy * dy;

    // Теорема Гюйгенса-Штейнера: I = I_local + m * d^2
    sumInertia += iLocal + m * distSq;
  }

  return {
    totalMass: Math.max(0.5, sumMass),
    comX,
    comY,
    totalInertia: Math.max(0.2, sumInertia),
  };
}

// Вычисление физических сил, момента инерции, масс и угла разворота
export function calculatePhysicsForces(elements: CreatureElement[], muscleActiveStep: number = 0): PhysicsForces {
  const { totalMass, comX, comY, totalInertia } = calculateHuygensSteinerInertia(elements);

  const muscleCycle = muscleActiveStep * 0.5;
  const contractFactor = 0.5 - 0.5 * Math.cos(muscleCycle * Math.PI);
  const isMuscleContracted = contractFactor > 0.1;

  const joints: { id: string; x: number; y: number }[] = [];
  const edgeElements: CreatureElement[] = [];
  const muscleElements: CreatureElement[] = [];

  let totalLeftMass = 0;
  let totalRightMass = 0;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    let elWeight = el.weight ?? 0;
    if (el.type === 'joint') {
      joints.push({ id: el.id, x: el.relX, y: el.relY });
      elWeight = 0.2;
    } else if (el.type.startsWith('edge-')) {
      edgeElements.push(el);
      if (elWeight <= 0) elWeight = 1.0;
    } else if (el.type.startsWith('muscle-')) {
      muscleElements.push(el);
      elWeight = 0.1;
    } else if (el.type === 'head' || el.type === 'head-jaw') {
      elWeight = 1.0;
    }

    if (el.relX < comX - 0.01) totalLeftMass += elWeight;
    else if (el.relX > comX + 0.01) totalRightMass += elWeight;
    else {
      totalLeftMass += elWeight * 0.5;
      totalRightMass += elWeight * 0.5;
    }
  }

  if (joints.length === 0) {
    joints.push({ id: 'center-joint', x: comX, y: comY });
  }

  const jointsPhysics: JointPhysics[] = [];
  let sumLeftTorque = 0;
  let sumRightTorque = 0;
  let totalActiveMusclesCount = 0;
  let motionActiveMusclesCount = 0;

  const hasMultipleJoints = joints.length > 1;

  // Пружинно-демпферные коэффициенты (Закон Гука с демпфированием)
  const kStiffness = 50.0;
  const cDamping = 5.0;

  for (let jIdx = 0; jIdx < joints.length; jIdx++) {
    const j = joints[jIdx];
    let jLeftMass = 0;
    let jRightMass = 0;
    let jLeftTorquePotential = 0;
    let jRightTorquePotential = 0;

    for (let eIdx = 0; eIdx < edgeElements.length; eIdx++) {
      const el = edgeElements[eIdx];
      const weight = el.weight || 1;
      const dx = el.relX - j.x;

      if (dx < 0) {
        const arm = -dx;
        const leverMultiplier = 1 + 0.5 * (arm - 1);
        jLeftMass += weight;
        jLeftTorquePotential += weight * leverMultiplier;
      } else if (dx > 0) {
        const arm = dx;
        const leverMultiplier = 1 + 0.5 * (arm - 1);
        jRightMass += weight;
        jRightTorquePotential += weight * leverMultiplier;
      } else {
        jLeftMass += weight * 0.5;
        jRightMass += weight * 0.5;
        jLeftTorquePotential += weight * 0.5;
        jRightTorquePotential += weight * 0.5;
      }
    }

    let activeLeftMuscles = 0;
    let activeRightMuscles = 0;

    for (let mIdx = 0; mIdx < muscleElements.length; mIdx++) {
      const el = muscleElements[mIdx];

      if (hasMultipleJoints) {
        const mdx = el.relX - j.x;
        const mdy = el.relY - j.y;
        if (mdx * mdx + mdy * mdy > 6.25) continue;
      }

      let providesTorque = false;
      let providesMotion = false;
      let muscleIntensity = 1.0;

      if (el.type === 'muscle-left' || el.type === 'muscle-right') {
        providesTorque = isMuscleContracted;
        providesMotion = true;
        muscleIntensity = contractFactor;
      } else if (el.type === 'muscle-random-left' || el.type === 'muscle-random-right') {
        const mState = getRandomMuscleState(el, muscleActiveStep);
        providesTorque = mState.justFlexed;
        providesMotion = mState.justFlexed || mState.justUnflexed;
        muscleIntensity = mState.justFlexed ? 1.0 : 0.5;
      }

      if (providesTorque) {
        // Модель пружинно-демпферной тяги F = k * deltaX - c * v_rel
        const deltaX = 0.35 * muscleIntensity;
        const vRel = 0.15 * muscleIntensity;
        const fSpring = Math.max(0.1, kStiffness * 0.04 * deltaX - cDamping * 0.02 * vRel);

        const arm = Math.max(1.0, Math.hypot(el.relX - j.x, el.relY - j.y));
        const torqueValue = fSpring * arm * 1.2;

        if (el.type.includes('left')) {
          activeLeftMuscles += torqueValue;
        } else if (el.type.includes('right')) {
          activeRightMuscles += torqueValue;
        }
      }

      if (providesMotion) {
        motionActiveMusclesCount++;
      }
    }

    const leftLever = Math.max(0.05, jLeftTorquePotential);
    const rightLever = Math.max(0.05, jRightTorquePotential);

    const jointLeftForce = activeLeftMuscles * leftLever;
    const jointRightForce = activeRightMuscles * rightLever;
    const netJointTorque = jointLeftForce - jointRightForce;

    jointsPhysics.push({
      jointId: j.id,
      jx: j.x,
      jy: j.y,
      leftEdgeMass: jLeftMass,
      rightEdgeMass: jRightMass,
      leftTorquePotential: jLeftTorquePotential,
      rightTorquePotential: jRightTorquePotential,
      activeLeftMuscles: Math.round(activeLeftMuscles * 10) / 10,
      activeRightMuscles: Math.round(activeRightMuscles * 10) / 10,
      netJointTorque,
    });

    sumLeftTorque += jointLeftForce;
    sumRightTorque += jointRightForce;
    totalActiveMusclesCount += (activeLeftMuscles + activeRightMuscles > 0 ? 1 : 0);
  }

  const netTorque = sumLeftTorque - sumRightTorque;

  // 1. Угол разворота: w = (Torque / Inertia) * C_rotation
  let netRotationDeg = 0;
  if (Math.abs(netTorque) > 0) {
    const rawRotation = (netTorque / totalInertia) * 24;
    netRotationDeg = Math.min(60, Math.max(-60, rawRotation));
  }

  const isLighterSideRotating = totalLeftMass !== totalRightMass && netTorque !== 0;

  // 2. Линейная скорость движения вперед: v = (Thrust / Mass) * C_speed
  let forwardSpeed = 0;
  if (motionActiveMusclesCount > 0 || sumLeftTorque > 0 || sumRightTorque > 0) {
    let thrust = 0;
    if (sumLeftTorque > 0 && sumRightTorque > 0) {
      thrust = (sumLeftTorque + sumRightTorque) * 0.95;
    } else if (sumLeftTorque > 0 || sumRightTorque > 0) {
      thrust = Math.max(sumLeftTorque, sumRightTorque) * 0.70;
    } else {
      thrust = 0.8 * motionActiveMusclesCount;
    }

    const calculatedSpeed = (thrust / totalMass) * 0.22;
    forwardSpeed = Math.min(0.45, Math.max(0.02, calculatedSpeed));
  }

  return {
    leftTorque: sumLeftTorque,
    rightTorque: sumRightTorque,
    netRotationDeg,
    forwardSpeed,
    leftMass: totalLeftMass,
    rightMass: totalRightMass,
    totalMass,
    totalInertia,
    centerOfMassX: comX,
    centerOfMassY: comY,
    isLighterSideRotating,
    jointsPhysics,
    activeMusclesCount: totalActiveMusclesCount,
  };
}

export function createCreature(
  id: string,
  name: string,
  x: number,
  y: number,
  presetIndex: number = 0,
  color: string = '#6366f1'
): Creature {
  const elements = JSON.parse(JSON.stringify(DEFAULT_PRESETS[presetIndex % DEFAULT_PRESETS.length].elements));
  const forces = calculatePhysicsForces(elements, 0);
  const initialAngle = determineCreatureHeadAngle(elements);

  return {
    id,
    name,
    color,
    x,
    y,
    elements,
    energy: 100,
    maxEnergy: 150,
    foodEaten: 0,
    stepsCount: 0,
    angleDeg: initialAngle,
    forces,
    state: 'idle',
    muscleStep: 0,
    moveProgress: 1,
    prevX: x,
    prevY: y,
    prevAngleDeg: initialAngle,
  };
}

// Найти ближайшую еду
export function findClosestFood(creature: Creature, foods: Food[]): Food | null {
  if (foods.length === 0) return null;
  let minDistanceSq = Infinity;
  let closest: Food | null = null;

  for (let i = 0; i < foods.length; i++) {
    const food = foods[i];
    const dx = food.x - creature.x;
    const dy = food.y - creature.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closest = food;
    }
  }

  return closest;
}

// Перемещение вектора вперед с учетом угла поворота
export function getVectorFromAngle(angleDeg: number): { dx: number; dy: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  return { dx, dy };
}

export interface BentElementPosition {
  id: string;
  relX: number; // Bent X coordinate relative to creature center (0,0)
  relY: number; // Bent Y coordinate relative to creature center (0,0)
  rotationDeg: number; // Accumulated rotation angle of this element
}

// Иерархический расчет кинематических сгибов плеч и шарниров по весам и активным мышцам
export function calculateKinematicBends(
  elements: CreatureElement[],
  muscleStep: number = 0,
  precalculatedForces?: PhysicsForces
): Map<string, BentElementPosition> {
  const result = new Map<string, BentElementPosition>();
  if (elements.length === 0) return result;

  const forces = precalculatedForces || calculatePhysicsForces(elements, muscleStep);
  const jointsPhysicsMap = new Map(forces.jointsPhysics.map((jp) => [jp.jointId, jp]));

  // Быстрый поиск по ID элементов
  const elementMap = new Map<string, CreatureElement>();
  const jointEls: CreatureElement[] = [];
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    elementMap.set(el.id, el);
    if (el.type === 'joint') {
      jointEls.push(el);
    }
  }

  const joints = jointEls.length > 0
    ? jointEls.map((j) => ({ id: j.id, x: j.relX, y: j.relY }))
    : [{ id: 'center-joint', x: 0, y: 0 }];

  // Найти корневой шарнир (ближайший к центру 0,0)
  let rootJoint = joints[0];
  let minDistSq = rootJoint.x * rootJoint.x + rootJoint.y * rootJoint.y;
  for (let i = 1; i < joints.length; i++) {
    const dSq = joints[i].x * joints[i].x + joints[i].y * joints[i].y;
    if (dSq < minDistSq) {
      minDistSq = dSq;
      rootJoint = joints[i];
    }
  }

  // 2. Сортируем шарниры по удаленности от корневого
  const sortedJoints = joints.length > 1
    ? [...joints].sort((a, b) => {
        const dA = (a.x - rootJoint.x) ** 2 + (a.y - rootJoint.y) ** 2;
        const dB = (b.x - rootJoint.x) ** 2 + (b.y - rootJoint.y) ** 2;
        return dA - dB;
      })
    : joints;

  interface JointNode {
    id: string;
    x: number;
    y: number;
    parent: JointNode | null;
    leftBendDeg: number;
    rightBendDeg: number;
    accumulatedRotDeg: number;
    worldX: number;
    worldY: number;
  }

  const nodeMap = new Map<string, JointNode>();
  const nodeList: JointNode[] = [];

  for (let i = 0; i < sortedJoints.length; i++) {
    const j = sortedJoints[i];
    let parentNode: JointNode | null = null;
    if (j.id !== rootJoint.id) {
      let parentMinDistSq = Infinity;
      for (let k = 0; k < nodeList.length; k++) {
        const candidate = nodeList[k];
        const dSq = (j.x - candidate.x) ** 2 + (j.y - candidate.y) ** 2;
        if (dSq < parentMinDistSq) {
          parentMinDistSq = dSq;
          parentNode = candidate;
        }
      }
    }

    const jp = jointsPhysicsMap.get(j.id);
    let leftBendDeg = 0;
    let rightBendDeg = 0;

    const contractFactor = 0.5 - 0.5 * Math.cos(muscleStep * Math.PI);

    if (jp) {
      if (jp.activeLeftMuscles > 0.01) {
        const mass = Math.max(0.5, jp.leftEdgeMass);
        const weightFactor = Math.min(2.0, Math.max(0.4, (1 + jp.activeLeftMuscles * 0.6) / (1 + mass * 0.35)));
        leftBendDeg = -14.0 * weightFactor * contractFactor;
      }
      if (jp.activeRightMuscles > 0.01) {
        const mass = Math.max(0.5, jp.rightEdgeMass);
        const weightFactor = Math.min(2.0, Math.max(0.4, (1 + jp.activeRightMuscles * 0.6) / (1 + mass * 0.35)));
        rightBendDeg = 14.0 * weightFactor * contractFactor;
      }
    }

    let accumulatedRotDeg = 0;
    let worldX = j.x;
    let worldY = j.y;

    if (parentNode) {
      const parentDx = j.x - parentNode.x;
      const parentSideBend = parentDx < 0 ? parentNode.leftBendDeg : parentDx > 0 ? parentNode.rightBendDeg : 0;
      accumulatedRotDeg = parentNode.accumulatedRotDeg + parentSideBend;

      const rad = (accumulatedRotDeg * Math.PI) / 180;
      const rotX = parentDx * Math.cos(rad) - (j.y - parentNode.y) * Math.sin(rad);
      const rotY = parentDx * Math.sin(rad) + (j.y - parentNode.y) * Math.cos(rad);
      worldX = parentNode.worldX + rotX;
      worldY = parentNode.worldY + rotY;
    }

    const node: JointNode = {
      id: j.id,
      x: j.x,
      y: j.y,
      parent: parentNode,
      leftBendDeg,
      rightBendDeg,
      accumulatedRotDeg,
      worldX,
      worldY,
    };

    nodeMap.set(j.id, node);
    nodeList.push(node);

    const jointEl = elementMap.get(j.id);
    if (jointEl) {
      result.set(jointEl.id, {
        id: jointEl.id,
        relX: worldX,
        relY: worldY,
        rotationDeg: accumulatedRotDeg,
      });
    }
  }

  // 3. Для всех не-шарнирных элементов привязываем их к ближайшему шарнирному узлу
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.type === 'joint') continue;

    let closestNode: JointNode = nodeList[0] || nodeMap.get(rootJoint.id)!;
    let closestDistSq = Infinity;

    for (let k = 0; k < nodeList.length; k++) {
      const node = nodeList[k];
      const dSq = (el.relX - node.x) ** 2 + (el.relY - node.y) ** 2;
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        closestNode = node;
      }
    }

    const dx = el.relX - closestNode.x;
    const dy = el.relY - closestNode.y;
    const sideBendDeg = dx < 0 ? closestNode.leftBendDeg : dx > 0 ? closestNode.rightBendDeg : 0;
    const totalElementRotDeg = closestNode.accumulatedRotDeg + sideBendDeg;

    const rad = (totalElementRotDeg * Math.PI) / 180;
    const rotX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const rotY = dx * Math.sin(rad) + dy * Math.cos(rad);

    result.set(el.id, {
      id: el.id,
      relX: closestNode.worldX + rotX,
      relY: closestNode.worldY + rotY,
      rotationDeg: totalElementRotDeg,
    });
  }

  return result;
}

// Расчет всех точек чудика в мировых координатах с учетом изгибов
export function getCreatureElementWorldPositions(
  cx: number,
  cy: number,
  angleDeg: number,
  elements: CreatureElement[],
  muscleStep: number = 0,
  precalculatedForces?: PhysicsForces
): { x: number; y: number }[] {
  const baseHeadAngle = determineCreatureHeadAngle(elements);
  const rotRad = ((angleDeg - baseHeadAngle) * Math.PI) / 180;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);

  const points: { x: number; y: number }[] = [{ x: cx, y: cy }];

  const bentMap = calculateKinematicBends(elements, muscleStep, precalculatedForces);

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const bent = bentMap.get(el.id) || { relX: el.relX, relY: el.relY, rotationDeg: 0 };
    const wx = cx + bent.relX * cos - bent.relY * sin;
    const wy = cy + bent.relX * sin + bent.relY * cos;
    points.push({ x: wx, y: wy });

    if (el.type.startsWith('edge-')) {
      points.push({
        x: cx + (bent.relX * cos - bent.relY * sin) * 0.5,
        y: cy + (bent.relX * sin + bent.relY * cos) * 0.5,
      });
    }
  }


  return points;
}

export interface ConnectivityResult {
  isConnected: boolean;
  isValid: boolean;
  connectedIds: Set<string>;
  disconnectedIds: Set<string>;
  unattachedMuscleIds: Set<string>;
  unattachedJawIds: Set<string>;
}

// Проверка связности всех элементов чудика и правил:
// 1. Мышцы крепятся только к шарнирам (◯)
// 2. Челюсти (🦷) крепятся только к голове (👁️)
export function getCreatureConnectivity(elements: CreatureElement[]): ConnectivityResult {
  // Найти шарнирные координаты
  const jointCoords = new Set<string>();
  // Найти координаты голов
  const headCoords = new Set<string>();

  elements.forEach((el) => {
    if (el.type === 'joint') {
      jointCoords.add(`${el.relX},${el.relY}`);
    } else if (el.type === 'head') {
      headCoords.add(`${el.relX},${el.relY}`);
    }
  });

  // Найти мышцы, не прикрепленные к шарниру
  const unattachedMuscleIds = new Set<string>();
  // Найти челюсти, не прикрепленные к голове
  const unattachedJawIds = new Set<string>();

  elements.forEach((el) => {
    const coordKey = `${el.relX},${el.relY}`;
    if (el.type.startsWith('muscle-')) {
      if (!jointCoords.has(coordKey)) {
        unattachedMuscleIds.add(el.id);
      }
    } else if (el.type === 'head-jaw') {
      if (!headCoords.has(coordKey)) {
        unattachedJawIds.add(el.id);
      }
    }
  });

  if (elements.length <= 1) {
    return {
      isConnected: true,
      isValid: unattachedMuscleIds.size === 0 && unattachedJawIds.size === 0,
      connectedIds: new Set(elements.map((e) => e.id)),
      disconnectedIds: new Set(),
      unattachedMuscleIds,
      unattachedJawIds,
    };
  }

  // Выбор опорного элемента: сначала Голова, затем Шарнир, иначе первый элемент
  let rootIdx = elements.findIndex((e) => e.type === 'head');
  if (rootIdx === -1) rootIdx = elements.findIndex((e) => e.type === 'joint');
  if (rootIdx === -1) rootIdx = 0;

  const connectedIndices = new Set<number>();
  const queue: number[] = [rootIdx];
  connectedIndices.add(rootIdx);

  while (queue.length > 0) {
    const currIdx = queue.shift()!;
    const curr = elements[currIdx];

    for (let i = 0; i < elements.length; i++) {
      if (connectedIndices.has(i)) continue;
      const other = elements[i];
      const dx = Math.abs(curr.relX - other.relX);
      const dy = Math.abs(curr.relY - other.relY);

      // Связанные элементы находятся в соседних клетках сетки (dx <= 1, dy <= 1)
      if (dx <= 1 && dy <= 1) {
        connectedIndices.add(i);
        queue.push(i);
      }
    }
  }

  const connectedIds = new Set<string>();
  const disconnectedIds = new Set<string>();

  elements.forEach((el, idx) => {
    if (connectedIndices.has(idx)) {
      connectedIds.add(el.id);
    } else {
      disconnectedIds.add(el.id);
    }
  });

  const isConnected = disconnectedIds.size === 0;

  return {
    isConnected,
    isValid: isConnected && unattachedMuscleIds.size === 0 && unattachedJawIds.size === 0,
    connectedIds,
    disconnectedIds,
    unattachedMuscleIds,
    unattachedJawIds,
  };
}

// Расчет квадрата расстояния от точки (px, py) до отрезка (ax, ay) -> (bx, by)
export function pointToSegmentDistanceSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) {
    return (px - ax) ** 2 + (py - ay) ** 2;
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return (px - projX) ** 2 + (py - projY) ** 2;
}

// Точная проверка столкновения с едой с учетом заметаемого траекторного отрезка чудика и всех его деталей
export function findEatenFood(
  prevX: number,
  prevY: number,
  prevAngleDeg: number,
  nextX: number,
  nextY: number,
  nextAngleDeg: number,
  elements: CreatureElement[],
  foods: Food[],
  ignoreIds: Set<string> = new Set(),
  muscleStep: number = 0,
  forces?: PhysicsForces,
  maxRadius: number = 0.7 // Радиус касания: 0.5 клетки (элемент) + 0.2 клетки (еда)
): Food | null {
  if (foods.length === 0) return null;

  const maxRadiusSq = maxRadius * maxRadius;

  // Точки чудика в начале движения
  const startPoints = getCreatureElementWorldPositions(prevX, prevY, prevAngleDeg, elements, muscleStep, forces);
  // Точки чудика в конце движения
  const endPoints = getCreatureElementWorldPositions(nextX, nextY, nextAngleDeg, elements, muscleStep, forces);

  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    if (ignoreIds.has(f.id)) continue;

    // 1. Проверка непрерывной траектории центра чудика
    if (pointToSegmentDistanceSq(f.x, f.y, prevX, prevY, nextX, nextY) <= maxRadiusSq) {
      return f;
    }

    // 2. Проверка непрерывных траекторий каждой физической детали (голова, щупальца, края)
    for (let p = 0; p < endPoints.length; p++) {
      const sp = startPoints[p] || { x: prevX, y: prevY };
      const ep = endPoints[p];
      if (pointToSegmentDistanceSq(f.x, f.y, sp.x, sp.y, ep.x, ep.y) <= maxRadiusSq) {
        return f;
      }
    }
  }

  return null;
}

export function calculateCreatureRadius(elements: CreatureElement[]): number {
  let maxR = 0.5; // Радиус касания отдельной детали = 0.5 клетки (полклетки)
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const r = Math.hypot(el.relX, el.relY) + 0.5;
    if (r > maxR) maxR = r;
  }
  return maxR;
}

export interface CreatureCollisionResult {
  creatures: Creature[];
  hasCollided: boolean;
  maxImpulse: number;
}

// Физический расчет столкновений чудиков с учетом масс, момента инерции, отдачи и углового кручения
export function resolveCreatureCollisions(creatures: Creature[], worldRadius: number = 50): CreatureCollisionResult {
  if (creatures.length < 2) {
    return { creatures, hasCollided: false, maxImpulse: 0 };
  }

  const ELEMENT_RADIUS = 0.5; // Радиус детали = полклетки
  const list = creatures.map((c) => ({ ...c }));
  let hasCollided = false;
  let maxImpulse = 0;

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const cA = list[i];
      const cB = list[j];

      // Safe Zone Base Rule: Creatures inside the base do not collide or push each other
      const inBaseA = cA.inBase || isInsideBase(cA.x, cA.y, worldRadius);
      const inBaseB = cB.inBase || isInsideBase(cB.x, cB.y, worldRadius);
      if (inBaseA || inBaseB) {
        continue;
      }

      const rA = calculateCreatureRadius(cA.elements);
      const rB = calculateCreatureRadius(cB.elements);

      const centerDist = Math.hypot(cB.x - cA.x, cB.y - cA.y);
      if (centerDist >= rA + rB) continue;

      // Вычисление точных мировых координат всех элементов
      const ptsA = getCreatureElementWorldPositions(cA.x, cA.y, cA.angleDeg, cA.elements, cA.muscleStep, cA.forces);
      const ptsB = getCreatureElementWorldPositions(cB.x, cB.y, cB.angleDeg, cB.elements, cB.muscleStep, cB.forces);

      let minElDist = Infinity;
      let contactPtA = { x: cA.x, y: cA.y };
      let contactPtB = { x: cB.x, y: cB.y };

      // Поиск минимального расстояния между элементами A и B
      for (let pa = 0; pa < ptsA.length; pa++) {
        for (let pb = 0; pb < ptsB.length; pb++) {
          const edx = ptsB[pb].x - ptsA[pa].x;
          const edy = ptsB[pb].y - ptsA[pa].y;
          const edist = Math.hypot(edx, edy);

          if (edist < minElDist) {
            minElDist = edist;
            contactPtA = ptsA[pa];
            contactPtB = ptsB[pb];
          }
        }
      }

      // Касание происходит, когда расстояния между деталями < 1.0 клетки (0.5 + 0.5)
      const touchDist = ELEMENT_RADIUS * 2;
      if (minElDist >= touchDist) continue;

      hasCollided = true;

      // Вектор от точки контакта A к точке контакта B
      let nx = contactPtB.x - contactPtA.x;
      let ny = contactPtB.y - contactPtA.y;
      let len = Math.hypot(nx, ny);

      if (len < 0.0001) {
        nx = cB.x - cA.x;
        ny = cB.y - cA.y;
        len = Math.hypot(nx, ny);
        if (len < 0.0001) {
          nx = 1;
          ny = 0;
          len = 1;
        }
      }

      nx /= len;
      ny /= len;

      const mA = Math.max(0.5, cA.forces?.totalMass || cA.elements.length * 1.2);
      const mB = Math.max(0.5, cB.forces?.totalMass || cB.elements.length * 1.2);
      const iA = Math.max(1, cA.forces?.totalInertia || mA * Math.pow(rA, 2) * 0.5);
      const iB = Math.max(1, cB.forces?.totalInertia || mB * Math.pow(rB, 2) * 0.5);

      // 1. Позиционное разделение при перекрытии (устраняет вклинивание деталей)
      const overlap = touchDist - minElDist;
      if (overlap > 0) {
        const pushA = overlap * (mB / (mA + mB));
        const pushB = overlap * (mA / (mA + mB));

        cA.x -= nx * pushA;
        cA.y -= ny * pushA;
        cB.x += nx * pushB;
        cB.y += ny * pushB;
      }

      // 2. Векторы относительно центров масс
      const rxA = contactPtA.x - cA.x;
      const ryA = contactPtA.y - cA.y;
      const rxB = contactPtB.x - cB.x;
      const ryB = contactPtB.y - cB.y;

      // 3. Определение физических скоростей движения
      const speedA = (cA.forces?.forwardSpeed ?? 0.3) * 0.35;
      const speedB = (cB.forces?.forwardSpeed ?? 0.3) * 0.35;

      const radA = (cA.angleDeg * Math.PI) / 180;
      const radB = (cB.angleDeg * Math.PI) / 180;

      const vAx = speedA * Math.cos(radA);
      const vAy = speedA * Math.sin(radA);

      const vBx = speedB * Math.cos(radB);
      const vBy = speedB * Math.sin(radB);

      // Проекции скоростей на нормаль сближения n
      const vAn = vAx * nx + vAy * ny;
      const vBn = vBx * nx + vBy * ny;

      // Относительная скорость сближения
      const vRelN = vAn - vBn;

      // Импульсный обмен происходит только при сближении (vRelN > 0)
      if (vRelN > 0) {
        const restitution = 0.55; // Коэффициент упругости
        const frictionCoef = 0.35; // Трение при касательных ударах

        // Момент инерции вдоль нормали (r x n)
        const rnA = rxA * ny - ryA * nx;
        const rnB = rxB * ny - ryB * nx;
        const kn = 1 / mA + 1 / mB + (rnA * rnA) / iA + (rnB * rnB) / iB;

        const impulseN = ((1 + restitution) * vRelN) / kn;
        if (impulseN > maxImpulse) maxImpulse = impulseN;

        // Касательное трение (вращательное скольжение)
        const tx = -ny;
        const ty = nx;
        const vAt = vAx * tx + vAy * ty;
        const vBt = vBx * tx + vBy * ty;
        const vRelT = vAt - vBt;

        const rtA = rxA * ty - ryA * tx;
        const rtB = rxB * ty - ryB * tx;
        const kt = 1 / mA + 1 / mB + (rtA * rtA) / iA + (rtB * rtB) / iB;

        const maxFriction = frictionCoef * impulseN;
        const impulseT = Math.max(-maxFriction, Math.min(maxFriction, vRelT / kt));

        // Векторы импульсов сил: на A (-J), на B (+J)
        const jAx = -(impulseN * nx + impulseT * tx);
        const jAy = -(impulseN * ny + impulseT * ty);
        const jBx = +(impulseN * nx + impulseT * tx);
        const jBy = +(impulseN * ny + impulseT * ty);

        // Линейная отдача после удара (пропорциональна обратному весу)
        const recoilFactor = 0.45;
        cA.x += (jAx / mA) * recoilFactor;
        cA.y += (jAy / mA) * recoilFactor;
        cB.x += (jBx / mB) * recoilFactor;
        cB.y += (jBy / mB) * recoilFactor;

        // Вращательные моменты (Torque) от удара относительно центров масс
        const torqueA = rxA * jAy - ryA * jAx;
        const torqueB = rxB * jBy - ryB * jBx;

        // Поворот угла тела, пропорциональный крутящему моменту (torque) и обратному моменту инерции (I)
        const dAngleA = (torqueA / iA) * (180 / Math.PI) * 1.25;
        const dAngleB = (torqueB / iB) * (180 / Math.PI) * 1.25;

        // Ограничиваем максимальный поворот от одного столкновения (не более 30°)
        const clampedDA = Math.max(-30, Math.min(30, dAngleA));
        const clampedDB = Math.max(-30, Math.min(30, dAngleB));

        cA.angleDeg = (cA.angleDeg + clampedDA + 360) % 360;
        cB.angleDeg = (cB.angleDeg + clampedDB + 360) % 360;
      }
    }
  }

  return { creatures: list, hasCollided, maxImpulse };
}

// Разделение элементов на связные компоненты связного графа (соседство по сетке: max(|dx|,|dy|) <= 1)
export function findConnectedComponents(elements: CreatureElement[]): CreatureElement[][] {
  const n = elements.length;
  if (n === 0) return [];

  const visited = new Array(n).fill(false);
  const components: CreatureElement[][] = [];

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;

    const comp: CreatureElement[] = [];
    const queue = [i];
    visited[i] = true;

    while (queue.length > 0) {
      const currIdx = queue.shift()!;
      const currEl = elements[currIdx];
      comp.push(currEl);

      for (let j = 0; j < n; j++) {
        if (visited[j]) continue;
        const otherEl = elements[j];
        const dx = Math.abs(currEl.relX - otherEl.relX);
        const dy = Math.abs(currEl.relY - otherEl.relY);
        if (dx <= 1.05 && dy <= 1.05) {
          visited[j] = true;
          queue.push(j);
        }
      }
    }
    components.push(comp);
  }

  return components;
}

// Выбор выжившего фрагмента: максимум голов > наибольшая масса > случайный выбор
export function selectWinningComponent(components: CreatureElement[][]): CreatureElement[] {
  if (components.length === 0) return [];
  if (components.length === 1) return components[0];

  const stats = components.map((comp) => {
    let headCount = 0;
    let totalMass = 0;
    for (const el of comp) {
      if (el.type === 'head') {
        headCount++;
        totalMass += 0.5;
      } else if (el.type === 'joint') {
        totalMass += 1.0;
      } else if (el.type.startsWith('edge-')) {
        totalMass += 1.0;
      } else if (el.type.startsWith('muscle-')) {
        totalMass += 0.3;
      } else {
        totalMass += 0.5;
      }
    }
    return { comp, headCount, totalMass };
  });

  const maxHeads = Math.max(...stats.map((s) => s.headCount));
  const headCandidates = stats.filter((s) => s.headCount === maxHeads);

  if (headCandidates.length === 1) {
    return headCandidates[0].comp;
  }

  const maxMass = Math.max(...headCandidates.map((s) => s.totalMass));
  const massCandidates = headCandidates.filter((s) => Math.abs(s.totalMass - maxMass) < 1e-4);

  if (massCandidates.length === 1) {
    return massCandidates[0].comp;
  }

  const rndIdx = Math.floor(Math.random() * massCandidates.length);
  return massCandidates[rndIdx].comp;
}

export function normalizeAngleDeg(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

// Укусы чудиков (Канибализм):
// 1. Возможен только если у чудика есть челюсть (head-jaw), прикрепленная к голове.
// 2. Челюсть захватывает сектор 60 градусов (±30°) в направлении взгляда головы.
export function resolveCreatureBites(creatures: Creature[]): { creatures: Creature[]; hasBitten: boolean } {
  if (creatures.length < 2) {
    return { creatures, hasBitten: false };
  }

  const biteTouchDist = 1.25;
  let hasBitten = false;

  interface BiteEvent {
    biterId: string;
    targetId: string;
    targetElemIdx: number;
  }

  const biteEvents: BiteEvent[] = [];

  for (let i = 0; i < creatures.length; i++) {
    const cA = creatures[i];
    const ptsA = getCreatureElementWorldPositions(cA.x, cA.y, cA.angleDeg, cA.elements);

    // Координаты всех голов чудика
    const headCoords = new Map<string, CreatureElement>();
    cA.elements.forEach((el) => {
      if (el.type === 'head') {
        headCoords.set(`${el.relX},${el.relY}`, el);
      }
    });

    const baseHeadAngle = determineCreatureHeadAngle(cA.elements);
    const deltaRot = cA.angleDeg - baseHeadAngle;

    interface ActiveJaw {
      point: Point;
      worldGazeAngle: number;
    }
    const activeJaws: ActiveJaw[] = [];

    // Правило: Канибализм возможен ТОЛЬКО если у чудика есть челюсть (head-jaw), прикрепленная к голове
    cA.elements.forEach((el, idx) => {
      if (el.type === 'head-jaw') {
        const coordKey = `${el.relX},${el.relY}`;
        const parentHead = headCoords.get(coordKey);
        // Челюсть должна быть прикреплена к голове
        if (parentHead || el.headAngle !== undefined) {
          if (idx + 1 < ptsA.length) {
            const jawPos = ptsA[idx + 1];
            const hAngle = el.headAngle !== undefined
              ? el.headAngle
              : (parentHead?.headAngle !== undefined ? parentHead.headAngle : baseHeadAngle);
            const worldGazeAngle = hAngle + deltaRot;
            activeJaws.push({
              point: jawPos,
              worldGazeAngle,
            });
          }
        }
      }
    });

    if (activeJaws.length === 0) continue;

    for (let j = 0; j < creatures.length; j++) {
      if (i === j) continue;
      const cB = creatures[j];

      const rA = calculateCreatureRadius(cA.elements);
      const rB = calculateCreatureRadius(cB.elements);
      const centerDist = Math.hypot(cB.x - cA.x, cB.y - cA.y);
      if (centerDist > rA + rB + 2.0) continue;

      const ptsB = getCreatureElementWorldPositions(cB.x, cB.y, cB.angleDeg, cB.elements);

      let bitten = false;
      for (const jaw of activeJaws) {
        if (bitten) break;
        for (let elIdx = 0; elIdx < cB.elements.length; elIdx++) {
          if (elIdx + 1 >= ptsB.length) continue;
          const bPt = ptsB[elIdx + 1];

          let dx = bPt.x - jaw.point.x;
          if (dx > 50) dx -= 100;
          else if (dx < -50) dx += 100;

          let dy = bPt.y - jaw.point.y;
          if (dy > 50) dy -= 100;
          else if (dy < -50) dy += 100;

          const dist = Math.hypot(dx, dy);
          if (dist <= biteTouchDist) {
            // Правило: Челюсть захватывает сектор 60 градусов (±30°) в направлении взгляда головы
            const targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
            const angleDiff = Math.abs(normalizeAngleDeg(targetAngle - jaw.worldGazeAngle));

            if (angleDiff <= 30) {
              biteEvents.push({
                biterId: cA.id,
                targetId: cB.id,
                targetElemIdx: elIdx,
              });
              bitten = true;
              break;
            }
          }
        }
      }
    }
  }

  const creatureMap = new Map<string, Creature>(creatures.map((c) => [c.id, c]));

  for (const bEvent of biteEvents) {
    const cA = creatureMap.get(bEvent.biterId);
    const cB = creatureMap.get(bEvent.targetId);
    if (!cA || !cB) continue;
    if (bEvent.targetElemIdx >= cB.elements.length) continue;

    const targetEl = cB.elements[bEvent.targetElemIdx];
    let removeIdx = -1;

    if (targetEl.type === 'joint') {
      const muscleIdx = cB.elements.findIndex((el) => {
        if (el.type.startsWith('muscle-')) {
          const dx = Math.abs(el.relX - targetEl.relX);
          const dy = Math.abs(el.relY - targetEl.relY);
          return dx <= 1.05 && dy <= 1.05;
        }
        return false;
      });

      if (muscleIdx !== -1) {
        removeIdx = muscleIdx;
      } else {
        removeIdx = bEvent.targetElemIdx;
      }
    } else {
      removeIdx = bEvent.targetElemIdx;
    }

    if (removeIdx >= 0 && removeIdx < cB.elements.length) {
      hasBitten = true;
      const remainingEls = cB.elements.filter((_, idx) => idx !== removeIdx);

      const comps = findConnectedComponents(remainingEls);
      const winningComp = selectWinningComponent(comps);

      cB.elements = winningComp;

      if (cB.elements.length === 0) {
        creatureMap.delete(cB.id);
        cA.foodEaten = (cA.foodEaten || 0) + 5;
      } else {
        cB.forces = calculatePhysicsForces(cB.elements, cB.muscleStep || 0);
        cA.foodEaten = (cA.foodEaten || 0) + 1;
      }
    }
  }

  return { creatures: Array.from(creatureMap.values()), hasBitten };
}
