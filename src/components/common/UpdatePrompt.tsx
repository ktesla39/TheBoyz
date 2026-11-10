import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';

type UpdateNotice =
  | { kind: 'available'; update: Update }
  | { kind: 'installing'; update: Update; progress: number | null }
  | { kind: 'error'; message: string; update?: Update };

export function UpdatePrompt() {
  const [notice, setNotice] = useState<UpdateNotice | null>(null);

  const checkForUpdates = useCallback(async () => {
    setNotice(null);
    try {
      const update = await check({ timeout: 15_000 });
      if (update) setNotice({ kind: 'available', update });
    } catch (reason) {
      setNotice({
        kind: 'error',
        message: reason instanceof Error ? reason.message : String(reason),
      });
    }
  }, []);

  useEffect(() => {
    if (
      !isTauri() ||
      import.meta.env.VITE_TAURI_UPDATER_ENABLED !== 'true'
    ) {
      return;
    }

    const timer = window.setTimeout(() => void checkForUpdates(), 1500);
    return () => window.clearTimeout(timer);
  }, [checkForUpdates]);

  const closeNotice = async () => {
    if (notice?.kind === 'available' || notice?.kind === 'installing') {
      try {
        await notice.update.close();
      } catch (reason) {
        setNotice({
          kind: 'error',
          message: `Could not release the update check: ${reason instanceof Error ? reason.message : String(reason)}`,
        });
        return;
      }
    }
    setNotice(null);
  };

  const retryCheck = async () => {
    await closeNotice();
    await checkForUpdates();
  };

  const installUpdate = async (update: Update) => {
    setNotice({ kind: 'installing', update, progress: null });
    let downloadedBytes = 0;
    let contentLength: number | undefined;

    try {
      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength;
          setNotice({
            kind: 'installing',
            update,
            progress: contentLength ? 0 : null,
          });
        } else if (event.event === 'Progress') {
          downloadedBytes += event.data.chunkLength;
          setNotice({
            kind: 'installing',
            update,
            progress: contentLength
              ? Math.min(100, Math.round((downloadedBytes / contentLength) * 100))
              : null,
          });
        } else {
          setNotice({ kind: 'installing', update, progress: 100 });
        }
      });
      await update.close();
      await relaunch();
    } catch (reason) {
      setNotice({
        kind: 'error',
        update,
        message: reason instanceof Error ? reason.message : String(reason),
      });
    }
  };

  if (!notice) return null;

  const isInstalling = notice.kind === 'installing';
  const isError = notice.kind === 'error';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm">
      <section
        aria-labelledby="update-prompt-title"
        aria-modal="true"
        className="card-obsidian w-full max-w-lg rounded-xl border border-emerald-500/40 bg-[#101610] p-6 text-slate-100 shadow-2xl sm:p-8"
        role="dialog"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
              {isInstalling ? (
                <LoaderCircle className="animate-spin" size={23} />
              ) : isError ? (
                <AlertTriangle size={23} />
              ) : (
                <Download size={23} />
              )}
            </span>
            <div>
              <p className="mb-1 text-xs tracking-[0.18em] text-emerald-300">LAUNCHER UPDATE</p>
              <h2 className="m-0 text-2xl font-bold" id="update-prompt-title">
                {isInstalling
                  ? 'Updating The Boys'
                  : isError
                    ? 'Update check failed'
                    : 'New version available, want to update?'}
              </h2>
            </div>
          </div>
          {!isInstalling && (
            <button
              aria-label="Close update message"
              className="rounded border border-white/10 p-2 text-slate-300 hover:bg-white/10"
              onClick={() => void closeNotice()}
              type="button"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {isError ? (
          <div className="mb-6 border border-amber-400/25 bg-amber-400/5 p-4 text-amber-100">
            <p className="mb-2">The launcher could not complete its update check.</p>
            <p className="m-0 break-words text-base text-amber-100/70">{notice.message}</p>
          </div>
        ) : isInstalling ? (
          <div className="mb-6">
            <p className="mb-4 text-slate-300">
              Downloading version {notice.update.version}. Keep the launcher open for a moment.
            </p>
            {notice.progress !== null && (
              <div
                aria-label={`Update download ${notice.progress}% complete`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={notice.progress}
                className="h-4 border border-emerald-400/30 bg-black/40 p-0.5"
                role="progressbar"
              >
                <div
                  className="h-full bg-emerald-400 transition-[width]"
                  style={{ width: `${notice.progress}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6">
            <p className="text-slate-300">
              Version <strong className="text-emerald-200">{notice.update.version}</strong> is ready.
              The update will install and restart the launcher.
            </p>
            {notice.update.body && (
              <div className="max-h-40 overflow-auto border border-white/10 bg-black/20 p-3 text-base text-slate-400">
                {notice.update.body}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          {isError ? (
            <>
              <button className="btn-mc px-4 py-2" onClick={() => void closeNotice()} type="button">
                Dismiss
              </button>
              <button className="btn-mc flex items-center gap-2 px-4 py-2" onClick={() => void retryCheck()} type="button">
                <RefreshCw size={16} /> Try again
              </button>
            </>
          ) : isInstalling ? (
            <span className="flex items-center gap-2 text-emerald-200">
              <CheckCircle2 size={17} /> Installing securely…
            </span>
          ) : (
            <>
              <button className="btn-mc px-4 py-2" onClick={() => void closeNotice()} type="button">
                Not now
              </button>
              <button
                className="btn-mc flex items-center gap-2 px-4 py-2"
                onClick={() => void installUpdate(notice.update)}
                type="button"
              >
                <Download size={17} /> Update now
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
