import React, { useEffect, useState } from 'react';
import {
  Globe,
  Plus,
  Play,
  Trash2,
  RefreshCw,
  Signal,
  Check,
  X,
  Settings,
  Sparkles,
  Layers,
  ChevronDown,
  Info,
} from 'lucide-react';
import { ServerBookmark, MinecraftInstance } from '../../types/instance';
import { invokePingMinecraftServer } from '../../services/tauriBridge';
import {
  GrassBlockIcon,
  DiamondSwordIcon,
  CraftingTableIcon,
  PickaxeIcon,
  EnderEyeIcon,
  NetheriteIngotIcon,
} from '../icons/MinecraftIcons';
import { playMinecraftClickSound, playMinecraftLevelUpSound } from '../../services/soundService';

interface ServersViewProps {
  servers: ServerBookmark[];
  activeInstance?: MinecraftInstance | null;
  instances?: MinecraftInstance[];
  onSelectInstance?: (id: string) => void;
  onManageInstance?: (id: string) => void;
  onAddServer: (server: ServerBookmark) => void;
  onUpdateServer: (server: ServerBookmark) => void;
  onDeleteServer: (id: string) => void;
  onLaunchWithServer: (serverAddress: string, instanceId?: string) => void;
}

/** Converts Minecraft formatting codes like §a, §c, §e into colored HTML spans */
function renderMinecraftMotd(motd: string) {
  const parts = motd.split(/(§[0-9a-fk-or])/g);
  let currentColor = '#cbd5e1';

  const colorMap: Record<string, string> = {
    '§0': '#000000',
    '§1': '#0000aa',
    '§2': '#00aa00',
    '§3': '#00aaaa',
    '§4': '#aa0000',
    '§5': '#aa00aa',
    '§6': '#ffaa00',
    '§7': '#aaaaaa',
    '§8': '#555555',
    '§9': '#5555ff',
    '§a': '#55ff55',
    '§b': '#55ffff',
    '§c': '#ff5555',
    '§d': '#ff55ff',
    '§e': '#ffff55',
    '§f': '#ffffff',
  };

  return parts.map((part, index) => {
    if (colorMap[part]) {
      currentColor = colorMap[part];
      return null;
    }
    return (
      <span key={index} style={{ color: currentColor }}>
        {part}
      </span>
    );
  });
}

export const ServersView: React.FC<ServersViewProps> = ({
  servers,
  activeInstance,
  instances = [],
  onSelectInstance,
  onManageInstance,
  onAddServer,
  onUpdateServer,
  onDeleteServer,
  onLaunchWithServer,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerAddress, setNewServerAddress] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBootInstanceId, setSelectedBootInstanceId] = useState<string>(
    activeInstance?.id ?? instances[0]?.id ?? ''
  );

  useEffect(() => {
    if (activeInstance?.id) {
      setSelectedBootInstanceId(activeInstance.id);
    } else if (!instances.some((instance) => instance.id === selectedBootInstanceId)) {
      setSelectedBootInstanceId(instances[0]?.id ?? '');
    }
  }, [activeInstance?.id, instances, selectedBootInstanceId]);

  const currentBootInstance = instances.find((i) => i.id === selectedBootInstanceId) ?? null;

  const pingServer = async (server: ServerBookmark) => {
    onUpdateServer({ ...server, status: 'checking', error: undefined });
    try {
      const result = await invokePingMinecraftServer(server.address);
      onUpdateServer({
        ...server,
        address: result.address,
        pingMs: result.ping_ms,
        motd: result.motd,
        onlinePlayers: result.players_online,
        maxPlayers: result.players_max,
        status: result.online ? 'online' : 'offline',
        error: undefined,
      });
    } catch (reason) {
      onUpdateServer({
        ...server,
        status: 'error',
        error: reason instanceof Error ? reason.message : String(reason),
      });
    }
  };

  const handleRefreshAll = async () => {
    playMinecraftClickSound();
    setRefreshing(true);
    try {
      await Promise.all(servers.map(pingServer));
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName.trim() || !newServerAddress.trim()) return;
    playMinecraftLevelUpSound();

    const newBookmark: ServerBookmark = {
      id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newServerName.trim(),
      address: newServerAddress.trim(),
      motd: null,
      onlinePlayers: null,
      maxPlayers: null,
      pingMs: null,
      versionRequired: null,
      status: 'checking',
    };

    onAddServer(newBookmark);
    setNewServerName('');
    setNewServerAddress('');
    setIsAddOpen(false);
    await pingServer(newBookmark);
  };

  const renderInstanceIcon = (iconName?: string) => {
    if (!iconName) return <DiamondSwordIcon className="w-4 h-4 text-emerald-400" />;
    if (iconName.startsWith('data:') || iconName.startsWith('http')) {
      return <img src={iconName} alt="icon" className="w-4 h-4 rounded object-cover" />;
    }
    switch (iconName) {
      case 'crafting_table':
        return <CraftingTableIcon className="w-4 h-4 text-emerald-400" />;
      case 'grass_block':
        return <GrassBlockIcon className="w-4 h-4 text-emerald-400" />;
      case 'pickaxe':
        return <PickaxeIcon className="w-4 h-4 text-emerald-400" />;
      case 'ender_eye':
        return <EnderEyeIcon className="w-4 h-4 text-emerald-400" />;
      default:
        return <DiamondSwordIcon className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-2xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
            <Globe className="w-6 h-6 text-emerald-400" />
            Multiplayer Server Reachability
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            TCP reachability checks and Direct Connect instance selection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="btn-mc btn-mc-diamond flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white rounded cursor-pointer font-display shadow-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Ping</span>
          </button>

          <button
            onClick={() => {
              playMinecraftClickSound();
              setIsAddOpen(true);
            }}
            className="btn-mc btn-mc-green flex items-center gap-1.5 px-4 py-2 text-white font-black text-xs rounded cursor-pointer font-display shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Add Server</span>
          </button>
        </div>
      </div>

      {/* Boot Instance Management Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-black/80 via-[#101726] to-[#080b11] border border-white/10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--mc-accent)] font-black flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multiplayer Direct Connect Boot Target</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              (How launcher chooses the instance for multiplayer)
            </span>
          </div>

          <div className="flex items-center gap-3 pt-0.5 min-w-0">
            <div className="p-2 rounded-xl bg-black/60 border border-white/10 shrink-0 shadow-sm">
              {renderInstanceIcon(currentBootInstance?.icon)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-white font-display truncate">
                {currentBootInstance?.name || 'No Instance Selected'}
              </div>
              <div className="text-xs text-slate-300 font-mono truncate">
                {currentBootInstance
                  ? `Minecraft ${currentBootInstance.gameVersion} • ${currentBootInstance.loader.toUpperCase()} • ${currentBootInstance.mods.length} mods loaded • ${currentBootInstance.javaConfig.maxMemoryMb} MB RAM`
                  : 'No instance selected'}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-mono leading-relaxed pt-1 break-words">
            <strong>How it works:</strong> Clicking <strong>Direct Connect</strong> launches this instance with its installed mods and JVM memory, using Minecraft Quick Play to join the server directly without opening the multiplayer menu. Quick Play requires Minecraft 1.20.5 or newer.
          </p>
        </div>

        {/* Instance Selector Dropdown + Manage Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/10 min-w-0">
          <div className="relative min-w-0">
            <select
              value={selectedBootInstanceId}
              onChange={(e) => {
                playMinecraftClickSound();
                setSelectedBootInstanceId(e.target.value);
                if (onSelectInstance) {
                  onSelectInstance(e.target.value);
                }
              }}
              className="select-mc text-xs font-mono py-2 px-3 w-full sm:max-w-[220px] truncate"
              title="Select which instance is launched when connecting to multiplayer servers"
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.loader} {inst.gameVersion})
                </option>
              ))}
            </select>
          </div>

          {onManageInstance && currentBootInstance && (
            <button
              type="button"
              onClick={() => {
                playMinecraftClickSound();
                onManageInstance(currentBootInstance.id);
              }}
              className="btn-mc px-3.5 py-2 text-xs font-bold text-slate-100 rounded flex items-center justify-center gap-1.5 cursor-pointer font-display shadow-md hover:text-white shrink-0"
              title="Configure mods, JVM args, and settings for this instance"
            >
              <Settings className="w-3.5 h-3.5 text-[var(--mc-accent)]" />
              <span>Manage Instance</span>
            </button>
          )}
        </div>
      </div>


      {/* Servers List Grid */}
      <div className="space-y-4">
        {servers.map((server) => {
          const pingGood = server.pingMs !== null && server.pingMs < 50;
          const pingMedium = server.pingMs !== null && server.pingMs >= 50 && server.pingMs < 100;
          const isVersionCompatible = currentBootInstance && server.versionRequired
            ? server.versionRequired.includes(currentBootInstance.gameVersion)
            : null;

          return (
            <div
              key={server.id}
              className="card-obsidian p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all group hover:border-white/20 shadow-lg min-w-0 overflow-hidden"
            >
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center shrink-0 shadow-inner text-[var(--mc-accent)]">
                  <GrassBlockIcon className="w-6 h-6" />
                </div>

                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <h3 className="text-base font-black text-white font-display tracking-tight truncate max-w-[220px] sm:max-w-xs">
                      {server.name}
                    </h3>
                    <span className="text-[11px] font-mono font-bold text-[var(--mc-accent)] bg-[var(--mc-badge-bg)] px-2 py-0.5 rounded border border-[var(--mc-accent)]/20 truncate max-w-[200px]">
                      {server.address}
                    </span>
                    {isVersionCompatible === true ? (
                      <span className="text-[10px] font-mono font-bold text-[var(--mc-accent)] bg-[var(--mc-badge-bg)] px-1.5 py-0.2 rounded border border-[var(--mc-accent)]/20 shrink-0">
                        ✓ Version Compatible
                      </span>
                    ) : isVersionCompatible === false ? (
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 shrink-0">
                        Req {server.versionRequired}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-500">Version not reported</span>
                    )}
                  </div>

                  <div className="text-xs font-mono bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5 break-words overflow-hidden max-w-full">
                    {server.motd
                      ? renderMinecraftMotd(server.motd)
                      : server.error ?? (server.status === 'online'
                        ? 'TCP port reachable; Minecraft status metadata is unavailable.'
                        : server.status === 'offline'
                          ? 'TCP port is unreachable.'
                          : `Status: ${server.status}`)}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400 pt-0.5 min-w-0">
                    <span className="truncate">
                      Players:{' '}
                      {server.onlinePlayers !== null && server.maxPlayers !== null
                        ? <><strong className="text-slate-200">{server.onlinePlayers.toLocaleString()}</strong> / {server.maxPlayers.toLocaleString()}</>
                        : 'Not reported'}
                    </span>
                    <span>•</span>
                    <span className="truncate">Version: {server.versionRequired ?? 'Not reported'}</span>
                    <span>•</span>
                    <span className="text-slate-300 truncate max-w-[280px]">
                      Boots with: <strong className="text-[var(--mc-accent)]">{currentBootInstance?.name}</strong> ({currentBootInstance?.gameVersion})
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side: Ping & Aesthetic Action Buttons */}
              <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-between md:justify-end pt-3 md:pt-0 border-t md:border-t-0 border-white/5">
                <div className="text-right shrink-0">
                  <div className="flex items-center justify-end gap-1.5 text-xs font-mono font-bold">
                    <Signal
                      className={`w-3.5 h-3.5 ${
                        pingGood ? 'text-[var(--mc-accent)]' : pingMedium ? 'text-amber-400' : 'text-red-400'
                      }`}
                    />
                    <span
                      className={
                        pingGood ? 'text-[var(--mc-accent)]' : pingMedium ? 'text-amber-400' : 'text-red-400'
                      }
                    >
                      {server.pingMs === null ? server.status : `${server.pingMs} ms`}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">TCP Connect Time</div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      playMinecraftClickSound();
                      onDeleteServer(server.id);
                    }}
                    className="btn-mc btn-mc-red p-2 rounded cursor-pointer"
                    title="Remove Server Bookmark"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {onManageInstance && currentBootInstance && (
                    <button
                      onClick={() => {
                        playMinecraftClickSound();
                        onManageInstance(currentBootInstance.id);
                      }}
                      className="btn-mc px-3 py-2 text-xs font-bold text-slate-100 hover:text-white rounded cursor-pointer font-display flex items-center gap-1.5 shadow-sm"
                      title={`Manage ${currentBootInstance.name} (mods, JVM memory, resolution)`}
                    >
                      <Settings className="w-3.5 h-3.5 text-[var(--mc-accent)]" />
                      <span>Manage</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      playMinecraftLevelUpSound();
                      onLaunchWithServer(server.address, currentBootInstance?.id);
                    }}
                    disabled={!currentBootInstance}
                    className="btn-mc btn-mc-green flex items-center gap-2 px-5 py-2 text-white font-black text-xs rounded cursor-pointer font-display shadow-lg shrink-0 disabled:opacity-40"
                    title={`Direct Connect with ${currentBootInstance?.name}`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Direct Connect</span>
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Add Server Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="card-obsidian border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#0a0d14]">
              <h3 className="text-sm font-black text-white font-display flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Add Multiplayer Server</span>
              </h3>
              <button
                onClick={() => {
                  playMinecraftClickSound();
                  setIsAddOpen(false);
                }}
                className="text-slate-500 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateServer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 font-display mb-1">
                  Server Name
                </label>
                <input
                  type="text"
                  required
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="e.g. Hypixel Network, 2b2t, Friends SMP"
                  className="w-full px-3 py-2 text-xs bg-black/50 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 font-display mb-1">
                  Server IP or Domain Address
                </label>
                <input
                  type="text"
                  required
                  value={newServerAddress}
                  onChange={(e) => setNewServerAddress(e.target.value)}
                  placeholder="e.g. mc.hypixel.net or play.server.com:25565"
                  className="w-full px-3 py-2 text-xs bg-black/50 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-black/30 rounded-xl border border-white/5 text-[11px] font-mono text-slate-400">
                Direct connect will launch with: <strong className="text-emerald-400">{currentBootInstance?.name}</strong> (MC {currentBootInstance?.gameVersion})
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="btn-mc px-4 py-2 text-xs font-bold text-slate-300 rounded cursor-pointer font-display"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-mc btn-mc-green flex items-center gap-1.5 px-5 py-2 text-white font-black text-xs rounded cursor-pointer font-display"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Bookmark</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
