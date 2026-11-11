import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  LoaderCircle,
  RefreshCw,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Clock,
  Terminal,
} from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import { TheBoysEmblemIcon } from '../icons/MinecraftIcons';
import { playMinecraftClickSound, playMinecraftLevelUpSound } from '../../services/soundService';
import {
  invokeCheckGithubLauncherUpdate,
  invokeApplyGithubLauncherUpdate,
  type TauriLauncherUpdateInfo,
} from '../../services/tauriBridge';

type UpdateNotice =
  | { kind: 'available'; update: Update }
  | { kind: 'github_available'; info: TauriLauncherUpdateInfo }
  | { kind: 'installing'; update?: Update; progress: number | null; downloadedBytes: number; totalBytes: number | null }
  | { kind: 'error'; message: string; update?: Update };

export function UpdatePrompt() {
  const [notice, setNotice] = useState<UpdateNotice | null>(null);

  const checkForUpdates = useCallback(async () => {
    setNotice(null);
    let foundUpdate = false;
    let signedUpdaterError: unknown;

    // 1. Try Tauri updater plugin first
    try {
      const update = await check({ timeout: 15_000 });
      if (update) {
        setNotice({ kind: 'available', update });
        foundUpdate = true;
      }
    } catch (reason) {
      signedUpdaterError = reason;
    }

    // 2. If no signed plugin update, check GitHub Releases directly
    if (!foundUpdate) {
      try {
        const ghInfo = await invokeCheckGithubLauncherUpdate();
        if (ghInfo && ghInfo.has_update && ghInfo.download_url && ghInfo.sha256) {
          setNotice({ kind: 'github_available', info: ghInfo });
        }
      } catch (reason) {
        console.warn('Update check status:', reason);
        const signedError = signedUpdaterError instanceof Error
          ? signedUpdaterError.message
          : signedUpdaterError === undefined
            ? undefined
            : String(signedUpdaterError);
        const githubError = reason instanceof Error ? reason.message : String(reason);
        setNotice({
          kind: 'error',
          message: signedError
            ? `Signed updater check failed: ${signedError}. GitHub release check failed: ${githubError}`
            : `GitHub release check failed: ${githubError}`,
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    const timer = window.setTimeout(() => void checkForUpdates(), 2000);
    return () => window.clearTimeout(timer);
  }, [checkForUpdates]);

  const closeNotice = async () => {
    playMinecraftClickSound();
    if (notice?.kind === 'available' || (notice?.kind === 'installing' && notice.update)) {
      try {
        await notice.update?.close();
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
    playMinecraftClickSound();
    await closeNotice();
    await checkForUpdates();
  };

  const installUpdate = async (update: Update) => {
    playMinecraftClickSound();
    setNotice({
      kind: 'installing',
      update,
      progress: null,
      downloadedBytes: 0,
      totalBytes: null,
    });
    let downloaded = 0;
    let contentLength: number | undefined;

    try {
      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength;
          setNotice({
            kind: 'installing',
            update,
            progress: contentLength ? 0 : null,
            downloadedBytes: 0,
            totalBytes: contentLength ?? null,
          });
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          const pct = contentLength ? Math.min(100, Math.round((downloaded / contentLength) * 100)) : null;
          setNotice({
            kind: 'installing',
            update,
            progress: pct,
            downloadedBytes: downloaded,
            totalBytes: contentLength ?? null,
          });
        } else {
          setNotice({
            kind: 'installing',
            update,
            progress: 100,
            downloadedBytes: downloaded,
            totalBytes: contentLength ?? downloaded,
          });
        }
      });
      playMinecraftLevelUpSound();
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

  const installGithubUpdate = async (downloadUrl: string, sha256: string) => {
    playMinecraftClickSound();
    setNotice({
      kind: 'installing',
      progress: null,
      downloadedBytes: 0,
      totalBytes: null,
    });
    try {
      await invokeApplyGithubLauncherUpdate(downloadUrl, sha256);
      playMinecraftLevelUpSound();
    } catch (reason) {
      setNotice({
        kind: 'error',
        message: reason instanceof Error ? reason.message : String(reason),
      });
    }
  };

  if (!notice) return null;

  const isInstalling = notice.kind === 'installing';
  const isError = notice.kind === 'error';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <section
        aria-labelledby="update-prompt-title"
        aria-modal="true"
        className="card-obsidian card-tactile w-full max-w-lg rounded-2xl border-2 border-emerald-500/50 bg-[#111622] p-0 text-slate-100 shadow-[0_25px_80px_rgba(0,0,0,0.95)] overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
      >
        {/* Top Window Titlebar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/50">
          <div className="flex items-center gap-2">
            <TheBoysEmblemIcon size={18} />
            <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-emerald-400 font-bold">
              The Boys Client Updater
            </span>
          </div>

          {!isInstalling && (
            <button
              aria-label="Close update window"
              className="btn-mc p-1.5 rounded text-slate-400 hover:text-white cursor-pointer"
              onClick={() => void closeNotice()}
              type="button"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Header Status & Icon */}
          <div className="flex items-start gap-4">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 shadow-inner ${
              isError
                ? 'border-red-500/50 bg-red-500/15 text-red-400'
                : isInstalling
                  ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                  : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
            }`}>
              {isInstalling ? (
                <LoaderCircle className="animate-spin" size={24} />
              ) : isError ? (
                <AlertTriangle size={24} />
              ) : (
                <Sparkles size={24} />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-extrabold uppercase tracking-wide border ${
                  isError
                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                    : isInstalling
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {isInstalling ? 'DOWNLOADING UPDATE' : isError ? 'CHECK FAILED' : 'NEW BUILD READY'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">Desktop Release</span>
              </div>

              <h2 className="mt-1 text-xl sm:text-2xl font-black font-display text-white tracking-tight leading-tight" id="update-prompt-title">
                {isInstalling
                  ? 'Updating Launcher...'
                  : isError
                    ? 'Update Check Failed'
                    : 'A New Client Update is Available!'}
              </h2>
            </div>
          </div>

          {/* Version Comparison Card */}
          {notice.kind !== 'error' && (
            <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-black/40 border border-white/10 font-mono text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Current Build</span>
                <span className="text-slate-300 font-bold">
                  Installed v{notice.kind === 'available' ? notice.update.currentVersion : notice.kind === 'github_available' ? notice.info.current_version : 'Latest'}
                </span>
              </div>
              <div className="space-y-0.5 border-l border-white/10 pl-3">
                <span className="text-[10px] uppercase text-emerald-400 font-bold block">Available Version</span>
                <span className="text-white font-extrabold flex items-center gap-1.5">
                  <span>
                    v{notice.kind === 'available' ? notice.update.version : notice.kind === 'github_available' ? notice.info.latest_version : 'Latest'}
                  </span>
                  <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1 rounded">Latest</span>
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {isError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs font-mono text-red-200 space-y-2">
              <p className="font-bold">The launcher could not complete its update verification check.</p>
              <p className="text-red-300/80 break-words">{notice.message}</p>
            </div>
          )}

          {/* Installing Progress State */}
          {isInstalling && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">
                  Downloading and installing update package in-place...
                </span>
                <span className="text-emerald-400 font-bold">
                  {notice.progress !== null ? `${notice.progress}%` : 'Working…'}
                </span>
              </div>

              {/* Minecraft Pixel Exp Bar */}
              <div
                aria-label={`Update download ${notice.progress ?? 0}% complete`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={notice.progress ?? undefined}
                className="h-3.5 rounded-full border border-emerald-500/40 bg-black/60 p-0.5 overflow-hidden shadow-inner"
                role="progressbar"
              >
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-300 transition-[width] duration-150 ${
                    notice.progress === null ? 'w-1/3 animate-pulse' : ''
                  }`}
                  style={notice.progress !== null ? { width: `${notice.progress}%` } : undefined}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>All instances, accounts, and worlds are fully preserved</span>
                {notice.totalBytes && (
                  <span>
                    {(notice.downloadedBytes / (1024 * 1024)).toFixed(1)} MB / {(notice.totalBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Release Notes Changelog (if available) */}
          {(notice.kind === 'available' || notice.kind === 'github_available') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="font-bold uppercase tracking-wider text-slate-300">
                  What&apos;s New in v{notice.kind === 'available' ? notice.update.version : notice.info.latest_version}
                </span>
                <span>{notice.kind === 'available' ? 'Signed Release' : 'GitHub Release'}</span>
              </div>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-black/50 p-3 text-xs font-mono text-slate-300 space-y-1.5 leading-relaxed">
                {(notice.kind === 'available' ? notice.update.body : notice.info.release_notes) ? (
                  <div className="whitespace-pre-line">{notice.kind === 'available' ? notice.update.body : notice.info.release_notes}</div>
                ) : (
                  <ul className="space-y-1 list-disc list-inside text-slate-300">
                    <li>Performance optimizations: smooth 60fps animations and lightweight UI.</li>
                    <li>Official Mojang version manifest integration with strict version selection.</li>
                    <li>Dual Modrinth &amp; CurseForge integration with fast 20-item pagination.</li>
                    <li>Instance artwork manager with preset Minecraft icons &amp; custom image uploads.</li>
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Button Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-white/10 bg-black/40">
          {isError ? (
            <>
              <button
                className="btn-mc px-4 py-2 text-xs font-bold font-display text-slate-300 rounded cursor-pointer"
                onClick={() => void closeNotice()}
                type="button"
              >
                Dismiss
              </button>
              <button
                className="btn-mc btn-mc-green flex items-center gap-2 px-5 py-2 text-xs font-bold font-display text-white rounded cursor-pointer shadow-md"
                onClick={() => void retryCheck()}
                type="button"
              >
                <RefreshCw size={15} />
                <span>Retry Update Check</span>
              </button>
            </>
          ) : isInstalling ? (
            <div className="w-full flex items-center justify-center gap-2 text-xs font-mono text-emerald-300 py-1">
              <ShieldCheck size={16} />
              <span>Updating launcher in-place without removing user data…</span>
            </div>
          ) : (
            <>
              <button
                className="btn-mc px-4 py-2 text-xs font-bold font-display text-slate-300 rounded cursor-pointer"
                onClick={() => void closeNotice()}
                type="button"
              >
                Remind Me Later
              </button>
              <button
                className="btn-mc btn-mc-green flex items-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-black font-display text-white rounded cursor-pointer shadow-lg"
                onClick={() => {
                  if (notice.kind === 'available') {
                    void installUpdate(notice.update);
                  } else if (notice.kind === 'github_available' && notice.info.download_url && notice.info.sha256) {
                    void installGithubUpdate(notice.info.download_url, notice.info.sha256);
                  }
                }}
                type="button"
              >
                <Download size={16} />
                <span>Update &amp; Restart Now</span>
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
