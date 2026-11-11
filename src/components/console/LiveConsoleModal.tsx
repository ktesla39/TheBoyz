import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  X,
  Copy,
  Check,
  Download,
  Square,
  Search,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { LogEntry } from '../../types/launcher';
import { TheBoysEmblemIcon } from '../icons/MinecraftIcons';
import type { LauncherProgress } from '../../services/tauriBridge';

interface LiveConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
  isGameRunning: boolean;
  isLaunching: boolean;
  launchProgress: LauncherProgress | null;
  launchElapsedMs: number;
  onStopGame: () => void;
  onClearLogs: () => void;
}

export const LiveConsoleModal: React.FC<LiveConsoleModalProps> = ({
  isOpen,
  onClose,
  logs,
  isGameRunning,
  isLaunching,
  launchProgress,
  launchElapsedMs,
  onStopGame,
  onClearLogs,
}) => {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'>('ALL');
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((l) => {
    const matchesSearch = l.message.toLowerCase().includes(search.toLowerCase());
    const matchesLevel = levelFilter === 'ALL' || l.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  const handleCopyLogs = () => {
    const fullText = logs.map((l) => `[${l.timestamp}] [${l.source}/${l.level}]: ${l.message}`).join('\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportLogFile = () => {
    const fullText = logs.map((l) => `[${l.timestamp}] [${l.source}/${l.level}]: ${l.message}`).join('\n');
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `latest-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasCrash = logs.some((l) => l.level === 'ERROR');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-[#070a10] border border-white/10 rounded-2xl w-full max-w-5xl h-[85vh] shadow-[0_12px_48px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-6 py-3.5 border-b border-white/5 flex items-center justify-between bg-[#0a0d14] shrink-0">
          <div className="flex items-center gap-3">
            <TheBoysEmblemIcon className="w-5 h-5" />
            <div>
              <h3 className="text-sm font-black text-white font-display flex items-center gap-2">
                <span>Minecraft Game Console & Process Monitor</span>
                {isGameRunning ? (
                  <span className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    RUNNING
                  </span>
                ) : (
                  <span className="text-[9px] font-mono text-slate-500 bg-black/40 border border-white/5 px-2 py-0.5 rounded">
                    STOPPED
                  </span>
                )}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isGameRunning && (
              <button
                onClick={onStopGame}
                className="btn-stop-tactile flex items-center gap-1.5 px-3 py-1.5 text-white font-extrabold text-xs rounded-lg cursor-pointer font-display"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Kill Process</span>
              </button>
            )}

            <button
              onClick={handleCopyLogs}
              className="btn-tactile-dark flex items-center gap-1.5 px-3 py-1.5 text-slate-300 text-xs font-bold rounded-lg cursor-pointer font-display"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleExportLogFile}
              className="btn-tactile-dark flex items-center gap-1.5 px-3 py-1.5 text-slate-300 text-xs font-bold rounded-lg cursor-pointer font-display"
              title="Save latest.log"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save .log</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isLaunching && launchProgress && (
          <div className="shrink-0 border-b border-emerald-500/15 bg-emerald-500/[0.04] px-5 py-3" role="status" aria-live="polite">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate font-bold text-emerald-100">
                {launchProgress.file ? `${launchProgress.message}: ${launchProgress.file}` : launchProgress.message}
              </span>
              <span className="shrink-0 font-mono text-emerald-300">{(launchElapsedMs / 1000).toFixed(1)}s</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10"
              role="progressbar"
              aria-label={launchProgress.percent === null ? 'Minecraft launch progress' : 'Current file download progress'}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={launchProgress.percent ?? undefined}
            >
              <div
                className={`h-full rounded-full bg-emerald-400 transition-[width] duration-150 ${launchProgress.percent === null ? 'w-1/3 animate-pulse' : ''}`}
                style={launchProgress.percent === null ? undefined : { width: `${Math.min(100, Math.max(0, launchProgress.percent))}%` }}
              />
            </div>
            {launchProgress.downloadedBytes > 0 && (
              <p className="mb-0 mt-1.5 text-right font-mono text-[10px] text-slate-400">
                {(launchProgress.downloadedBytes / (1024 * 1024)).toFixed(1)} MB
                {launchProgress.totalBytes ? ` / ${(launchProgress.totalBytes / (1024 * 1024)).toFixed(1)} MB` : ' downloaded'}
              </p>
            )}
          </div>
        )}

        {/* Toolbar: Search & Level Filters */}
        <div className="px-6 py-2.5 bg-[#090c12] border-b border-white/5 flex flex-wrap items-center justify-between gap-3 shrink-0 font-mono">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter logs..."
              className="w-full pl-8 pr-3 py-1 text-xs bg-black/40 border border-white/10 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="flex items-center gap-1">
            {(['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                  levelFilter === lvl
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}

            <button
              onClick={onClearLogs}
              className="ml-2 text-slate-500 hover:text-slate-300 p-1 text-[11px] flex items-center gap-1 cursor-pointer"
              title="Clear terminal"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Console output display */}
        <div
          ref={logContainerRef}
          className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1 bg-[#05070a] select-text"
        >
          {filteredLogs.length === 0 ? (
            <div className="py-24 text-center text-slate-600 font-mono">
              No log messages received yet. Click PLAY to start Minecraft and stream live JVM output.
            </div>
          ) : (
            filteredLogs.map((l) => {
              const isError = l.level === 'ERROR';
              const isWarn = l.level === 'WARN';
              const isDebug = l.level === 'DEBUG';

              return (
                <div key={l.id} className="leading-relaxed hover:bg-white/[0.02] px-1 rounded flex gap-2">
                  <span className="text-slate-600 select-none">[{l.timestamp}]</span>
                  <span
                    className={`font-bold select-none ${
                      isError
                        ? 'text-red-400'
                        : isWarn
                        ? 'text-amber-400'
                        : isDebug
                        ? 'text-cyan-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    [{l.source}/{l.level}]
                  </span>
                  <span
                    className={`break-all ${
                      isError
                        ? 'text-red-300 font-bold'
                        : isWarn
                        ? 'text-amber-300'
                        : isDebug
                        ? 'text-slate-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {l.message}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Crash report analyzer banner if errors detected */}
        {hasCrash && (
          <div className="px-6 py-2.5 bg-red-950/40 border-t border-red-900/60 flex items-center justify-between text-xs text-red-300 shrink-0 font-display">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>
                <strong>Crash Analyzer:</strong> Issues detected in game logs. Check Java version compatibility or conflicting mod dependencies.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
