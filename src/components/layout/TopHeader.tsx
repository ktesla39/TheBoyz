import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  ChevronDown,
  Search,
  Plus,
  Check,
  Settings,
} from 'lucide-react';
import { MinecraftInstance } from '../../types/instance';
import { LauncherAccount } from '../../types/auth';
import { MinecraftPlayerHead } from '../skin/MinecraftPlayerHead';
import { LoaderGlyph } from '../icons/LoaderGlyph';
import type { ModLoaderType } from '../../types/instance';
import { playMinecraftClickSound } from '../../services/soundService';
import type { LauncherProgress } from '../../services/tauriBridge';

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
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsInstanceMenuOpen(false);
      }
    }
    if (isInstanceMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isInstanceMenuOpen]);

  const filteredInstances = instances.filter((inst) =>
    inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inst.gameVersion.includes(searchQuery) ||
    inst.loader.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInstanceIcon = (iconName: string | undefined, loader: ModLoaderType) => {
    if (iconName?.startsWith('data:') || iconName?.startsWith('http')) {
      return <img src={iconName} alt="icon" className="w-4 h-4 rounded object-cover" />;
    }
    return <LoaderGlyph loader={loader} className="w-4 h-4" />;
  };

  return (
    <header className="min-h-16 h-auto px-4 sm:px-6 border-b border-[#1c2230] bg-[#0c1017]/90 backdrop-blur-md flex items-center justify-end gap-3 sm:gap-4 shrink-0 select-none z-30 relative">
      {/* Right Controls: Instance Selection with Explanation + Player Account + Tactile Play Button */}
      <div className="flex items-center gap-2.5 sm:gap-4 relative w-full justify-end">
        {/* Active Instance Button with Descriptive Label explaining how the launcher chooses the instance */}
        {activeInstance && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => {
                playMinecraftClickSound();
                setIsInstanceMenuOpen((prev) => !prev);
              }}
              className="btn-mc flex items-center gap-2.5 px-3 py-1.5 rounded text-left cursor-pointer group shadow-sm hover:border-[var(--mc-accent)] min-w-0"
              title="Choose the instance used for Play and server direct connect"
            >
              <div className="w-7 h-7 rounded bg-black/60 border border-white/10 flex items-center justify-center text-xs shrink-0 text-[var(--mc-accent)]">
                {getInstanceIcon(activeInstance.icon, activeInstance.loader)}
              </div>
              <div className="text-left min-w-0 pr-1 max-w-[140px] sm:max-w-[200px]">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-[9px] font-mono uppercase text-[var(--mc-accent)] font-extrabold tracking-wider truncate">
                    Active instance
                  </span>
                </div>
                <div className="text-xs font-black text-slate-100 truncate font-display mt-0.5 group-hover:text-[var(--mc-accent)]">
                  {activeInstance.name}
                </div>
                <div className="text-[10px] text-slate-400 font-mono hidden sm:block truncate">
                  MC {activeInstance.gameVersion} · {activeInstance.loader.toUpperCase()}
                </div>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform shrink-0 ${isInstanceMenuOpen ? 'rotate-180' : ''
                  }`}
              />
            </button>

            {/* Instance selector */}
            {isInstanceMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-1rem))] sm:w-96 rounded-xl card-obsidian border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.9)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2.5 border-b border-white/10 bg-[#090c12]">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white font-display">Choose an instance</div>
                      <div className="text-[10px] text-slate-400 font-mono">Used for Play and server direct connect</div>
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

                <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                  {filteredInstances.map((inst) => {
                    const isSelected = inst.id === activeInstance.id;
                    return (
                      <div
                        key={inst.id}
                        className={`flex items-center gap-1 rounded-lg border transition-colors ${isSelected
                          ? 'bg-[#18212e] border-[var(--mc-accent)]/50'
                          : 'border-transparent hover:bg-white/[0.05]'
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
                          className="flex min-w-0 flex-1 items-center gap-2.5 p-2 text-left"
                        >
                          <span className="w-8 h-8 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center shrink-0 text-[var(--mc-accent)]">
                            {getInstanceIcon(inst.icon, inst.loader)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-white font-display truncate">
                              {inst.name}
                            </span>
                            <span className="block text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                              MC {inst.gameVersion} · {inst.loader.toUpperCase()} · {(inst.mods || []).length} mods
                            </span>
                          </span>
                          <span className={`shrink-0 text-[10px] font-mono font-bold ${isSelected ? 'text-[var(--mc-accent)]' : 'text-slate-500'}`}>
                            {isSelected ? <Check className="w-4 h-4" /> : 'Select'}
                          </span>
                        </button>

                        {onManageInstance && (
                          <button
                            type="button"
                            onClick={() => {
                              playMinecraftClickSound();
                              setIsInstanceMenuOpen(false);
                              onManageInstance(inst.id);
                            }}
                            className="btn-mc p-1.5 mr-1 text-slate-300 hover:text-white rounded cursor-pointer"
                            title={`Manage ${inst.name}`}
                            aria-label={`Manage ${inst.name}`}
                          >
                            <Settings className="w-3.5 h-3.5 text-[var(--mc-accent)]" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {filteredInstances.length === 0 && (
                    <p className="p-3 text-center text-xs text-slate-400 font-mono">No matching instances.</p>
                  )}
                </div>
              </div>
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
