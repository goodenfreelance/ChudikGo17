import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Terminal,
  RefreshCw,
  Trash2,
  Download,
  Copy,
  Check,
  AlertTriangle,
  AlertCircle,
  Info,
  Server,
  Activity,
  Cpu,
  X,
  Search,
  Filter,
} from 'lucide-react';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  source: 'Node' | 'Go' | 'WS' | 'HTTP' | 'System';
  message: string;
  stack?: string;
  details?: any;
}

export interface SystemStatusResponse {
  status: string;
  timestamp: string;
  node: {
    uptimeSeconds: number;
    memoryMB: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
    nodeVersion: string;
  };
  goBackend: {
    status: 'running' | 'starting' | 'stopped' | 'crashed';
    pid: number | null;
    port: string;
    restartCount: number;
    lastExit: { code: number | null; signal: string | null; time: string } | null;
  };
  logsSummary: {
    total: number;
    errors: number;
    warnings: number;
  };
}

interface ServerLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onErrorCountUpdate?: (errors: number) => void;
}

export const ServerLogsModal: React.FC<ServerLogsModalProps> = ({
  isOpen,
  onClose,
  onErrorCountUpdate,
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Filters
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const onErrorCountUpdateRef = useRef(onErrorCountUpdate);
  useEffect(() => {
    onErrorCountUpdateRef.current = onErrorCountUpdate;
  }, [onErrorCountUpdate]);

  const fetchLogsAndStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (selectedLevel !== 'ALL') queryParams.append('level', selectedLevel);
      if (selectedSource !== 'ALL') queryParams.append('source', selectedSource);
      if (searchQuery.trim()) queryParams.append('search', searchQuery.trim());
      queryParams.append('limit', '300');

      const [logsRes, statusRes] = await Promise.all([
        fetch(`/api/logs?${queryParams.toString()}`),
        fetch('/api/system/status'),
      ]);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
        if (onErrorCountUpdateRef.current && typeof logsData.errors === 'number') {
          onErrorCountUpdateRef.current(logsData.errors);
        }
      }

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }
    } catch (err) {
      console.error('Failed to fetch server logs/status:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedLevel, selectedSource, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      fetchLogsAndStatus();
    }
  }, [isOpen, fetchLogsAndStatus]);

  useEffect(() => {
    if (!isOpen || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogsAndStatus();
    }, 2500);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, fetchLogsAndStatus]);

  const handleClearLogs = async () => {
    if (!window.confirm('Вы уверены, что хотите очистить все логи сервера?')) return;
    try {
      await fetch('/api/logs/clear', { method: 'POST' });
      await fetchLogsAndStatus();
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  const handleCopyLogs = () => {
    const text = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level}] [${l.source}] ${l.message}${
            l.stack ? `\nStack:\n${l.stack}` : ''
          }`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    window.open('/api/logs/download', '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Система Логирования и Диагностики
                </h2>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    status?.goBackend.status === 'running'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                      status?.goBackend.status === 'running'
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-rose-400'
                    }`}
                  />
                  {status?.goBackend.status === 'running'
                    ? 'Сервер и Go Движок Активны'
                    : 'Ошибка Go Движка'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Мониторинг ошибок, логов процесса Go (30 FPS) и Node.js в реальном времени
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50 hover:bg-slate-800 transition">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded text-indigo-500 focus:ring-indigo-500 bg-slate-900 border-slate-700"
              />
              <span>Авто-обновление (2.5с)</span>
            </label>

            <button
              onClick={fetchLogsAndStatus}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition disabled:opacity-50"
              title="Обновить вручную"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* System Status Cards Bar */}
        {status && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-950/40 border-b border-slate-800 text-xs">
            {/* Node.js Server Card */}
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 flex items-start space-x-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Server className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-slate-400 font-medium">Node.js Сервер</div>
                <div className="text-white font-semibold text-sm mt-0.5">
                  Аптайм: {Math.floor(status.node.uptimeSeconds / 60)}м {status.node.uptimeSeconds % 60}с
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Память: {status.node.memoryMB.heapUsed}MB / {status.node.memoryMB.heapTotal}MB (RSS: {status.node.memoryMB.rss}MB)
                </div>
              </div>
            </div>

            {/* Go Backend Card */}
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 flex items-start space-x-3">
              <div
                className={`p-2 rounded-lg ${
                  status.goBackend.status === 'running'
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                <Cpu className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-slate-400 font-medium">Go 1.22 Multiplayer Engine</div>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span
                    className={`font-semibold text-sm ${
                      status.goBackend.status === 'running' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {status.goBackend.status === 'running' ? 'Работает' : 'Остановлен / Ошибка'}
                  </span>
                  {status.goBackend.pid && (
                    <span className="text-slate-400 text-[11px]">(PID: {status.goBackend.pid})</span>
                  )}
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Порт: {status.goBackend.port} | Авто-перезапусков: {status.goBackend.restartCount}
                </div>
              </div>
            </div>

            {/* Summary Card */}
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 flex items-start space-x-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                <Activity className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-slate-400 font-medium">Сводка Логов и Ошибок</div>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="inline-flex items-center text-rose-400 font-bold text-xs bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {status.logsSummary.errors} Ошибок
                  </span>
                  <span className="inline-flex items-center text-amber-400 font-medium text-xs bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {status.logsSummary.warnings} Предупреждений
                  </span>
                </div>
                <div className="text-slate-400 text-[11px] mt-1">
                  Всего записей в буфере: {status.logsSummary.total}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar Controls */}
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Level selector */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              <span className="text-slate-500 px-2 flex items-center font-medium">
                <Filter className="w-3 h-3 mr-1" /> Уровень:
              </span>
              {['ALL', 'ERROR', 'WARN', 'INFO'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevel(lvl)}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    selectedLevel === lvl
                      ? lvl === 'ERROR'
                        ? 'bg-rose-500 text-white'
                        : lvl === 'WARN'
                        ? 'bg-amber-500 text-slate-950'
                        : lvl === 'INFO'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {lvl === 'ALL' ? 'Все' : lvl}
                </button>
              ))}
            </div>

            {/* Source selector */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              <span className="text-slate-500 px-2 font-medium">Источник:</span>
              {['ALL', 'Go', 'Node', 'WS', 'HTTP'].map((src) => (
                <button
                  key={src}
                  onClick={() => setSelectedSource(src)}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    selectedSource === src
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {src === 'ALL' ? 'Все' : src}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Поиск по логам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 w-44"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyLogs}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
              title="Скопировать логи в буфер обмена"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
            </button>

            <button
              onClick={handleDownloadLogs}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
              title="Скачать файл server.log"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Скачать .log</span>
            </button>

            <button
              onClick={handleClearLogs}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/20 transition"
              title="Очистить логи сервера"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Очистить</span>
            </button>
          </div>
        </div>

        {/* Logs Viewer Area */}
        <div className="flex-1 bg-slate-950 p-4 overflow-y-auto font-mono text-[12px] leading-relaxed space-y-1.5 min-h-[350px]">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center font-sans">
              <Terminal className="w-10 h-10 mb-3 opacity-30 text-indigo-400" />
              <p className="text-sm font-medium">Записей логов не найдено</p>
              <p className="text-xs text-slate-600 mt-1">
                Попробуйте сбросить фильтры или сгенерировать сетевые события в игре
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const isError = log.level === 'ERROR' || log.level === 'FATAL';
              const isWarn = log.level === 'WARN';
              const isExpanded = expandedLogId === log.id;

              return (
                <div
                  key={log.id}
                  className={`rounded-lg p-2.5 transition border ${
                    isError
                      ? 'bg-rose-950/20 border-rose-900/40 text-rose-200'
                      : isWarn
                      ? 'bg-amber-950/20 border-amber-900/40 text-amber-200'
                      : 'bg-slate-900/40 border-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-2.5 flex-1 break-all">
                      {/* Level Badge */}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                          log.level === 'FATAL'
                            ? 'bg-rose-600 text-white'
                            : log.level === 'ERROR'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : log.level === 'WARN'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        {log.level}
                      </span>

                      {/* Source Badge */}
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700/60 shrink-0">
                        {log.source}
                      </span>

                      {/* Timestamp */}
                      <span className="text-slate-500 text-[11px] shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          fractionalSecondDigits: 3,
                        })}
                      </span>

                      {/* Message */}
                      <span className="font-mono text-slate-200 flex-1">{log.message}</span>
                    </div>

                    {/* Expand Stack button */}
                    {(log.stack || log.details) && (
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 underline shrink-0 font-sans ml-2"
                      >
                        {isExpanded ? 'Скрыть стек' : 'Детали / Stack'}
                      </button>
                    )}
                  </div>

                  {/* Expanded Stack Trace */}
                  {isExpanded && (log.stack || log.details) && (
                    <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-md overflow-x-auto">
                      {log.stack && (
                        <pre className="whitespace-pre-wrap text-rose-300 font-mono">
                          {log.stack}
                        </pre>
                      )}
                      {log.details && (
                        <pre className="whitespace-pre-wrap text-indigo-300 font-mono mt-1">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-indigo-400" />
            <span>Логи сохраняются в файл <code className="text-indigo-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">logs/server.log</code></span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
