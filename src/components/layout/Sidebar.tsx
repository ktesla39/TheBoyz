import React from 'react';
import {
  Terminal,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  House,
  LayoutGrid,
  Puzzle,
  BookOpen,
  Globe2,
  Gauge,
  Coffee,
  Download,
  UsersRound,
  SlidersHorizontal,
} from 'lucide-react';
import {
  GrassBlockIcon,
  CraftingTableIcon,
  DiamondSwordIcon,
  PickaxeIcon,
  EnderEyeIcon,
  NetheriteIngotIcon,
  CreeperFaceIcon,
  RedstoneDustIcon,
  GoldenAppleIcon,
  EnchantedBookIcon,
  BeaconIcon,
  TotemIcon,
  PotionBottleIcon,
  DragonEggIcon,
  TridentIcon,
  TheBoysEmblemIcon,
  MinecraftShieldIcon,
  NetherStarIcon,
  EnderPearlIcon,
  ElytraWingsIcon,
  MicrosoftBrandIcon,
  OfflineShieldIcon,
} from '../icons/MinecraftIcons';
import { LauncherAccount } from '../../types/auth';
import { MinecraftPlayerHead } from '../skin/MinecraftPlayerHead';
import { MinecraftSkinCanvas } from '../skin/MinecraftSkinCanvas';
import { playMinecraftClickSound } from '../../services/soundService';

export type NavTab =
  | 'home'
  | 'instances'
  | 'addons'
  | 'versions'
  | 'servers'
  | 'graphics'
  | 'java'
  | 'downloads'
  | 'accounts'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeDownloadsCount: number;
  onOpenConsole: () => void;
  isGameRunning: boolean;
  activeAccount?: LauncherAccount | null;
  onOpenSkinManager?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  launcherIcon?: string;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  tone: string;
  badge?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeDownloadsCount,
  onOpenConsole,
  isGameRunning,
  activeAccount,
  onOpenSkinManager,
  isCollapsed = false,
  onToggleCollapse,
  launcherIcon,
}) => {
  const renderBrandIcon = () => {
    if (launcherIcon && (launcherIcon.startsWith('data:') || launcherIcon.startsWith('http'))) {
      return (
        <img
          src={launcherIcon}
          alt="Custom Launcher Icon"
          className="w-7 h-7 rounded-lg object-cover border border-emerald-500/40 shadow-sm shrink-0"
        />
      );
    }
    switch (launcherIcon) {
      case 'diamond_sword':
        return <DiamondSwordIcon className="w-7 h-7 shrink-0" />;
      case 'netherite_ingot':
        return <NetheriteIngotIcon className="w-7 h-7 shrink-0" />;
      case 'ender_eye':
        return <EnderEyeIcon className="w-7 h-7 shrink-0" />;
      case 'crafting_table':
        return <CraftingTableIcon className="w-7 h-7 shrink-0" />;
      case 'grass_block':
        return <GrassBlockIcon className="w-7 h-7 shrink-0" />;
      case 'pickaxe':
        return <PickaxeIcon className="w-7 h-7 shrink-0" />;
      case 'creeper_face':
        return <CreeperFaceIcon className="w-7 h-7 shrink-0" />;
      case 'redstone_dust':
        return <RedstoneDustIcon className="w-7 h-7 shrink-0" />;
      case 'golden_apple':
        return <GoldenAppleIcon className="w-7 h-7 shrink-0" />;
      case 'enchanted_book':
        return <EnchantedBookIcon className="w-7 h-7 shrink-0" />;
      case 'beacon':
        return <BeaconIcon className="w-7 h-7 shrink-0" />;
      case 'totem':
        return <TotemIcon className="w-7 h-7 shrink-0" />;
      case 'potion':
        return <PotionBottleIcon className="w-7 h-7 shrink-0" />;
      case 'dragon_egg':
        return <DragonEggIcon className="w-7 h-7 shrink-0" />;
      case 'trident':
        return <TridentIcon className="w-7 h-7 shrink-0" />;
      case 'shield':
        return <MinecraftShieldIcon className="w-7 h-7 shrink-0" />;
      case 'nether_star':
        return <NetherStarIcon className="w-7 h-7 shrink-0" />;
      case 'ender_pearl':
        return <EnderPearlIcon className="w-7 h-7 shrink-0" />;
      case 'elytra':
        return <ElytraWingsIcon className="w-7 h-7 shrink-0" />;
      case 'emblem':
        return <TheBoysEmblemIcon className="w-7 h-7 shrink-0" />;
      default:
        return (
          <TheBoysEmblemIcon className="w-7 h-7 shrink-0" />
        );
    }
  };


  const mainNavItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: House, tone: 'text-sky-300' },
    { id: 'instances', label: 'Instances', icon: LayoutGrid, tone: 'text-violet-300' },
    { id: 'addons', label: 'Add-ons', icon: Puzzle, tone: 'text-emerald-300' },
    { id: 'versions', label: 'Versions', icon: BookOpen, tone: 'text-amber-300' },
    { id: 'servers', label: 'Servers', icon: Globe2, tone: 'text-cyan-300' },
  ];

  const systemNavItems: NavItem[] = [
    { id: 'graphics', label: 'Graphics', icon: Gauge, tone: 'text-blue-300' },
    { id: 'java', label: 'Java & JVM', icon: Coffee, tone: 'text-orange-300' },
    {
      id: 'downloads',
      label: 'Downloads',
      icon: Download,
      tone: 'text-teal-300',
      badge: activeDownloadsCount > 0 ? activeDownloadsCount : undefined,
    },
    { id: 'accounts', label: 'Accounts', icon: UsersRound, tone: 'text-pink-300' },
    { id: 'settings', label: 'Settings', icon: SlidersHorizontal, tone: 'text-slate-300' },
  ];

  return (
    <aside
      className={`bg-[var(--mc-surface)] border-r border-[var(--mc-border)] flex flex-col justify-between select-none h-screen shrink-0 shadow-2xl relative z-30 transition-[width,background-color,border-color] duration-200 ease-in-out motion-reduce:transition-none ${isCollapsed ? 'w-20' : 'w-64'
        }`}
    >
      <div className="overflow-y-auto">
        {/* Brand Lockup & Collapse Toggle */}
        <div className={`px-4 py-4 border-b border-[var(--mc-border)] flex items-center bg-gradient-to-b from-white/[0.03] to-transparent ${isCollapsed ? 'justify-center' : 'justify-between'
          }`}>
          {!isCollapsed ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <span data-launcher-brand-icon className="flex items-center justify-center">
                  {renderBrandIcon()}
                </span>
                <div>
                  <h1 className="text-sm font-black tracking-tight text-white font-display flex items-center gap-1.5 leading-none">
                    THE BOYS
                  </h1>
                  <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-1">
                    Minecraft Client
                  </p>
                </div>
              </div>

              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={() => {
                    playMinecraftClickSound();
                    onToggleCollapse();
                  }}
                  className="p-1 rounded bg-black/40 hover:bg-black/60 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                  title="Collapse sidebar (icons only)"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span data-launcher-brand-icon className="flex items-center justify-center">
                {renderBrandIcon()}
              </span>
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={() => {
                    playMinecraftClickSound();
                    onToggleCollapse();
                  }}
                  className="p-1 rounded bg-black/40 hover:bg-black/60 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                  title="Expand sidebar"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Primary Navigation */}
        <div className="px-3 py-3">
          {!isCollapsed && (
            <div className="px-3 mb-1.5 text-[8px] font-bold text-slate-400 tracking-wider uppercase font-pixel">
              YOUR WORLD
            </div>
          )}
          <nav className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    playMinecraftClickSound();
                    onSelectTab(item.id);
                  }}
                  title={isCollapsed ? item.label : undefined}
                  className={`group relative w-full flex items-center gap-3 text-xs font-semibold rounded cursor-pointer transition-colors ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 text-left'
                    } ${isActive
                      ? 'nav-item-active text-white'
                      : 'nav-item-idle text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                    }`}
                >
                  <div className={`shrink-0 transition-transform duration-200 ${item.tone} ${isActive ? 'scale-105' : 'group-hover:scale-105'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* System & Configuration */}
        <div className="px-3 py-1">
          {!isCollapsed && (
            <div className="px-3 mb-1.5 text-[8px] font-bold text-slate-400 tracking-wider uppercase font-pixel">
              TOOLS
            </div>
          )}
          <nav className="space-y-1">
            {systemNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    playMinecraftClickSound();
                    onSelectTab(item.id);
                  }}
                  title={isCollapsed ? item.label : undefined}
                  className={`group relative w-full flex items-center gap-3 text-xs font-semibold rounded cursor-pointer transition-colors ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 justify-between text-left'
                    } ${isActive
                      ? 'nav-item-active text-white'
                      : 'nav-item-idle text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                    }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className={`shrink-0 transition-transform duration-200 ${item.tone} ${isActive ? 'scale-105' : 'group-hover:scale-105'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!isCollapsed && item.badge !== undefined && (
                    <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/40">
                      {item.badge}
                    </span>
                  )}
                  {isCollapsed && item.badge !== undefined && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer: ACTIVE PLAYER SKIN + CONSOLE */}
      <div className="p-3 border-t border-[var(--mc-border)] space-y-2 bg-[var(--mc-surface)]/80 shrink-0">
        {/* Player Profile & Skin */}
        {activeAccount && (
          <div
            onClick={() => {
              playMinecraftClickSound();
              if (onOpenSkinManager) {
                onOpenSkinManager();
              } else {
                onSelectTab('accounts');
              }
            }}
            className={`rounded-lg bg-black/50 border border-white/10 hover:border-emerald-500/40 transition-all cursor-pointer flex items-center gap-2.5 group ${isCollapsed ? 'p-2 justify-center' : 'p-2.5 justify-between'
              }`}
            title="Click to customize skin or manage account"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <MinecraftPlayerHead
                account={activeAccount}
                skinUrl={activeAccount.skinUrl}
                username={activeAccount.username}
                size={isCollapsed ? 32 : 36}
                className="shrink-0"
              />
              {!isCollapsed && (
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-white font-display truncate">
                      {activeAccount.customDisplayName || activeAccount.username}
                    </span>
                    {activeAccount.type === 'microsoft' ? (
                      <MicrosoftBrandIcon className="w-2.5 h-2.5 shrink-0" />
                    ) : (
                      <OfflineShieldIcon className="w-2.5 h-2.5 shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 mt-0.5">
                    <span>{activeAccount.skinProvider ? activeAccount.skinProvider.toUpperCase() : 'SKIN'}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400">{activeAccount.model === 'slim' ? 'Slim' : 'Classic'}</span>
                  </div>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <div className="p-1 rounded bg-white/5 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-300 transition-colors shrink-0">
                <Palette className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        )}

        {/* Live Console Action (fixed text overlap bug with flexbox) */}
        <button
          onClick={() => {
            playMinecraftClickSound();
            onOpenConsole();
          }}
          title={isCollapsed ? 'Open Live Console' : undefined}
          className={`btn-mc w-full py-2 rounded border transition-all cursor-pointer ${isCollapsed ? 'px-2 flex items-center justify-center' : 'px-3 flex items-center justify-between'
            } ${isGameRunning
              ? 'btn-mc-green text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'text-slate-300'
            }`}
        >
          <div className="flex items-center gap-2 shrink-0">
            <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
            {!isCollapsed && <span className="font-display text-xs">Live Console</span>}
          </div>
        </button>
      </div>
    </aside>
  );
};
