import React from 'react';
import {
  Play,
  Plus,
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
  Gamepad2,
  MonitorCog,
  RefreshCw,
  AlertCircle,
  Users,
} from 'lucide-react';
import { DesktopShortcutModal } from '../common/DesktopShortcutModal';
import { MinecraftInstance } from '../../types/instance';
import { LauncherAccount } from '../../types/auth';
import { MinecraftSkinCanvas } from '../skin/MinecraftSkinCanvas';
import { MicrosoftBrandIcon, OfflineShieldIcon } from '../icons/MinecraftIcons';
import { LoaderGlyph } from '../icons/LoaderGlyph';
import { InstanceCircleLogo } from '../instances/InstanceCircleLogo';
import { playMinecraftClickSound } from '../../services/soundService';
import { TauriHardwareInfo, TauriJavaInstallation } from '../../services/tauriBridge';
import { getRecommendedJavaVersion } from '../../services/mojangApi';

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
    <div className="p-4 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-5 select-none">
      <section className="card-obsidian home-launch-panel overflow-hidden rounded-2xl p-4 sm:p-5 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] items-center gap-5 lg:gap-8">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--mc-accent)]">
              <Gamepad2 className="h-4 w-4" />
              <span>Minecraft Java Edition</span>
              {activeInstance && <span className="text-[var(--mc-muted)] tracking-normal">· {activeInstance.gameVersion}</span>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-[var(--mc-text)] leading-tight">
              {activeInstance ? activeInstance.name : 'Your next world starts here'}
            </h1>
            <p className="max-w-2xl text-sm text-[var(--mc-muted)] leading-relaxed">
              {activeInstance
                ? `${activeInstance.loader.toUpperCase()} instance · ${activeInstance.mods.filter((mod) => mod.enabled).length} enabled mods · ${activeInstance.javaConfig.maxMemoryMb} MB memory`
                : 'Create an instance to choose your Minecraft version, mod loader, and settings.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {activeInstance && (
                <span className="rounded-lg border border-[var(--mc-border)] bg-[var(--mc-panel)] px-2.5 py-1 text-xs font-mono text-[var(--mc-text)]">
                  {activeInstance.graphicsApi.toUpperCase()}
                </span>
              )}
              <span className="rounded-lg border border-[var(--mc-border)] bg-[var(--mc-panel)] px-2.5 py-1 text-xs font-mono text-[var(--mc-text)]">
                {javaInstallations.length} Java runtime{javaInstallations.length === 1 ? '' : 's'} detected
              </span>
              {activeInstance && getRecommendedJavaVersion(activeInstance.gameVersion) !== null && (
                <span className="rounded-lg border border-[var(--mc-border)] bg-[var(--mc-panel)] px-2.5 py-1 text-xs font-mono text-[var(--mc-muted)]">
                  Recommends Java {getRecommendedJavaVersion(activeInstance.gameVersion)}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 lg:w-80">
            {!activeInstance ? (
              <button onClick={() => onNavigateTab('instances')} className="btn-mc btn-mc-green flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-xs font-bold text-white font-display">
                <Plus className="h-4 w-4" /> Create first instance
              </button>
            ) : isGameRunning ? (
              <>
                <button onClick={onStopGame} className="btn-mc btn-mc-red flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold text-white font-display">
                  <Square className="h-4 w-4 fill-current" /> Stop game
                </button>
                <button onClick={onOpenConsole} className="btn-mc flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-[var(--mc-text)]">
                  <Terminal className="h-4 w-4" /> Open console
                </button>
              </>
            ) : (
              <button onClick={() => onLaunchGame()} disabled={!canLaunch} className="btn-mc btn-mc-green flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-base font-black text-white font-display disabled:opacity-45">
                {isLaunching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                {isLaunching ? 'Starting…' : 'Play instance'}
              </button>
            )}
            {activeInstance && (
              <button type="button" onClick={() => setIsShortcutOpen(true)} className="flex items-center justify-center gap-2 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-panel)] px-4 py-2 text-xs font-semibold text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-surface-hover)]">
                <Monitor className="h-3.5 w-3.5" /> Create desktop shortcut
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="card-obsidian card-selectable rounded-2xl p-5 sm:p-6">
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
            className="btn-mc self-start sm:self-auto px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
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
            <div className="home-stat-grid">
              <div className="home-stat">
                <span data-tone="ice" className="home-stat-icon"><Cpu className="w-4 h-4" /></span>
                <p className="text-[10px] text-slate-500 uppercase font-mono">Processor</p>
                <p className="text-sm text-white font-bold mt-1 truncate" title={hardwareInfo?.cpu_brand}>
                  {hardwareInfo?.cpu_brand ?? 'Waiting for system data'}
                </p>
                {hardwareInfo && <p className="text-[10px] text-slate-500 mt-1">{hardwareInfo.cpu_cores} logical cores · {hardwareInfo.os} {hardwareInfo.os_version}</p>}
              </div>
              <div className="home-stat">
                <span data-tone="violet" className="home-stat-icon"><MemoryStick className="w-4 h-4" /></span>
                <p className="text-[10px] text-slate-500 uppercase font-mono">Memory</p>
                <p className="text-sm text-white font-bold mt-1">
                  {hardwareInfo ? `${(hardwareInfo.available_memory_mb / 1024).toFixed(1)} GB available` : 'Waiting for system data'}
                </p>
                {hardwareInfo && <p className="text-[10px] text-slate-500 mt-1">{(hardwareInfo.total_memory_mb / 1024).toFixed(1)} GB total · {hardwareInfo.recommended_ram_mb} MB recommended for Minecraft</p>}
              </div>
              <div className="home-stat">
                <span data-tone="amber" className="home-stat-icon"><HardDrive className="w-4 h-4" /></span>
                <p className="text-[10px] text-slate-500 uppercase font-mono">Free storage</p>
                <p className="text-sm text-white font-bold mt-1">
                  {hardwareInfo ? `${hardwareInfo.disk_free_gb} GB` : 'Waiting for system data'}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">Available on the system-reported disk</p>
              </div>
              <div className="home-stat">
                <span data-tone="green" className="home-stat-icon"><Code2 className="w-4 h-4" /></span>
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
                <Gamepad2 className="w-4 h-4 text-[var(--mc-accent)]" />
                <span>Installed Instances ({instances.length})</span>
              </h2>
              <button
                onClick={() => {
                  playMinecraftClickSound();
                  onNavigateTab('instances');
                }}
                className="btn-mc px-3 py-1.5 text-xs font-semibold flex items-center gap-1 cursor-pointer rounded-lg"
              >
                <span>Manage Workspace</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {instances.length === 0 && (
                <div className="home-empty-instance sm:col-span-2 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="home-empty-icon w-11 h-11 rounded-2xl flex items-center justify-center shrink-0">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white font-display">Your worlds start here</h3>
                      <p className="text-xs text-slate-400 mt-1">Create an instance to configure and launch Minecraft.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigateTab('instances')}
                    className="btn-mc btn-mc-green px-4 py-2 text-xs font-semibold text-white rounded-lg cursor-pointer"
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
                    data-tone={inst.loader === 'fabric' ? 'ice' : inst.loader === 'quilt' ? 'violet' : inst.loader === 'forge' || inst.loader === 'neoforge' ? 'amber' : 'green'}
                    className={`card-obsidian card-selectable p-4 rounded-xl transition-all cursor-pointer flex flex-col justify-between gap-3 min-w-0 overflow-hidden ${isSelected ? 'card-selected' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <InstanceCircleLogo
                          loader={inst.loader}
                          icon={inst.icon}
                          size="md"
                        />
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
                          ACTIVE
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
            <div className="card-obsidian home-detail-panel p-5 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-mono uppercase text-[var(--mc-accent)] font-black tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ready to play</span>
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

              <div className="home-detail-list">
                <div className="home-detail-item">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Mod Loader</span>
                  <div className="text-sm font-bold text-white font-display flex items-center gap-2">
                    <InstanceCircleLogo
                      loader={activeInstance.loader}
                      icon={activeInstance.icon}
                      size="sm"
                    />
                    <span className="uppercase">{activeInstance.loader}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {activeInstance.mods.length} total add-ons
                  </span>
                </div>

                <div className="home-detail-item">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Allocated Memory</span>
                  <div className="text-sm font-bold text-white font-display flex items-center gap-1.5">
                    <MemoryStick className="w-4 h-4 text-[var(--mc-accent)]" />
                    <span>{activeInstance.javaConfig.maxMemoryMb} MB</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    Min: {activeInstance.javaConfig.minMemoryMb} MB heap
                  </span>
                </div>

                <div className="home-detail-item">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Graphics Backend</span>
                  <div className="text-sm font-bold text-white font-display flex items-center gap-1.5">
                    <MonitorCog className="w-4 h-4 text-[var(--mc-accent)]" />
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
          <div data-tone={activeAccount?.type === 'microsoft' ? 'ice' : 'amber'} className="card-obsidian home-account-panel rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between bg-black/25">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--mc-accent)] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--mc-accent)] animate-pulse" />
                  Player Command
                </span>
                <h2 className="text-base font-black text-white font-display mt-0.5">Active Avatar</h2>
              </div>
              {activeAccount && (
                activeAccount.type === 'microsoft'
                  ? <MicrosoftBrandIcon className="w-4 h-4 text-emerald-400" />
                  : <OfflineShieldIcon className="w-4 h-4 text-amber-400" />
              )}
            </div>

            {activeAccount ? (
              <div className="p-5 flex flex-col items-center">
                {/* Full-Body Player Character Stage & Pedestal */}
                <div className="relative w-full flex flex-col items-center py-2">
                  {/* Floating Minecraft Player Nametag */}
                  <div className="px-3 py-1 rounded bg-black/85 border border-white/15 text-white font-pixel text-[11px] shadow-[0_4px_12px_rgba(0,0,0,0.8)] mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{activeAccount.customDisplayName || activeAccount.username}</span>
                  </div>

                  {/* Character Viewport */}
                  <div className="relative z-10 drop-shadow-[0_16px_28px_rgba(0,0,0,0.9)]">
                    <MinecraftSkinCanvas
                      skinUrl={activeAccount.skinUrl}
                      capeUrl={activeAccount.capeUrl}
                      model={activeAccount.model}
                      mode="full"
                      height={210}
                      width={140}
                      interactive={true}
                      className="block"
                    />
                  </div>

                  {/* Holographic Glowing Pedestal Stage */}
                  <div className="w-36 h-8 -mt-3 rounded-[50%] bg-gradient-to-b from-[var(--mc-glow-color)] to-transparent border-t border-[var(--mc-accent)]/50 blur-[1px] pointer-events-none" />
                  <div className="w-28 h-4 -mt-6 rounded-[50%] bg-[var(--mc-accent)]/20 blur-[3px] pointer-events-none" />

                  <span className="text-[10px] font-mono text-slate-400 font-semibold tracking-wider uppercase mt-1">
                    Drag to rotate 360°
                  </span>
                </div>

                {/* Account Details & Badges */}
                <div className="w-full mt-3 pt-3 border-t border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono">Status</span>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      activeAccount.type === 'microsoft'
                        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                        : 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                    }`}>
                      {activeAccount.type === 'microsoft'
                        ? <MicrosoftBrandIcon className="w-2.5 h-2.5" />
                        : <OfflineShieldIcon className="w-2.5 h-2.5" />}
                      {activeAccount.type === 'microsoft' ? 'MICROSOFT ONLINE' : 'ELY.BY / OFFLINE'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Arm Geometry</span>
                    <span className="text-white font-bold uppercase">{activeAccount.model || 'Classic'} (4px)</span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Cloak / Cape</span>
                    <span className="text-[var(--mc-accent)] font-bold">{activeAccount.capeName || 'Equipped'}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => {
                        playMinecraftClickSound();
                        if (onOpenSkinManager) onOpenSkinManager();
                        else onNavigateTab('accounts');
                      }}
                      className="btn-mc btn-mc-green py-2 px-2 text-xs font-bold text-white rounded cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>Skin Studio</span>
                    </button>
                    <button
                      onClick={() => {
                        playMinecraftClickSound();
                        onNavigateTab('accounts');
                      }}
                      className="btn-mc py-2 px-2 text-xs font-bold text-slate-200 rounded cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Accounts</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-white font-display">No Profile Selected</p>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-mono">
                  Sign in with Microsoft or create an Ely.by offline profile to personalize your player.
                </p>
                <button
                  onClick={() => onNavigateTab('accounts')}
                  className="btn-mc btn-mc-green w-full mt-4 px-4 py-2.5 text-xs font-bold text-white rounded cursor-pointer font-display"
                >
                  Configure Accounts
                </button>
              </div>
            )}
          </div>

          <div className="home-explore-links space-y-2">
            <h2 className="px-1 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400 font-bold">
              Explore
            </h2>
            <button
              onClick={() => onNavigateTab('addons')}
              className="home-action-link w-full px-3 py-2.5 text-xs font-semibold rounded-xl flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2"><Layers className="w-4 h-4" /> Browse Add-ons</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigateTab('servers')}
              className="home-action-link w-full px-3 py-2.5 text-xs font-semibold rounded-xl flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Find a Server</span>
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
