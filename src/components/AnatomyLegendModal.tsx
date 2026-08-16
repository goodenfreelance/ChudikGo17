import React, { useState } from 'react';
import { X, HelpCircle, Scale, Zap, RotateCw, Activity, ShieldAlert, Cpu } from 'lucide-react';

interface AnatomyLegendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnatomyLegendModal: React.FC<AnatomyLegendModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'basics' | 'collisions'>('basics');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-900/40 border border-indigo-500/30 text-indigo-400 rounded-xl">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                Физика, Биомеханика и Столкновения 'Чудиков'
              </h2>
              <p className="text-xs text-slate-400">
                Математическая модель движения, рассчитать масс, скоростей и импульсов
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('basics')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition border-b-2 cursor-pointer ${
              activeTab === 'basics'
                ? 'border-indigo-500 text-indigo-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Анатомия и Движение
          </button>
          <button
            onClick={() => setActiveTab('collisions')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition border-b-2 cursor-pointer ${
              activeTab === 'collisions'
                ? 'border-indigo-500 text-indigo-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Физика Столкновений (p = m·v)
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300 max-h-[65vh]">
          {activeTab === 'basics' ? (
            <>
              {/* Rules Banner */}
              <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 font-bold text-indigo-300">
                  <Scale className="w-4 h-4 text-indigo-400" />
                  <span>Правило физического баланса:</span>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-slate-300 leading-relaxed">
                  <li>
                    <b>1. Вращение легкой стороны:</b> Вращается то плечо, ребро которого <b>легче</b> по суммарной массе относительно шарнира (m_left vs m_right). При равенстве выбор случаен.
                  </li>
                  <li>
                    <b>2. Оценка силы вращения:</b> 1 балл за каждое ребро после шарнира (1 ребро = поворот на 45°, 2 ребра = 90°).
                  </li>
                  <li>
                    <b>3. Разность сил и баланс:</b> При противоположных моментах сбалансированная часть дает <b>поступательный шаг вперед</b> (v_forward = 0.25 клетки), а разность моментов даёт поворот угла ориентации!
                  </li>
                  <li>
                    <b>4. Зависимость от мышц:</b> Без мышц чудик зафиксирован на месте (v = 0). Движение происходит строго ритмично во время сгибания и распрямления.
                  </li>
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Edges */}
                <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl flex flex-col gap-2">
                  <div className="w-9 h-9 rounded-lg bg-blue-950/50 border border-blue-500/30 font-mono font-bold text-lg flex items-center justify-center text-blue-400">
                    — | / \
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100">1. Ребра (Каркас)</h4>
                    <p className="text-2xs text-slate-400 mt-1">
                      Линии длиной в 1 клетку. Каждое ребро имеет <b>Массу m = 1.0</b>.
                    </p>
                  </div>
                </div>

                {/* Joint */}
                <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl flex flex-col gap-2">
                  <div className="w-9 h-9 rounded-lg bg-sky-950/50 border border-sky-500/30 font-mono font-bold text-lg flex items-center justify-center text-sky-400">
                    ◯
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100">2. Шарнир (Узел)</h4>
                    <p className="text-2xs text-slate-400 mt-1">
                      Точка соединения ребер. <b>Масса = 0.0</b>. Служит осью вращения.
                    </p>
                  </div>
                </div>

                {/* Muscle */}
                <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl flex flex-col gap-2">
                  <div className="w-9 h-9 rounded-lg bg-rose-950/50 border border-rose-500/30 font-mono font-bold text-lg flex items-center justify-center text-rose-400">
                    ⟲ 🎲
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100">3. Мышцы</h4>
                    <p className="text-2xs text-slate-400 mt-1">
                      Создают сгибающий момент. <b>Случайные мышцы (🎲)</b> срабатывают с шансом от 4% до 20%.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Collision Physics Explanation */}
              <div className="space-y-3">
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-400">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Геометрия и Радиус Касания:</span>
                  </div>
                  <p className="text-2xs leading-relaxed text-slate-300">
                    Радиус соприкосновения каждой детали равен <b>0.5 клетки (полклетки)</b>. Столкновение двух элементов происходит, когда расстояние между их центрами меньше <b>1.0 клетки</b> (0.5 + 0.5).
                  </p>
                </div>

                <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-indigo-300">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                    <span>Закон Сохранения Импульса (p = m · v):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1.5 text-2xs text-slate-300 leading-relaxed">
                    <li>
                      <b>1. Нормаль контакта (n):</b> Рассчитывается точный вектор нормали между соприкоснувшимися мировыми точками деталей p_A и p_B.
                    </li>
                    <li>
                      <b>2. Ударный импульс (J):</b> Формула упругого удара:
                      <div className="font-mono bg-slate-950/60 p-2 rounded-lg text-indigo-300 my-1 text-center">
                        J = ((1 + e) · v_rel) / (1/m_A + 1/m_B), где e = 0.5
                      </div>
                    </li>
                    <li>
                      <b>3. Крутящий момент (τ):</b> Сила импульса прикладывается к точке контакта и создает разворачивающий момент относительно центра масс:
                      <div className="font-mono bg-slate-950/60 p-2 rounded-lg text-amber-300 my-1 text-center">
                        τ = r_x · J_y - r_y · J_x  ⇒  Δθ = Clamp(τ / I · k, -25°, +25°)
                      </div>
                    </li>
                    <li>
                      <b>4. Отсутствие асимметрии:</b> Позиционное разделение при наложении пропорционально массам m_A и m_B, исключая самопроизвольный разворот чудика при прямолинейном ударе.
                    </li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <span className="text-2xs text-slate-500 font-mono">
            Файл документации: PHYSICS_DOCUMENTATION.md
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-900/30 transition cursor-pointer"
          >
            Понятно, к эксперименту!
          </button>
        </div>
      </div>
    </div>
  );
};
