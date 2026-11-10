import React from 'react';
import { Download, CheckCircle, Trash2 } from 'lucide-react';
import { DownloadTask } from '../../types/launcher';
import { PickaxeIcon } from '../icons/MinecraftIcons';

interface DownloadsViewProps {
  tasks: DownloadTask[];
  onClearCompleted: () => void;
}

export const DownloadsView: React.FC<DownloadsViewProps> = ({
  tasks,
  onClearCompleted,
}) => {
  const activeTasks = tasks.filter((t) => t.status === 'downloading' || t.status === 'verifying');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
            <Download className="w-5 h-5 text-emerald-400" />
            Centralized Download Manager
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Parallel downloads queue, progress tracking, and SHA-1 cryptographic file verification.
          </p>
        </div>

        {completedTasks.length > 0 && (
          <button
            onClick={onClearCompleted}
            className="btn-tactile-dark flex items-center gap-1.5 px-3.5 py-1.5 text-slate-300 text-xs font-bold rounded-lg cursor-pointer font-display"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Active downloads */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-display">
          Active Downloads ({activeTasks.length})
        </h3>

        {activeTasks.length === 0 ? (
          <div className="card-obsidian p-8 rounded-xl text-center text-xs text-slate-500 font-mono">
            No active downloads. All requested game binaries, client JARs, and libraries are up to date.
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeTasks.map((t) => (
              <div
                key={t.id}
                className="card-obsidian p-4 rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white font-display">{t.title}</span>
                  <span className="font-mono text-emerald-400 font-bold">{t.progress}%</span>
                </div>

                <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${t.progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>{(t.downloadedBytes / (1024 * 1024)).toFixed(1)} MB / {(t.totalBytes / (1024 * 1024)).toFixed(1)} MB</span>
                  <span>{(t.speedBytesPerSec / (1024 * 1024)).toFixed(2)} MB/s</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed history */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-display">
          Completed Downloads ({completedTasks.length})
        </h3>

        <div className="card-obsidian rounded-xl overflow-hidden divide-y divide-white/5">
          {completedTasks.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 font-mono">
              Download history is currently empty.
            </div>
          ) : (
            completedTasks.map((t) => (
              <div key={t.id} className="p-3.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold text-white font-display">{t.title}</div>
                    <div className="text-[10px] font-mono text-slate-500">
                      SHA-1: {t.sha1 ?? 'Not recorded'} · {(t.totalBytes / 1024).toFixed(0)} KB
                    </div>
                  </div>
                </div>

                <span className="text-[9px] font-mono font-bold text-slate-400 bg-black/40 border border-white/5 px-2 py-0.5 rounded uppercase">
                  {t.category}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
