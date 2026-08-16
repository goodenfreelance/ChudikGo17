export interface Point {
  x: number;
  y: number;
}

export type ElementType =
  | 'head'          // Голова мирная (Определяет ВПЕРЕД для чудика, мирное поедание ягод, вес 0, 50 еды)
  | 'head-jaw'      // Челюсти / Зубастая голова (Кусает других игроков и отрывает элементы, вес 0, 180 еды)
  | 'joint'         // Шарнир на узле (вес 0, 15 еды)
  | 'edge-h'        // Горизонтальное ребро (вес 1, 10 еды)
  | 'edge-v'        // Вертикальное ребро (вес 1, 10 еды)
  | 'edge-d1'       // Диагональное ребро / (вес 1, 10 еды)
  | 'edge-d2'       // Диагональное ребро \ (вес 1, 10 еды)
  | 'muscle-left'   // Мышца левого сгиба (сокращает шарнир влево, 25 еды)
  | 'muscle-right'  // Мышца правого сгиба (сокращает шарнир вправо, 25 еды)
  | 'muscle-random-left'  // Случайная мышца слева (35 еды)
  | 'muscle-random-right' // Случайная мышца справа (35 еды)
  | 'eye'           // Глаз
  | 'mouth';        // Рот

export interface WorldRules {
  worldBoundsX: number;
  worldBoundsY: number;
  tickRate: number;
  enableCannibalism: boolean;
  unlimitedElements?: boolean;
}

export interface PhysicsRules {
  restitutionCoefficient: number;
  dashMultiplier: number;
  dashFoodCostPerSecond: number;
  maxSpeed?: number;
  dragLinear: number;
  dragAngular: number;
  muscleStiffness: number;
  muscleDamping: number;
  sleepVelocityThreshold: number;
}

export interface ElementMasses {
  massHead: number;
  massBone: number;
  massJoint: number;
  massMuscle: number;
  massEye: number;
  massMouth: number;
}

export interface EconomyConfig {
  starterBankFood: number;
  foodBerryValue: number;
  foodGoldenValue: number;
  elementPrices: Record<string, number>;
}

export interface WorldConfig {
  world: WorldRules;
  physics: PhysicsRules;
  elementMasses: ElementMasses;
  economy: EconomyConfig;
}

export interface CreatureElement {
  id: string;
  relX: number; // Координата относительно центрального шарнира
  relY: number;
  type: ElementType;
  weight: number; // 1 для ребер, 0 для шарнира / головы
  musclePhase?: number; // Фаза сокращения мышцы
  headAngle?: number; // 270 (Вверх), 0 (Вправо), 90 (Вниз), 180 (Влево)
  randomChance?: number; // Вероятность срабатывания случайной мышцы каждый ход (от 5% до 90%)
  isStarter?: boolean; // Стартовый бесплатный элемент (0 еды, не возвращает стоимость при удалении)
}

export interface JointPhysics {
  jointId: string;
  jx: number;
  jy: number;
  leftEdgeMass: number;
  rightEdgeMass: number;
  leftTorquePotential: number;
  rightTorquePotential: number;
  activeLeftMuscles: number;
  activeRightMuscles: number;
  netJointTorque: number;
}

export interface PhysicsForces {
  leftTorque: number;       // Сила кручения влево
  rightTorque: number;      // Сила кручения вправо
  netRotationDeg: number;   // Поворот на шаг (градусы)
  forwardSpeed: number;     // Скорость движения вперед
  leftMass: number;         // Масса левого плеча
  rightMass: number;        // Масса правого плеча
  totalMass: number;        // Общая масса
  totalInertia: number;     // Момент инерции вокруг центра масс (Теорема Гюйгенса-Штейнера)
  centerOfMassX?: number;   // Смещение центра масс по X
  centerOfMassY?: number;   // Смещение центра масс по Y
  isLighterSideRotating: boolean; // Вращается легкое плечо вокруг шарнира
  jointsPhysics?: JointPhysics[]; // Расчет физики относительно каждого шарнира
  activeMusclesCount?: number;    // Число сработавших мышц на шаге
}

export interface Creature {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  elements: CreatureElement[];
  energy: number;
  maxEnergy: number;
  foodEaten: number;
  bankFood?: number;
  inBase?: boolean;
  stepsCount: number;
  angleDeg: number;
  forces: PhysicsForces;
  state: 'idle' | 'hunting' | 'eating' | 'moving' | 'dashing' | 'braking';
  muscleStep: number;
  moveProgress?: number;
  prevX: number;
  prevY: number;
  prevAngleDeg: number;
  velX?: number;
  velY?: number;
  angularVel?: number;
  isSleeping?: boolean;
  isBraking?: boolean;
}

export interface Food {
  id: string;
  x: number;
  y: number;
  value: number;
  type: 'berry' | 'super' | 'golden';
  spawnTime: number;
}

export type GridTheme = 'notebook' | 'blueprint' | 'dark' | 'paper' | 'game' | 'game-light' | 'cartoon' | 'cartoon2';

export interface SimulationStats {
  foodEatenTotal: number;
  creaturesCreated: number;
  currentStep: number;
}

export interface PendingPlacement {
  name: string;
  elements: CreatureElement[];
  color: string;
  angleDeg: number;
}

export interface CreatureLogEntry {
  id: string;
  timestamp: string;
  creatureId: string;
  name: string;
  color: string;
  action: 'создан' | 'размещен' | 'изменен' | 'сохранен' | 'пресет';
  initialX: number;
  initialY: number;
  initialAngleDeg: number;
  elementCount: number;
  leftMass: number;
  rightMass: number;
  totalMass: number;
  randomMusclesInfo: string;
  elements: CreatureElement[];
}

export interface User {
  id: string;
  username: string;
  isAdmin?: boolean;
  food?: number;
  bankFood?: number;
}

export interface SavedPreset {
  id: string;
  name: string;
  description: string;
  color: string;
  elements: CreatureElement[];
  createdAt: string;
  isDb?: boolean;
  authorUsername?: string;
  userId?: string;
}

