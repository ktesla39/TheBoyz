import React from 'react';
import {
  Play,
  Square,
  ChevronRight,
  Terminal,
  FolderOpen,
  Settings,
  Sparkles,
  ExternalLink,
  Palette,
  Layers,
  Monitor,
  Cpu,
  HardDrive,
  MemoryStick,
  Code2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import heroBanner from '../../assets/images/mc_hero_banner_1794229759381.jpg';
import { DesktopShortcutModal } from '../common/DesktopShortcutModal';
import { MinecraftInstance } from '../../types/instance';
import { LauncherAccount } from '../../types/auth';
import { MinecraftSkinCanvas } from '../skin/MinecraftSkinCanvas';
import {
  GrassBlockIcon,
  CraftingTableIcon,
  DiamondSwordIcon,
  MicrosoftBrandIcon,
  OfflineShieldIcon,
  RamChipIcon,
  OpenGlApiIcon,
  VulkanApiIcon,
} from '../icons/MinecraftIcons';
import { playMinecraftClickSound } from '../../services/soundService';
import { TauriHardwareInfo, TauriJavaInstallation } from '../../services/tauriBridge';

interface HomeViewProps {
  activeInstance: MinecraftInstance | null;
  activeAccount: LauncherAccount | null;
  instances: MinecraftInstance[];
  isGameRunning: boolean;
  isLaunching: boolean;
  desktopAvailable: boolean;
  hardwareInfo: TauriHardwareInfo | null;
  javaInstallations: TauriJavaInstallation[];
  runtimeError: string | null;
  onRefreshRuntime: () => void;
  onLaunchGame: (instanceId?: string) => void;
  onStopGame: () => void;
  onSelectInstance: (id: string) => void;
  onNavigateTab: (tab: any) => void;
  onOpenConsole: () => void;
  onOpenSkinManager?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  activeInstance,
  activeAccount,
  instances,
  isGameRunning,
  isLaunching,
  desktopAvailable,
  hardwareInfo,
  javaInstallations,
  runtimeError,
  onRefreshRuntime,
  onLaunchGame,
  onStopGame,
  onSelectInstance,
  onNavigateTab,
  onOpenConsole,
  onOpenSkinManager,
}) => {
  const [isShortcutOpen, setIsShortcutOpen] = React.useState(false);
  const canLaunch = Boolean(
    activeInstance &&
    activeAccount &&
    desktopAvailable &&
    !isLaunching
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-7 select-none">
      {/* Authentic Minecraft Launcher Hero Cockpit */}
      <div className="relative min-h-[280px] rounded-2xl overflow-hidden border border-[#262f40] bg-[#10141e] shadow-2xl">
        {/* Background Minecraft Cinematic Image */}
        <div className="absolute inset-0">
          <img
            src={heroBanner}
            alt="Minecraft Landscape"
            className="w-full h-full object-cover object-center filter brightness-[0.55] contrast-[1.1]"
          />
          {/* Authentic Dark Scrim Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e121a] via-[#0e121a]/75 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e121a] via-[#0e121a]/60 to-transparent" />
        </div>

        {/* Content Layer Inside Banner */}
        <div className="relative z-10 min-h-[280px] p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            {/* Version Kicker */}
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <span className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded border border-white/10 font-mono">
                <GrassBlockIcon className="w-3.5 h-3.5" />
                <span>MINECRAFT: JAVA EDITION</span>
              </span>
              {activeInstance && (
                <span className="text-slate-300 font-mono text-[11px]">
                  · Release {activeInstance.gameVersion}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white font-display tracking-tight leading-tight drop-shadow-md">
              {activeInstance ? activeInstance.name : 'Select a Minecraft Instance'}
            </h1>

            {/* Clean Unboxed Metadata Strip */}
            {activeInstance && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-mono pt-1">
                <span className="flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded border border-white/10">
                  <span className="text-emerald-400 font-bold">{activeInstance.gameVersion}</span>
                  <span className="text-slate-500">/</span>
                  <span className="text-slate-200 uppercase">{activeInstance.loader}</span>
                </span>

                <span className="flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded border border-white/10">
                  <RamChipIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{activeInstance.javaConfig.maxMemoryMb} MB RAM</span>
                </span>

                <span className="flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded border border-white/10">
                  {activeInstance.graphicsApi === 'vulkan' ? (
                    <VulkanApiIcon className="w-3.5 h-3.5" />
                  ) : (
                    <OpenGlApiIcon className="w-3.5 h-3.5" />
                  )}
                  <span className="uppercase text-slate-200">{activeInstance.graphicsApi}</span>
                </span>

                <span className="bg-black/50 px-2.5 py-1 rounded border border-white/10 text-slate-300">
                  {activeInstance.mods.length} Mods Installed
                </span>
              </div>
            )}
          </div>

          {/* Master Launch Dock with Minecraft Texture Pack Button */}
          <div className="shrink-0 flex flex-col items-center gap-3 w-full md:w-auto">
            {isGameRunning ? (
              <div className="w-full md:w-64 space-y-2">
                <button
                  onClick={onStopGame}
                  className="btn-mc btn-mc-red w-full py-4 px-6 rounded text-white font-extrabold text-base tracking-wider flex items-center justify-center gap-3 cursor-pointer font-display"
                >
                  <Square className="w-5 h-5 fill-current" />
                  <span>STOP GAME</span>
                </button>
                <button
                  onClick={onOpenConsole}
                  className="btn-mc btn-mc-green w-full py-2 px-4 rounded text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer font-display"
                >
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Show Console Stream</span>
                </button>
              </div>
            ) : (
              <div className="w-full md:w-64 space-y-2.5">
                <button
                  onClick={() => onLaunchGame()}
                  disabled={!canLaunch}
                  className="btn-mc btn-mc-green w-full py-4 px-8 rounded disabled:opacity-50 text-white font-black text-xl tracking-wider flex items-center justify-center gap-3 cursor-pointer group font-display"
                >
                  {isLaunching ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
                  )}
                  <span>{isLaunching ? 'STARTING' : 'PLAY'}</span>
                </button>
                {!desktopAvailable ? (
                  <p className="text-center text-[10px] text-amber-300 font-mono">
                    Game launch requires the installed desktop launcher.
                  </p>
                ) : activeInstance && !activeInstance.javaConfig.path.trim() ? (
                  <p className="w-full text-center text-[10px] text-slate-400 font-mono">
                    The launcher will detect a compatible Java runtime when you start the game.
                  </p>
                ) : null}

                {activeInstance && (
                  <button
                    type="button"
                    onClick={() => {
                      playMinecraftClickSound();
                      setIsShortcutOpen(true);
                    }}
                    className="btn-mc btn-mc-green w-full py-1.5 px-3 text-[11px] font-bold text-white rounded flex items-center justify-center gap-1.5 cursor-pointer font-display"
                    title="Generate Desktop Shortcut for this instance"
                  >
                    <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Create Desktop Shortcut</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="card-obsidian rounded-2xl p-5 sm:p-6 border border-white/[0.08]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--mc-accent)] font-bold">
              Runtime &amp; system
            </p>
            <h2 className="text-base font-black text-white font-display mt-1">
              Desktop readiness
            </h2>
          </div>
          <button
            type="button"
            onClick={onRefreshRuntime}
            disabled={!desktopAvailable}
            className="btn-mc btn-mc-green self-start sm:self-auto px-3 py-2 rounded text-xs font-bold text-white flex items-center gap-2 disabled:opacity-50 font-display"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh system checks
          </button>
        </div>

        {!desktopAvailable ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
            <AlertCircle className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-100">Native services are unavailable in browser preview.</p>
              <p className="text-xs text-slate-400 mt-1">Open the installed desktop app to detect Java, inspect hardware, and launch a game process.</p>
            </div>
          </div>
        ) : (
          <>
            {runtimeError && (
              <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.06] p-3 text-xs text-red-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{runtimeError}</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
                <Cpu className="w-4 h-4 text-[var(--mc-accent)] mb-3" />
                <p className="text-[10px] text-slate-500 uppercase font-mono">Processor</p>
                <p className="text-sm text-white font-bold mt-1 truncate" title={hardwareInfo?.cpu_brand}>
                  {hardwareInfo?.cpu_brand ?? 'Waiting for system data'}
                </p>
                {hardwareInfo && <p className="text-[10px] text-slate-500 mt-1">{hardwareInfo.cpu_cores} logical cores · {hardwareInfo.os} {hardwareInfo.os_version}</p>}
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
                <MemoryStick className="w-4 h-4 text-[var(--mc-accent)] mb-3" />
                <p className="text-[10px] text-slate-500 uppercase font-mono">Memory</p>
                <p className="text-sm text-white font-bold mt-1">
                  {hardwareInfo ? `${(hardwareInfo.available_memory_mb / 1024).toFixed(1)} GB available` : 'Waiting for system data'}
                </p>
                {hardwareInfo && <p className="text-[10px] text-slate-500 mt-1">{(hardwareInfo.total_memory_mb / 1024).toFixed(1)} GB total · {hardwareInfo.recommended_ram_mb} MB recommended for Minecraft</p>}
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
                <HardDrive className="w-4 h-4 text-[var(--mc-accent)] mb-3" />
                <p className="text-[10px] text-slate-500 uppercase font-mono">Free storage</p>
                <p className="text-sm text-white font-bold mt-1">
                  {hardwareInfo ? `${hardwareInfo.disk_free_gb} GB` : 'Waiting for system data'}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">Available on the system-reported disk</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
                <Code2 className="w-4 h-4 text-[var(--mc-accent)] mb-3" />
                <p className="text-[10px] text-slate-500 uppercase font-mono">Java runtime</p>
                <p className="text-sm text-white font-bold mt-1">
                  {javaInstallations.length ? `${javaInstallations.length} installation${javaInstallations.length === 1 ? '' : 's'} found` : 'No detected installations'}
                </p>
                <p className="text-[10px] text-slate-500 mt-1 truncate" title={activeInstance?.javaConfig.path}>
                  {activeInstance?.javaConfig.path || 'Choose a runtime in Java & JVM settings'}
                </p>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Main Content Layout: Instances, Runtime, and Player Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Instances Overview & Status */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Launch Instances Rack */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white font-display flex items-center gap-2">
                <DiamondSwordIcon className="w-4 h-4 text-[var(--mc-accent)]" />
                <span>Installed Instances ({instances.length})</span>
              </h2>
              <button
                onClick={() => {
                  playMinecraftClickSound();
                  onNavigateTab('instances');
                }}
                className="btn-mc btn-mc-green px-3 py-1.5 text-xs font-bold text-white flex items-center gap-1 cursor-pointer font-display rounded shadow-sm"
              >
                <span>Manage Workspace</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {instances.length === 0 && (
                <div className="card-obsidian sm:col-span-2 p-6 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-[var(--mc-accent)]">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white font-display">Your worlds start here</h3>
                      <p className="text-xs text-slate-400 mt-1">Create an instance to configure and launch Minecraft.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigateTab('instances')}
                    className="btn-mc btn-mc-green px-4 py-2 text-xs font-bold text-white rounded cursor-pointer font-display"
                  >
                    Create an Instance
                  </button>
                </div>
              )}
              {instances.map((inst) => {
                const isSelected = activeInstance?.id === inst.id;
                return (
                  <div
                    key={inst.id}
                    onClick={() => {
                      playMinecraftClickSound();
                      onSelectInstance(inst.id);
                    }}
                    className={`card-obsidian p-4 rounded-xl transition-all cursor-pointer flex flex-col justify-between gap-3 border min-w-0 overflow-hidden ${isSelected
                      ? 'border-[var(--mc-accent)]/80 bg-[#161c28] ring-1 ring-[var(--mc-accent)]/40'
                      : 'border-[#222734] hover:border-[#353d4f]'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shrink-0 text-[var(--mc-accent)]">
                          {inst.loader === 'fabric' ? (
                            <CraftingTableIcon className="w-5 h-5" />
                          ) : (
                            <GrassBlockIcon className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-white tracking-tight font-display truncate">
                            {inst.name}
                          </h4>
                          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 mt-0.5 truncate">
                            <span className="text-[var(--mc-accent)] font-semibold">{inst.gameVersion}</span>
                            <span>·</span>
                            <span className="uppercase">{inst.loader}</span>
                          </div>
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--mc-badge-bg)] text-[var(--mc-badge-text)] border border-[var(--mc-accent)]/40 font-mono shrink-0">
                          BOOT ACTIVE
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playMinecraftClickSound();
                            onSelectInstance(inst.id);
                            onLaunchGame(inst.id);
                          }}
                          className="btn-mc btn-mc-green p-1.5 rounded text-white shadow-sm shrink-0"
                          title="Launch this instance directly"
                          aria-label={`Launch ${inst.name}`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-t border-white/5 pt-2.5 min-w-0">
                      <span className="truncate">{inst.mods.filter((m) => m.enabled).length} mods loaded</span>
                      <span className="shrink-0">{inst.javaConfig.maxMemoryMb} MB RAM</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Boot Instance Detailed Overview & Quick Settings */}
          {activeInstance && (
            <div className="card-obsidian p-5 rounded-2xl border border-[#222734] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-mono uppercase text-[var(--mc-accent)] font-black tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Active Instance Runtime Cockpit</span>
                  </span>
                  <h3 className="text-base font-black text-white font-display truncate mt-0.5">
                    {activeInstance.name} (Minecraft {activeInstance.gameVersion})
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      playMinecraftClickSound();
                      onNavigateTab('instances');
                    }}
                    className="btn-mc btn-mc-green px-3 py-1.5 text-xs font-bold text-white rounded cursor-pointer font-display shadow-sm flex items-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Configure Instance</span>
                  </button>
                </div>
              </div>

              {/* 3 Metric Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Mod Loader</span>
                  <div className="text-sm font-bold text-white font-display flex items-center gap-1.5">
                    <CraftingTableIcon className="w-4 h-4 text-[var(--mc-accent)]" />
                    <span className="uppercase">{activeInstance.loader}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {activeInstance.mods.length} total add-ons
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Allocated Memory</span>
                  <div className="text-sm font-bold text-white font-display flex items-center gap-1.5">
                    <RamChipIcon className="w-4 h-4 text-[var(--mc-accent)]" />
                    <span>{activeInstance.javaConfig.maxMemoryMb} MB</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    Min: {activeInstance.javaConfig.minMemoryMb} MB heap
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Graphics Backend</span>
                  <div className="text-sm font-bold text-white font-display flex items-center gap-1.5">
                    <OpenGlApiIcon className="w-4 h-4 text-[var(--mc-accent)]" />
                    <span className="uppercase">{activeInstance.graphicsApi}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">
                      Configured preference; support depends on this installation.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="card-obsidian rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--mc-accent)] font-bold">
                  Player Profile
                </span>
                <h2 className="text-base font-black text-white font-display mt-0.5">Your identity</h2>
              </div>
              {activeAccount && (
                activeAccount.type === 'microsoft'
                  ? <MicrosoftBrandIcon className="w-4 h-4 text-emerald-400" />
                  : <OfflineShieldIcon className="w-4 h-4 text-amber-400" />
              )}
            </div>

            {activeAccount ? (
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <div className="w-[76px] h-[88px] shrink-0 rounded-xl bg-black/35 border border-white/10 flex items-end justify-center overflow-hidden">
                    <MinecraftSkinCanvas
                      skinUrl={activeAccount.skinUrl}
                      capeUrl={activeAccount.capeUrl}
                      model={activeAccount.model}
                      mode="bust"
                      height={82}
                      width={70}
                      interactive={false}
                      className="translate-y-1"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-white font-display truncate">
                      {activeAccount.username}
                    </h3>
                    <span className={`inline-flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded text-[9px] font-mono font-bold border ${
                      activeAccount.type === 'microsoft'
                        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
                        : 'text-amber-300 bg-amber-500/10 border-amber-500/25'
                    }`}>
                      {activeAccount.type === 'microsoft'
                        ? <MicrosoftBrandIcon className="w-2.5 h-2.5" />
                        : <OfflineShieldIcon className="w-2.5 h-2.5" />}
                      {activeAccount.type === 'microsoft' ? 'MICROSOFT' : 'OFFLINE PROFILE'}
                    </span>
                    <p className="text-[10px] text-slate-500 font-mono mt-2 truncate">
                      {activeAccount.capeName
                        ? `Cape · ${activeAccount.capeName}`
                        : activeAccount.model
                          ? `Model · ${activeAccount.model}`
                          : 'Model not provided'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    playMinecraftClickSound();
                    if (onOpenSkinManager) onOpenSkinManager();
                    else onNavigateTab('accounts');
                  }}
                  className="btn-mc btn-mc-green w-full mt-4 px-3 py-2 text-xs font-bold text-white rounded flex items-center justify-center gap-2 cursor-pointer font-display"
                >
                  <Palette className="w-3.5 h-3.5" />
                  Customize Skin & Cape
                </button>
              </div>
            ) : (
              <div className="p-5">
                <p className="text-sm font-semibold text-white">No player profile selected</p>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Add an account to personalize your player and launch the game.
                </p>
                <button
                  onClick={() => onNavigateTab('accounts')}
                  className="btn-mc btn-mc-green w-full mt-4 px-3 py-2 text-xs font-bold text-white rounded cursor-pointer font-display"
                >
                  Manage Accounts
                </button>
              </div>
            )}
          </div>

          <div className="card-obsidian p-4 rounded-2xl space-y-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400 font-bold">
              Explore
            </h2>
            <button
              onClick={() => onNavigateTab('addons')}
              className="btn-mc btn-mc-green w-full px-3 py-2.5 text-xs font-bold text-white rounded flex items-center justify-between cursor-pointer font-display"
            >
              <span className="flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> Browse Add-ons</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigateTab('servers')}
              className="btn-mc btn-mc-green w-full px-3 py-2.5 text-xs font-bold text-white rounded flex items-center justify-between cursor-pointer font-display"
            >
              <span className="flex items-center gap-2"><ExternalLink className="w-3.5 h-3.5" /> Find a Server</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>
      </div>

      {isShortcutOpen && activeInstance && (
        <DesktopShortcutModal
          isOpen={isShortcutOpen}
          onClose={() => setIsShortcutOpen(false)}
          instance={activeInstance}
        />
      )}
    </div>
  );
};
