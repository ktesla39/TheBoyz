import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  ChevronDown,
  Search,
  Plus,
  Check,
  Sparkles,
  Settings,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { MinecraftInstance } from '../../types/instance';
import { LauncherAccount } from '../../types/auth';
import { MinecraftPlayerHead } from '../skin/MinecraftPlayerHead';
import {
  DiamondSwordIcon,
  CraftingTableIcon,
  GrassBlockIcon,
  PickaxeIcon,
  EnderEyeIcon,
  MicrosoftBrandIcon,
  OfflineShieldIcon,
  RamChipIcon,
} from '../icons/MinecraftIcons';
import { playMinecraftClickSound } from '../../services/soundService';

interface TopHeaderProps {
  currentTabTitle?: string;
  activeInstance: MinecraftInstance | null;
  activeAccount: LauncherAccount | null;
  instances: MinecraftInstance[];
  isGameRunning: boolean;
  isLaunching: boolean;
  desktopAvailable: boolean;
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

  const getInstanceIcon = (iconName?: string) => {
    if (!iconName) return <DiamondSwordIcon className="w-4 h-4" />;
    if (iconName.startsWith('data:') || iconName.startsWith('http')) {
      return <img src={iconName} alt="icon" className="w-4 h-4 rounded object-cover" />;
    }
    switch (iconName) {
      case 'crafting_table':
        return <CraftingTableIcon className="w-4 h-4" />;
      case 'grass_block':
        return <GrassBlockIcon className="w-4 h-4" />;
      case 'pickaxe':
        return <PickaxeIcon className="w-4 h-4" />;
      case 'ender_eye':
        return <EnderEyeIcon className="w-4 h-4" />;
      default:
        return <DiamondSwordIcon className="w-4 h-4" />;
    }
  };

  return (
    <header className="h-16 px-4 sm:px-6 border-b border-[#1c2230] bg-[#0c1017]/95 backdrop-blur-md flex items-center justify-end gap-3 sm:gap-4 shrink-0 select-none z-30 relative">
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
              title="Click to view all instances and see how the launcher chooses which instance to boot for Play and Server Direct Connect"
            >
              <div className="w-7 h-7 rounded bg-black/60 border border-white/10 flex items-center justify-center text-xs shrink-0 text-[var(--mc-accent)]">
                {getInstanceIcon(activeInstance.icon)}
              </div>
              <div className="text-left min-w-0 pr-1 max-w-[140px] sm:max-w-[200px]">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-[9px] font-mono uppercase text-[var(--mc-accent)] font-extrabold tracking-wider truncate">
                    Boot Target
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 hidden xl:inline truncate">
                    (Play &amp; Connect)
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

            {/* Quick Instances Dropdown Menu with Comprehensive Explanation */}
            {isInstanceMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-84 sm:w-[440px] rounded-2xl card-obsidian border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.9)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Explanatory Callout Banner Describing How Launcher Chooses Instance */}
                <div className="p-4 bg-gradient-to-r from-black/80 via-[#0d171e] to-black/90 border-b border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black text-[var(--mc-accent)] font-display">
                      <Sparkles className="w-4 h-4 text-[var(--mc-accent)] shrink-0" />
                      <span>How the Launcher Chooses the Boot Instance</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold bg-[var(--mc-badge-bg)] text-[var(--mc-badge-text)] px-1.5 py-0.5 rounded border border-white/10">
                      Rule Engine
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300 font-mono leading-relaxed space-y-1.5">
                    <p>
                      <strong>1. Master Boot Target:</strong> The instance marked <span className="text-[var(--mc-accent)] font-bold">BOOT ACTIVE</span> dictates the exact game version, mod loader (Fabric/Forge/Vanilla), mods folder, and memory settings.
                    </p>
                    <p>
                      <strong>2. Used for &apos;PLAY&apos;:</strong> Clicking the green <strong>PLAY</strong> button launches this instance directly.
                    </p>
                    <p>
                      <strong>3. Used for &apos;Direct Connect&apos;:</strong> In the Server Monitor, joining any multiplayer server boots this instance and passes the <code>--server</code> IP.
                    </p>
                  </div>

                  <div className="text-[10px] text-[var(--mc-accent)] font-mono pt-1.5 border-t border-white/10 flex items-center justify-between min-w-0">
                    <span className="shrink-0 text-slate-400">Current Boot Choice:</span>
                    <strong className="text-white truncate ml-2 max-w-[240px]">
                      {activeInstance.name} (MC {activeInstance.gameVersion})
                    </strong>
                  </div>
                </div>

                {/* Search & Actions Header */}
                <div className="p-3 border-b border-white/10 bg-[#090c12] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-white font-display">
                    <span className="truncate">All Installed Instances ({instances.length})</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {onManageInstance && (
                        <button
                          onClick={() => {
                            playMinecraftClickSound();
                            setIsInstanceMenuOpen(false);
                            onManageInstance(activeInstance.id);
                          }}
                          className="btn-mc px-2 py-1 text-[11px] text-slate-200 hover:text-white flex items-center gap-1 cursor-pointer font-display shadow-sm"
                        >
                          <Settings className="w-3 h-3 text-[var(--mc-accent)]" />
                          <span>Manage Active</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          playMinecraftClickSound();
                          setIsInstanceMenuOpen(false);
                          onOpenCreateInstance();
                        }}
                        className="btn-mc btn-mc-green px-2.5 py-1 text-[11px] text-white flex items-center gap-1 cursor-pointer font-display font-bold shadow-sm"
                      >
                        <Plus className="w-3 h-3" />
                        <span>New</span>
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search instances by name, version, loader..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-black/60 border border-white/10 rounded-lg text-white font-mono focus:outline-none focus:border-[var(--mc-accent)]"
                    />
                  </div>
                </div>

                {/* Instance List */}
                <div className="max-h-72 overflow-y-auto p-2 space-y-1.5">
                  {filteredInstances.map((inst) => {
                    const isSelected = inst.id === activeInstance.id;
                    return (
                      <div
                        key={inst.id}
                        onClick={() => {
                          playMinecraftClickSound();
                          onSelectInstance(inst.id);
                          setIsInstanceMenuOpen(false);
                        }}
                        className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 ${isSelected
                          ? 'bg-[#18212e] border border-[var(--mc-accent)]/60 shadow-sm'
                          : 'hover:bg-white/[0.05] border border-transparent'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center shrink-0 text-[var(--mc-accent)]">
                            {getInstanceIcon(inst.icon)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-white font-display truncate max-w-[170px]">
                                {inst.name}
                              </span>
                              {isSelected && (
                                <span className="text-[9px] font-mono font-black text-[var(--mc-accent)] bg-[var(--mc-badge-bg)] px-1.5 py-0.2 rounded border border-[var(--mc-accent)]/30 shrink-0">
                                  BOOT ACTIVE
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                              MC {inst.gameVersion} · {inst.loader.toUpperCase()} · {(inst.mods || []).length} mods
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {onManageInstance && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playMinecraftClickSound();
                                setIsInstanceMenuOpen(false);
                                onManageInstance(inst.id);
                              }}
                              className="btn-mc p-1.5 text-slate-300 hover:text-white rounded text-xs cursor-pointer"
                              title="Manage instance settings & mods"
                            >
                              <Settings className="w-3.5 h-3.5 text-[var(--mc-accent)]" />
                            </button>
                          )}
                          {isSelected ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-[var(--mc-accent)] shadow-[0_0_8px_var(--mc-accent)] shrink-0 mr-1" />
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playMinecraftClickSound();
                                onSelectInstance(inst.id);
                                setIsInstanceMenuOpen(false);
                              }}
                              className="btn-mc btn-mc-diamond px-2 py-1 text-[10px] font-mono font-bold text-white rounded cursor-pointer"
                            >
                              Set Boot
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
        <div>
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
        </div>
      </div>
    </header>
  );
};
