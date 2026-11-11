import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Square,
  ChevronDown,
  Search,
  Plus,
  Settings,
} from 'lucide-react';
import { MinecraftInstance } from '../../types/instance';
import { LauncherAccount } from '../../types/auth';
import { MinecraftPlayerHead } from '../skin/MinecraftPlayerHead';
import { InstanceCircleLogo } from '../instances/InstanceCircleLogo';
import { playMinecraftClickSound } from '../../services/soundService';
import type { LauncherProgress } from '../../services/tauriBridge';
import { LauncherSettings } from '../../services/storageService';

interface TopHeaderProps {
  currentTabTitle?: string;
  activeInstance: MinecraftInstance | null;
  activeAccount: LauncherAccount | null;
  instances: MinecraftInstance[];
  isGameRunning: boolean;
  isLaunching: boolean;
  desktopAvailable: boolean;
  launchProgress: LauncherProgress | null;
  launchElapsedMs: number;
  settings?: LauncherSettings;
  onUpdateSettings?: (newSettings: LauncherSettings) => void;
  onLaunchGame: (serverAddress?: string) => void;
  onStopGame: () => void;
  onSelectInstance: (id: string) => void;
  onManageInstance?: (id: string) => void;
  onSwitchAccount: () => void;
  onOpenCreateInstance: () => void;
  onToggleSidebar?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeInstance,
  activeAccount,
  instances,
  isGameRunning,
  isLaunching,
  desktopAvailable,
  launchProgress,
  launchElapsedMs,
  onLaunchGame,
  onStopGame,
  onSelectInstance,
  onManageInstance,
  onSwitchAccount,
  onOpenCreateInstance,
}) => {
  const [isInstanceMenuOpen, setIsInstanceMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [popupPos, setPopupPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const updatePopupPosition = useCallback(() => {
    if (!triggerBtnRef.current) return;
    const rect = triggerBtnRef.current.getBoundingClientRect();
    const gap = 10; // small 8-12px gap
    const top = rect.bottom + gap;
    const popupWidth = Math.min(384, Math.max(300, window.innerWidth - 32));

    // Anchor popup right edge with trigger button right edge
    let left = rect.right - popupWidth;
    // Ensure it never extends outside the window horizontally
    if (left < 16) left = 16;
    if (left + popupWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - popupWidth - 16);
    }

    // Ensure it never extends outside the window vertically
    const maxHeight = Math.max(180, window.innerHeight - top - 16);
    setPopupPos({ top, left, width: popupWidth, maxHeight });
  }, []);

  // Update position on window resize and scroll, and handle outside click
  useEffect(() => {
    if (!isInstanceMenuOpen) return;
    updatePopupPosition();

    const handleResizeOrScroll = () => {
      updatePopupPosition();
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popupRef.current &&
        !popupRef.current.contains(target) &&
        triggerBtnRef.current &&
        !triggerBtnRef.current.contains(target)
      ) {
        setIsInstanceMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsInstanceMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isInstanceMenuOpen, updatePopupPosition]);

  const filteredInstances = instances.filter((inst) =>
    inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inst.gameVersion.includes(searchQuery) ||
    inst.loader.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="min-h-16 h-auto px-4 sm:px-6 border-b border-[var(--mc-border)] bg-[var(--mc-surface)]/90 backdrop-blur-md flex items-center justify-end gap-3 sm:gap-4 shrink-0 select-none z-30 relative transition-colors duration-200">
      {/* Right Controls: Instance Selection + Player Account + Tactile Play Button */}
      <div className="flex items-center gap-2.5 sm:gap-4 relative w-full justify-end">
        {/* Active Instance Switcher */}
        {activeInstance && (
          <div className="relative shrink-0">
            <button
              ref={triggerBtnRef}
              onClick={() => {
                playMinecraftClickSound();
                setIsInstanceMenuOpen((prev) => !prev);
              }}
              className="btn-mc flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left cursor-pointer group shadow-sm hover:border-[var(--mc-accent)] min-w-0"
              title="Click to switch Minecraft instance"
            >
              <InstanceCircleLogo
                loader={activeInstance.loader}
                icon={activeInstance.icon}
                size="sm"
              />
              <div className="text-left min-w-0 pr-1 max-w-[140px] sm:max-w-[200px]">
                <div className="text-xs font-bold text-white truncate font-display group-hover:text-emerald-300">
                  {activeInstance.name}
                </div>
                <div className="text-[10px] text-emerald-400 font-mono hidden sm:block truncate font-bold">
                  MC {activeInstance.gameVersion} · {activeInstance.loader.toUpperCase()}
                </div>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform shrink-0 ${
                  isInstanceMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Portal Instance Selector Dropdown */}
            {isInstanceMenuOpen && popupPos && createPortal(
              <div
                ref={popupRef}
                style={{
                  position: 'fixed',
                  top: `${popupPos.top}px`,
                  left: `${popupPos.left}px`,
                  width: `${popupPos.width}px`,
                  maxHeight: `${popupPos.maxHeight}px`,
                  zIndex: 9999,
                }}
                className="rounded-xl card-obsidian border border-white/20 shadow-[0_24px_60px_rgba(0,0,0,0.92)] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 transition-all select-none"
              >
                <div className="px-3 py-2.5 border-b border-white/10 bg-black/50 shrink-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white font-display">Select Instance</div>
                      <div className="text-[10px] text-slate-400 font-mono">Choose your world profile and modpack</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playMinecraftClickSound();
                        setIsInstanceMenuOpen(false);
                        onOpenCreateInstance();
                      }}
                      className="btn-mc btn-mc-green px-2.5 py-1 text-[11px] text-white flex items-center gap-1 cursor-pointer font-display font-bold shadow-sm shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      New
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search instances..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-black/60 border border-white/10 rounded-lg text-white font-mono focus:outline-none focus:border-[var(--mc-accent)]"
                    />
                  </div>
                </div>

                <div className="overflow-y-auto p-2 space-y-1.5 flex-1 min-h-0">
                  {filteredInstances.map((inst) => {
                    const isSelected = inst.id === activeInstance.id;
                    return (
                      <div
                        key={inst.id}
                        className={`flex items-center gap-2 rounded-lg border p-1.5 transition-all ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500/40 shadow-sm'
                            : 'border-transparent hover:bg-white/[0.06] hover:border-white/10'
                        }`}
                      >
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            playMinecraftClickSound();
                            onSelectInstance(inst.id);
                            setIsInstanceMenuOpen(false);
                          }}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
                        >
                          <InstanceCircleLogo
                            loader={inst.loader}
                            icon={inst.icon}
                            size="md"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-white font-display truncate">
                              {inst.name}
                            </span>
                            <span className="block text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                              MC {inst.gameVersion} · <span className="uppercase text-emerald-400 font-bold">{inst.loader}</span> · {(inst.mods || []).length} mods
                            </span>
                          </span>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isSelected ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              ACTIVE
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                playMinecraftClickSound();
                                onSelectInstance(inst.id);
                                setIsInstanceMenuOpen(false);
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                            >
                              Use
                            </button>
                          )}

                          {onManageInstance && (
                            <button
                              type="button"
                              onClick={() => {
                                playMinecraftClickSound();
                                setIsInstanceMenuOpen(false);
                                onManageInstance(inst.id);
                              }}
                              className="btn-mc p-1.5 text-slate-300 hover:text-white rounded cursor-pointer"
                              title={`Manage ${inst.name}`}
                              aria-label={`Manage ${inst.name}`}
                            >
                              <Settings className="w-3.5 h-3.5 text-slate-300" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredInstances.length === 0 && (
                    <p className="p-3 text-center text-xs text-slate-400 font-mono">No matching instances found.</p>
                  )}
                </div>
              </div>,
              document.body
            )}
          </div>
        )}

        {/* Player Account Profile Chip with 3D Head */}
        {activeAccount && (
          <button
            onClick={() => {
              playMinecraftClickSound();
              onSwitchAccount();
            }}
            className="btn-mc flex items-center gap-2.5 px-3 py-1.5 rounded cursor-pointer group shadow-sm"
            title="Click to switch account or manage skin"
          >
            <div className="relative shrink-0">
              <MinecraftPlayerHead
                skinUrl={activeAccount.skinUrl}
                size={26}
                className="rounded shadow-sm group-hover:scale-105 transition-transform"
              />
            </div>
            <div className="hidden sm:block text-left min-w-0">
              <div className="text-xs font-black text-slate-100 truncate max-w-[110px] font-display">
                {activeAccount.username}
              </div>
              <div className="text-[10px] text-slate-400 font-mono capitalize">
                {activeAccount.type}
              </div>
            </div>
          </button>
        )}

        {/* Big Aesthetic Tactical Launch / Stop Button */}
        <div className="min-w-[5.5rem] flex flex-col items-stretch gap-1">
          {!isGameRunning ? (
            <button
              onClick={() => {
                playMinecraftClickSound();
                onLaunchGame();
              }}
              disabled={!activeInstance || !activeAccount || !desktopAvailable || isLaunching}
              className="btn-mc btn-mc-green flex items-center gap-2 px-5 py-2 text-white font-black text-xs sm:text-sm rounded cursor-pointer font-display disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
              title={!desktopAvailable
                ? 'Game launch requires the installed desktop launcher'
                : 'Launch current active instance; Java is detected automatically if needed'}
            >
              {isLaunching ? <Play className="w-4 h-4 shrink-0 animate-pulse" /> : <Play className="w-4 h-4 fill-current shrink-0" />}
              <span>{isLaunching ? 'STARTING' : 'PLAY'}</span>
            </button>
          ) : (
            <button
              onClick={() => {
                playMinecraftClickSound();
                onStopGame();
              }}
              className="btn-mc btn-mc-red flex items-center gap-2 px-4 py-2 text-white font-black text-xs sm:text-sm rounded cursor-pointer font-display shadow-lg animate-pulse"
              title="Stop running Minecraft process"
            >
              <Square className="w-4 h-4 fill-current shrink-0" />
              <span>STOP</span>
            </button>
          )}
          {isLaunching && launchProgress && (
            <div className="w-full min-w-28 max-w-48 pt-0.5" role="status" aria-live="polite" title={launchProgress.file ?? launchProgress.message}>
              <div className="mb-1 flex items-center justify-between gap-2 text-[9px] leading-none">
                <span className="min-w-0 truncate text-[var(--mc-muted)]">{launchProgress.file ?? launchProgress.message}</span>
                <span className="shrink-0 font-mono font-bold text-[var(--mc-text)]">
                  {launchProgress.percent === null ? '…' : `${launchProgress.percent}%`} · {(launchElapsedMs / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-black/35 ring-1 ring-white/10" role="progressbar" aria-label="Minecraft install progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={launchProgress.percent ?? undefined}>
                <div className={`h-full rounded-full bg-[var(--mc-accent)] transition-[width] duration-150 ${launchProgress.percent === null ? 'w-1/3 animate-pulse' : ''}`} style={launchProgress.percent === null ? undefined : { width: `${launchProgress.percent}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
