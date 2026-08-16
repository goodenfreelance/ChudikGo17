import React, { useState } from 'react';
import { CreatureLogEntry } from '../types';
import { FileText, Download, Trash2, X, Search, ChevronDown, ChevronUp, Copy, Check, Info } from 'lucide-react';

interface CreaturesLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logEntries: CreatureLogEntry[];
  onClearLogs: () => void;
  onDownloadCreatureJson: (entry: CreatureLogEntry) => void;
}

export const CreaturesLogModal: React.FC<CreaturesLogModalProps> = ({
  isOpen,
  onClose,
  logEntries,
  onClearLogs,
  onDownloadCreatureJson,
}) => {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredEntries = logEntries.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.action.toLowerCase().includes(search.toLowerCase()) ||
      e.creatureId.toLowerCase().includes(search.toLowerCase())
  );

  // Download entire log history as JSON file
  const handleDownloadJsonLog = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logEntries, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `creatures_log_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Download log as TXT file
  const handleDownloadTxtLog = () => {
    let txt = `=======================================================\n`;
    txt += ` ЖУРНАЛ ЛОГОВ СОЗДАННЫХ ЧУДИКОВ (ВСЕГО ЗАПИСЕЙ: ${logEntries.length})\n`;
    txt += ` Время создания файла: ${new Date().toLocaleString('ru-RU')}\n`;
    txt += `=======================================================\n\n`;

    logEntries.forEach((entry, idx) => {
      txt += `[${idx + 1}] ${entry.timestamp} | ДЕЙСТВИЕ: ${entry.action.toUpperCase()}\n`;
      txt += `    Имя: "${entry.name}" (ID: ${entry.creatureId})\n`;
      txt += `    Начальная позиция: Узел (${entry.initialX}, ${entry.initialY}), Ориентация: ${entry.initialAngleDeg}°\n`;
      txt += `    Элементы: всего ${entry.elementCount} | Масса: L:${entry.leftMass} / R:${entry.rightMass} (Всего: ${entry.totalMass})\n`;
      txt += `    Инфо мышц: ${entry.randomMusclesInfo || 'Стандартные мышцы'}\n`;
      txt += `    Состав схемы:\n`;
      entry.elements.forEach((el) => {
        txt += `      - [${el.type}] rel(x:${el.relX}, y:${el.relY}) вес:${el.weight}${el.randomChance ? ` шанс:${el.randomChance}%` : ''}\n`;
      });
      txt += `-------------------------------------------------------\n\n`;
    });

    const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `creatures_log_${Date.now()}.txt`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyJson = (entry: CreatureLogEntry) => {
    navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[88vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Файл Логов Создания Чудиков
              </h2>
              <p className="text-2xs text-slate-400">
                Зарегистрировано записей в истории: {logEntries.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadJsonLog}
              disabled={logEntries.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition shadow-sm"
              title="Скачать полный лог в формате creatures_log.json"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Скачать .JSON</span>
            </button>

            <button
              onClick={handleDownloadTxtLog}
              disabled={logEntries.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-xl transition shadow-sm"
              title="Скачать текстовый отчет creatures_log.txt"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Скачать .TXT</span>
            </button>

            {onClearLogs && (
              <button
                onClick={onClearLogs}
                disabled={logEntries.length === 0}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition disabled:opacity-40"
                title="Очистить журнал логов"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-900/60 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени, типу или ID чудика..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <span className="text-2xs font-mono text-slate-400 shrink-0">
            Найдено: {filteredEntries.length}
          </span>
        </div>

        {/* Content List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Записи логов пока отсутствуют или не найдены по запросу.</p>
              <p className="text-2xs text-slate-600 mt-1">
                При создании, размещении или сохранении чудиков они автоматически записываются в этот журнал.
              </p>
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const isCopied = copiedId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="bg-slate-950/70 border border-slate-800 hover:border-slate-700/80 rounded-xl p-3 text-xs transition space-y-2"
                >
                  {/* Top line: Header info */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="font-bold text-slate-100 text-sm">{entry.name}</span>
                      <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700">
                        {entry.action}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-2xs text-slate-400 font-mono">
                      <span>{entry.timestamp}</span>
                      <span className="text-slate-600">|</span>
                      <span>ID: {entry.creatureId}</span>
                    </div>
                  </div>

                  {/* Specs summary row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800/60 text-2xs font-mono">
                    <div>
                      <span className="text-slate-500 block">Позиция</span>
                      <span className="text-slate-200 font-bold">({entry.initialX}, {entry.initialY})</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Ориентация</span>
                      <span className="text-indigo-400 font-bold">{entry.initialAngleDeg}°</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Элементов</span>
                      <span className="text-emerald-400 font-bold">{entry.elementCount} шт.</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Плечи L/R</span>
                      <span className="text-amber-400 font-bold">L:{entry.leftMass} / R:{entry.rightMass}</span>
                    </div>
                  </div>

                  {entry.randomMusclesInfo && (
                    <div className="text-2xs text-sky-400 bg-sky-950/30 border border-sky-800/40 p-1.5 rounded-lg">
                      ⚙️ {entry.randomMusclesInfo}
                    </div>
                  )}

                  {/* Action buttons on item */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="flex items-center gap-1 text-2xs font-semibold text-indigo-400 hover:text-indigo-300"
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      <span>{isExpanded ? 'Свернуть схему' : 'Показать элементы схемы'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyJson(entry)}
                        className="flex items-center gap-1 text-2xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800"
                        title="Скопировать JSON чудика"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{isCopied ? 'Скопировано' : 'JSON'}</span>
                      </button>

                      <button
                        onClick={() => onDownloadCreatureJson(entry)}
                        className="flex items-center gap-1 text-2xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 font-semibold"
                        title="Скачать JSON этого чудика отдельно"
                      >
                        <Download className="w-3 h-3" />
                        <span>Сохранить .json</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Element Details */}
                  {isExpanded && (
                    <div className="mt-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800 space-y-1.5 font-mono text-2xs">
                      <div className="text-slate-400 font-bold border-b border-slate-800 pb-1">
                        Состав элементов («{entry.name}»):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-slate-300 max-h-36 overflow-y-auto">
                        {entry.elements.map((el, i) => (
                          <div key={i} className="flex items-center justify-between bg-slate-950 px-2 py-1 rounded border border-slate-800/50">
                            <span className="text-slate-200 font-bold">{el.type}</span>
                            <span className="text-slate-400">rel: ({el.relX}, {el.relY})</span>
                            {el.randomChance ? (
                              <span className="text-sky-400">{el.randomChance}%</span>
                            ) : (
                              <span className="text-slate-500">w:{el.weight}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/80 text-2xs text-slate-500 flex items-center justify-between">
          <span>
            Журнал хранится локально в сессии и может быть экспортирован в файлы <code className="text-indigo-400">creatures_log.json</code> или <code className="text-amber-400">creatures_log.txt</code>.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
