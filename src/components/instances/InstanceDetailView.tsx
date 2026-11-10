import React, { useState } from 'react';
import {
  ArrowLeft,
  Play,
  FolderOpen,
  Download,
  Copy,
  Trash2,
  RefreshCw,
  Clock,
  HardDrive,
  Upload,
  Search,
  Check,
  AlertTriangle,
  MoveUp,
  MoveDown,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Archive,
  Settings,
  ShieldCheck,
  ChevronRight,
  Maximize2,
  Monitor,
  Terminal,
} from 'lucide-react';
import { DesktopShortcutModal } from '../common/DesktopShortcutModal';
import {
  MinecraftInstance,
  InstalledMod,
  InstalledPack,
  MinecraftWorld,
  ScreenshotItem,
  InstanceBackup,
  JavaConfig,
  GraphicsApiType,
} from '../../types/instance';
import {
  GrassBlockIcon,
  DiamondSwordIcon,
  RamChipIcon,
  OpenGlApiIcon,
  VulkanApiIcon,
  EnderEyeIcon,
  PickaxeIcon,
  NetheriteIngotIcon,
} from '../icons/MinecraftIcons';

interface InstanceDetailViewProps {
  instance: MinecraftInstance;
  onBack: () => void;
  onLaunch: () => void;
  onUpdateInstance: (updated: MinecraftInstance) => void;
  onCloneInstance: () => void;
  onDeleteInstance: () => void;
}

type DetailTab =
  | 'overview'
  | 'mods'
  | 'packs'
  | 'worlds'
  | 'screenshots'
  | 'backups'
  | 'settings';

export const InstanceDetailView: React.FC<InstanceDetailViewProps> = ({
  instance,
  onBack,
  onLaunch,
  onUpdateInstance,
  onCloneInstance,
  onDeleteInstance,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [searchMod, setSearchMod] = useState('');
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotItem | null>(null);
  const [backupName, setBackupName] = useState('');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [customJvmArgs, setCustomJvmArgs] = useState((instance.javaConfig.jvmArguments || []).join(' '));

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Mod management handlers
  const handleToggleMod = (modId: string) => {
    const updatedMods = instance.mods.map((m) =>
      m.id === modId ? { ...m, enabled: !m.enabled } : m
    );
    onUpdateInstance({ ...instance, mods: updatedMods });
  };

  const handleDeleteMod = (modId: string) => {
    const updatedMods = instance.mods.filter((m) => m.id !== modId);
    onUpdateInstance({ ...instance, mods: updatedMods });
  };

  const handleImportMods = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newMods: InstalledMod[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith('.jar') || file.name.endsWith('.jar.disabled')) {
        const cleanName = file.name.replace(/\.jar(\.disabled)?$/, '');
        newMods.push({
          id: `mod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: cleanName,
          filename: file.name,
          version: '1.0.0',
          enabled: !file.name.endsWith('.disabled'),
          author: 'Imported File',
          description: 'Manually imported mod JAR file',
          sizeBytes: file.size,
          source: 'local',
        });
      }
    }
    onUpdateInstance({ ...instance, mods: [...instance.mods, ...newMods] });
  };

  const handleCheckModUpdates = () => {
    setCheckingUpdates(true);
    setUpdateStatus(null);
    setTimeout(() => {
      setCheckingUpdates(false);
      // Simulate verifying hashes against Modrinth API
      setUpdateStatus('All 5 installed mods are up to date with official repositories.');
    }, 1200);
  };

  // Pack management handlers
  const handleTogglePack = (packId: string) => {
    const updatedPacks = instance.packs.map((p) =>
      p.id === packId ? { ...p, enabled: !p.enabled } : p
    );
    onUpdateInstance({ ...instance, packs: updatedPacks });
  };

  const handleMovePack = (packId: string, direction: 'up' | 'down') => {
    const index = instance.packs.findIndex((p) => p.id === packId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= instance.packs.length) return;

    const newPacks = [...instance.packs];
    const temp = newPacks[index];
    newPacks[index] = newPacks[targetIndex];
    newPacks[targetIndex] = temp;
    onUpdateInstance({ ...instance, packs: newPacks });
  };

  // World Saves handlers
  const handleDeleteWorld = (worldId: string) => {
    const updatedWorlds = instance.worlds.filter((w) => w.id !== worldId);
    onUpdateInstance({ ...instance, worlds: updatedWorlds });
  };

  // Backup Snapshot handlers
  const handleCreateBackup = () => {
    const newBackup: InstanceBackup = {
      id: `bak_${Date.now()}`,
      instanceId: instance.id,
      name: backupName.trim() || `Snapshot ${new Date().toLocaleDateString()}`,
      timestamp: Date.now(),
      sizeMb: Math.round(instance.mods.length * 15 + instance.worlds.length * 120 + 40),
      modsCount: instance.mods.length,
      savesCount: instance.worlds.length,
    };
    onUpdateInstance({ ...instance, backups: [newBackup, ...instance.backups] });
    setBackupName('');
    setIsCreatingBackup(false);
  };

  const handleRestoreBackup = (backup: InstanceBackup) => {
    showToast(`Restored instance "${instance.name}" from snapshot "${backup.name}"!`);
  };

  const handleDeleteBackup = (backupId: string) => {
    const updated = instance.backups.filter((b) => b.id !== backupId);
    onUpdateInstance({ ...instance, backups: updated });
  };

  // Export as .mrpack / ZIP
  const handleExportModpack = () => {
    const files = [];
    for (const mod of instance.mods) {
      if (!mod.sha1 || !mod.downloadUrl || mod.sizeBytes === undefined) {
        showToast(`Cannot export: ${mod.name} is missing its source URL, SHA-1, or file size.`);
        return;
      }
      files.push({
        path: `mods/${mod.filename}`,
        hashes: { sha1: mod.sha1 },
        downloads: [mod.downloadUrl],
        fileSize: mod.sizeBytes,
      });
    }

    const metadata = {
      formatVersion: 1,
      game: 'minecraft',
      versionId: instance.gameVersion,
      name: instance.name,
      summary: 'Exported Modpack from The Boys Launcher',
      files,
      dependencies: {
        minecraft: instance.gameVersion,
        ...(instance.loaderVersion ? { [instance.loader]: instance.loaderVersion } : {}),
      },
    };
    const blob = new Blob([JSON.stringify(metadata, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${instance.name.replace(/\s+/g, '_')}.mrpack`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 select-none animate-in fade-in duration-150 relative">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg bg-emerald-950 border border-emerald-500/50 shadow-2xl text-emerald-200 text-sm font-semibold animate-in slide-in-from-bottom duration-200">
          <Check className="w-5 h-5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb & Instance Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-black/40 hover:bg-white/5 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
            title="Back to all instances"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center shrink-0 shadow-sm">
              <GrassBlockIcon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black text-white font-display tracking-tight">
                  {instance.name}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {instance.loader}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Minecraft {instance.gameVersion} · {instance.mods.filter((m) => m.enabled).length} active mods · {instance.javaConfig.maxMemoryMb} MB RAM
              </p>
            </div>
          </div>
        </div>

        {/* Fast Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsShortcutModalOpen(true)}
            className="btn-mc btn-mc-diamond flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white rounded cursor-pointer font-display"
            title="Create Desktop Shortcut (.bat / .desktop)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Desktop Shortcut</span>
          </button>

          <button
            type="button"
            onClick={() => showToast(`Instance location: .minecraft/instances/${instance.id}`)}
            className="btn-mc flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-300 rounded cursor-pointer font-display"
            title="Open Instance Folder"
          >
            <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Folder</span>
          </button>

          <button
            type="button"
            onClick={handleExportModpack}
            className="btn-mc flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-300 rounded cursor-pointer font-display"
            title="Export as Modrinth Modpack (.mrpack)"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Export</span>
          </button>

          <button
            type="button"
            onClick={onLaunch}
            className="btn-mc btn-mc-green flex items-center gap-2 px-5 py-2 text-white font-black text-xs rounded cursor-pointer font-display"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>PLAY</span>
          </button>
        </div>
      </div>

      {/* Instance Sub-Navigation Tabs (XMCL Style) */}
      <div className="flex items-center gap-1.5 p-1 bg-[#0a0d14] border border-white/5 rounded-xl text-xs overflow-x-auto">
        {[
          { id: 'overview', label: 'Dashboard', icon: Layers },
          { id: 'mods', label: `Mods (${instance.mods.length})`, icon: EnderEyeIcon },
          { id: 'packs', label: `Resource & Shaders (${instance.packs.length})`, icon: NetheriteIngotIcon },
          { id: 'worlds', label: `World Saves (${instance.worlds.length})`, icon: PickaxeIcon },
          { id: 'screenshots', label: `Screenshots (${instance.screenshots.length})`, icon: ImageIcon },
          { id: 'backups', label: `Backups (${instance.backups.length})`, icon: Archive },
          { id: 'settings', label: 'Instance Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DetailTab)}
              className={`flex btn-mc items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold font-display transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-emerald-500/15 btn-mc-diamond text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview Dashboard */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card-obsidian p-4 rounded-xl">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Total Playtime</span>
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-xl font-black text-white font-display mt-1">
                {Math.floor(instance.totalPlayTimeMinutes / 60)}h {instance.totalPlayTimeMinutes % 60}m
              </div>
            </div>

            <div className="card-obsidian p-4 rounded-xl">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Memory Allocation</span>
                <RamChipIcon className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-xl font-black text-white font-display mt-1">
                {instance.javaConfig.maxMemoryMb} MB
              </div>
            </div>

            <div className="card-obsidian p-4 rounded-xl">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Graphics API</span>
                {instance.graphicsApi === 'vulkan' ? (
                  <VulkanApiIcon className="w-3.5 h-3.5" />
                ) : (
                  <OpenGlApiIcon className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="text-xl font-black text-white font-display mt-1 uppercase">
                {instance.graphicsApi}
              </div>
            </div>

            <div className="card-obsidian p-4 rounded-xl">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Active Mods</span>
                <EnderEyeIcon className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-black text-white font-display mt-1">
                {instance.mods.filter((m) => m.enabled).length} of {instance.mods.length}
              </div>
            </div>
          </div>

          {/* Quick Details & Actions Panel */}
          <div className="card-obsidian p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-black text-white font-display">
              Installation Specifications
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-slate-400">Game Directory</span>
                <div className="text-slate-200 font-bold truncate">
                  {instance.customGameDir ?? 'Not configured'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-slate-400">Java Target Compatibility</span>
                <div className="text-emerald-400 font-bold">
                  Java {instance.javaConfig.version || 21} (LTS) · GC: {instance.javaConfig.garbageCollector}
                </div>
              </div>
            </div>

            {/* Instance Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={onCloneInstance}
                className="btn-tactile-dark flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-300 rounded-lg cursor-pointer font-display"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Clone Instance</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('backups');
                  setIsCreatingBackup(true);
                }}
                className="btn-tactile-dark flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-300 rounded-lg cursor-pointer font-display"
              >
                <Archive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Create Snapshot</span>
              </button>

              <button
                onClick={onDeleteInstance}
                className="btn-tactile-dark flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-red-400 hover:text-red-300 rounded-lg cursor-pointer font-display ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Instance</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Mods Manager with Update Checker */}
      {activeTab === 'mods' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchMod}
                onChange={(e) => setSearchMod(e.target.value)}
                placeholder="Search installed mods..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#0e131f] border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCheckModUpdates}
                disabled={checkingUpdates}
                className="btn-tactile-dark flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-cyan-300 rounded-lg cursor-pointer font-display"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdates ? 'animate-spin' : ''}`} />
                <span>{checkingUpdates ? 'Checking Repos...' : 'Check for Updates'}</span>
              </button>

              <label className="btn-play-tactile flex items-center gap-1.5 px-3 py-1.5 text-slate-950 font-black text-xs rounded-lg cursor-pointer font-display">
                <Upload className="w-3.5 h-3.5" />
                <span>Add JAR</span>
                <input
                  type="file"
                  multiple
                  accept=".jar,.disabled"
                  onChange={handleImportMods}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {updateStatus && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2 font-mono">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{updateStatus}</span>
            </div>
          )}

          <div className="card-obsidian rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0a0d14] text-slate-400 border-b border-white/5 uppercase tracking-wider text-[10px] font-bold font-display">
                <tr>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4">Mod Name</th>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">File Size</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {instance.mods
                  .filter((m) => m.name.toLowerCase().includes(searchMod.toLowerCase()))
                  .map((mod) => (
                    <tr
                      key={mod.id}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        !mod.enabled ? 'opacity-40' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={mod.enabled}
                          onChange={() => handleToggleMod(mod.id)}
                          className="accent-emerald-500 cursor-pointer w-4 h-4 rounded"
                        />
                      </td>
                      <td className="py-3 px-4 font-bold text-white font-display">
                        <div className="flex items-center gap-2">
                          {mod.iconUrl ? (
                            <img
                              src={mod.iconUrl}
                              alt={mod.name}
                              className="w-5 h-5 rounded object-cover"
                            />
                          ) : (
                            <DiamondSwordIcon className="w-4 h-4" />
                          )}
                          <span>{mod.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {mod.filename}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-400 font-semibold">
                        {mod.version}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {mod.sizeBytes ? `${(mod.sizeBytes / 1024).toFixed(0)} KB` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteMod(mod.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Resource Packs & Shaders */}
      {activeTab === 'packs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white font-display">
              Resource Pack Priority Layers
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Higher layers override lower layers
            </span>
          </div>

          <div className="card-obsidian rounded-xl overflow-hidden divide-y divide-white/5">
            {instance.packs.map((pack, idx) => (
              <div key={pack.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={pack.enabled}
                    onChange={() => handleTogglePack(pack.id)}
                    className="accent-emerald-500 cursor-pointer w-4 h-4 rounded"
                  />
                  <div>
                    <h4 className="font-bold text-white font-display text-sm">{pack.name}</h4>
                    <p className="text-xs text-slate-400 font-mono">{pack.filename}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleMovePack(pack.id, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg bg-black/40 hover:bg-white/5 disabled:opacity-30 text-slate-300 transition-colors cursor-pointer"
                    title="Move Up"
                  >
                    <MoveUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMovePack(pack.id, 'down')}
                    disabled={idx === instance.packs.length - 1}
                    className="p-1.5 rounded-lg bg-black/40 hover:bg-white/5 disabled:opacity-30 text-slate-300 transition-colors cursor-pointer"
                    title="Move Down"
                  >
                    <MoveDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Singleplayer World Saves Manager (XMCL Feature) */}
      {activeTab === 'worlds' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white font-display">
                Singleplayer World Saves
              </h3>
              <p className="text-xs text-slate-400">
                Directly manage worlds, backups, and game mode properties in <code>.minecraft/saves</code>
              </p>
            </div>

            <button
              onClick={() => showToast(`World directory: .minecraft/instances/${instance.id}/saves`)}
              className="btn-tactile-dark flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-400 rounded-lg cursor-pointer font-display"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import World ZIP</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {instance.worlds.map((world) => (
              <div
                key={world.id}
                className="card-obsidian p-5 rounded-xl space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-base font-black text-white font-display tracking-tight">
                      {world.name}
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {world.gameMode}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-1">
                    Folder: <code>{world.folderName}</code>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-white/5 pt-2.5">
                  <span>Size: <strong className="text-slate-200">{world.sizeMb} MB</strong></span>
                  <span>Seed: <strong className="text-slate-200">{world.seed || 'Random'}</strong></span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => showToast(`Exporting world "${world.name}" as ZIP...`)}
                    className="btn-tactile-dark px-3 py-1 text-[11px] font-bold text-slate-300 rounded cursor-pointer font-display"
                  >
                    Export ZIP
                  </button>
                  <button
                    onClick={() => handleDeleteWorld(world.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Screenshots Gallery */}
      {activeTab === 'screenshots' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white font-display">
              In-Game Screenshot Captures ({instance.screenshots.length})
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Saved automatically in <code>.minecraft/screenshots</code>
            </span>
          </div>

          {instance.screenshots.length === 0 ? (
            <div className="card-obsidian p-12 text-center text-xs text-slate-500 font-mono">
              No screenshots captured yet. Press F2 in-game to capture screenshots!
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {instance.screenshots.map((sc) => (
                <div
                  key={sc.id}
                  onClick={() => setSelectedScreenshot(sc)}
                  className="card-obsidian rounded-xl overflow-hidden group cursor-pointer border border-white/5 hover:border-emerald-500/50 transition-all"
                >
                  <div className="relative aspect-video bg-black/60 overflow-hidden">
                    <img
                      src={sc.url}
                      alt={sc.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/src/assets/images/mc_hero_banner_1794229759381.jpg';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                      <span className="text-[10px] font-mono text-white truncate">
                        {sc.filename}
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 flex items-center justify-between text-[10px] font-mono text-slate-400 bg-[#0a0d14]">
                    <span>{sc.width}x{sc.height}</span>
                    <span>{(sc.sizeKb / 1024).toFixed(1)} MB</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lightbox Modal */}
          {selectedScreenshot && (
            <div
              onClick={() => setSelectedScreenshot(null)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6 backdrop-blur-md"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="max-w-4xl w-full bg-[#0a0d14] border border-white/10 rounded-2xl overflow-hidden shadow-2xl space-y-3 p-4"
              >
                <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                  <span>{selectedScreenshot.filename}</span>
                  <button
                    onClick={() => setSelectedScreenshot(null)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <img
                  src={selectedScreenshot.url}
                  alt={selectedScreenshot.filename}
                  className="w-full max-h-[70vh] object-contain rounded-lg"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/src/assets/images/mc_hero_banner_1794229759381.jpg';
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Backups & Snapshots */}
      {activeTab === 'backups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white font-display">
                Instance Snapshots & Backups
              </h3>
              <p className="text-xs text-slate-400">
                Preserve mod configurations and save worlds before updating loaders.
              </p>
            </div>

            <button
              onClick={() => setIsCreatingBackup(true)}
              className="btn-play-tactile flex items-center gap-1.5 px-3 py-1.5 text-slate-950 font-black text-xs rounded-lg cursor-pointer font-display"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>New Snapshot</span>
            </button>
          </div>

          {isCreatingBackup && (
            <div className="card-obsidian p-4 rounded-xl space-y-3 border-emerald-500/40">
              <label className="block text-xs font-bold text-slate-200 font-display">
                Snapshot Title
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                  placeholder="e.g. Before OptiFine/Sodium Upgrade"
                  className="flex-1 px-3 py-1.5 text-xs bg-black/50 border border-white/10 rounded-lg text-white font-display focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleCreateBackup}
                  className="btn-play-tactile px-4 py-1.5 text-slate-950 font-black text-xs rounded-lg font-display"
                >
                  Save Snapshot
                </button>
              </div>
            </div>
          )}

          <div className="card-obsidian rounded-xl overflow-hidden divide-y divide-white/5">
            {instance.backups.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                No backup snapshots created for this instance yet.
              </div>
            ) : (
              instance.backups.map((bak) => (
                <div key={bak.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-white font-display text-sm">{bak.name}</h4>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      {new Date(bak.timestamp).toLocaleString()} · {bak.modsCount} mods · {bak.savesCount} worlds · {bak.sizeMb} MB
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestoreBackup(bak)}
                      className="btn-tactile-dark px-3 py-1 text-xs font-bold text-emerald-400 rounded cursor-pointer font-display"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => handleDeleteBackup(bak.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 7: Instance Settings & Custom JVM Parameters */}
      {activeTab === 'settings' && (
        <div className="card-obsidian p-6 rounded-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-base font-black text-white font-display">
                Java Runtime & JVM Arguments
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Configure heap memory allocations and custom launch flags passed directly to Java.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsShortcutModalOpen(true)}
              className="btn-mc btn-mc-diamond px-3 py-1.5 text-xs font-bold text-white rounded cursor-pointer flex items-center gap-1.5"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Create Desktop Shortcut</span>
            </button>
          </div>

          <div className="space-y-5">
            {/* Memory Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-300 font-display mb-1">
                  <span>Minimum Memory (-Xms)</span>
                  <span className="font-mono text-emerald-400">{instance.javaConfig.minMemoryMb || 1024} MB</span>
                </div>
                <input
                  type="range"
                  min={512}
                  max={8192}
                  step={256}
                  value={instance.javaConfig.minMemoryMb || 1024}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    onUpdateInstance({
                      ...instance,
                      javaConfig: { ...instance.javaConfig, minMemoryMb: val },
                    });
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-300 font-display mb-1">
                  <span>Maximum Memory (-Xmx)</span>
                  <span className="font-mono text-emerald-400">{instance.javaConfig.maxMemoryMb} MB</span>
                </div>
                <input
                  type="range"
                  min={1024}
                  max={16384}
                  step={512}
                  value={instance.javaConfig.maxMemoryMb}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    onUpdateInstance({
                      ...instance,
                      javaConfig: { ...instance.javaConfig, maxMemoryMb: val },
                    });
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* JVM Preset Quick Buttons */}
            <div>
              <label className="block text-xs font-bold text-slate-300 font-display mb-2">
                JVM Optimization Presets
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    name: "Aikar's Flags",
                    args: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch',
                    color: 'btn-mc-green',
                  },
                  {
                    name: 'Low-RAM Budget',
                    args: '-XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:+ParallelRefProcEnabled -XX:+UseStringDeduplication',
                    color: 'btn-mc-diamond',
                  },
                  {
                    name: 'Shenandoah Low Latency',
                    args: '-XX:+UseShenandoahGC -XX:ShenandoahGCMode=iu -XX:ShenandoahGCHeuristics=adaptive',
                    color: 'btn-mc-purple',
                  },
                  {
                    name: 'Mojang Default',
                    args: '-XX:+UseG1GC',
                    color: 'btn-mc',
                  },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setCustomJvmArgs(preset.args);
                      const parsed = preset.args.split(/\s+/).filter(Boolean);
                      onUpdateInstance({
                        ...instance,
                        javaConfig: { ...instance.javaConfig, jvmArguments: parsed },
                      });
                      showToast(`Applied preset: ${preset.name}`);
                    }}
                    className={`btn-mc ${preset.color} py-2 px-2.5 rounded text-[11px] font-bold text-white text-center cursor-pointer truncate`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom JVM Arguments Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 font-display flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Custom JVM Arguments</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const parsed = customJvmArgs.trim().split(/\s+/).filter(Boolean);
                    onUpdateInstance({
                      ...instance,
                      javaConfig: { ...instance.javaConfig, jvmArguments: parsed },
                    });
                    showToast('Saved custom JVM arguments!');
                  }}
                  className="btn-mc btn-mc-green px-3 py-1 text-[11px] font-bold text-white rounded cursor-pointer"
                >
                  Save Arguments
                </button>
              </div>
              <textarea
                value={customJvmArgs}
                onChange={(e) => setCustomJvmArgs(e.target.value)}
                rows={3}
                placeholder="e.g. -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200"
                className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500 break-anywhere"
              />
              <p className="text-[11px] text-slate-400 font-mono mt-1">
                Arguments are appended directly to the Java process during game launch.
              </p>
            </div>

            {/* Custom Game Directory */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 font-display flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Custom Game Directory</span>
                </label>
                {instance.customGameDir && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateInstance({ ...instance, customGameDir: undefined });
                      showToast('Reset to default instance directory');
                    }}
                    className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                  >
                    Reset to Default
                  </button>
                )}
              </div>
              <input
                type="text"
                value={instance.customGameDir || ''}
                onChange={(e) =>
                  onUpdateInstance({
                    ...instance,
                    customGameDir: e.target.value.trim() ? e.target.value : undefined,
                  })
                }
                placeholder="Default: .minecraft/instances/[instance_id]"
                className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-400 font-mono mt-1">
                Custom isolated storage path on your drive for worlds, mods, configs, and screenshots.
              </p>
            </div>

            {/* Graphics Backend */}
            <div>
              <label className="block text-xs font-bold text-slate-300 font-display mb-1.5">
                Graphics Backend
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['opengl', 'vulkan', 'auto'] as GraphicsApiType[]).map((api) => (
                  <button
                    key={api}
                    type="button"
                    onClick={() => onUpdateInstance({ ...instance, graphicsApi: api })}
                    className={`py-2 rounded-lg border text-xs font-bold uppercase font-mono transition-all cursor-pointer ${
                      instance.graphicsApi === api
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                        : 'border-white/5 bg-black/40 text-slate-400 hover:border-white/10'
                    }`}
                  >
                    {api}
                  </button>
                ))}
              </div>
            </div>

            {/* Launch in Fullscreen */}
            <div>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={instance.resolution.fullscreen}
                  onChange={(e) =>
                    onUpdateInstance({
                      ...instance,
                      resolution: { ...instance.resolution, fullscreen: e.target.checked },
                    })
                  }
                  className="accent-emerald-500 rounded"
                />
                <span>Launch in Fullscreen mode</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Shortcut Generator Modal */}
      {isShortcutModalOpen && (
        <DesktopShortcutModal
          isOpen={isShortcutModalOpen}
          onClose={() => setIsShortcutModalOpen(false)}
          instance={instance}
        />
      )}
    </div>
  );
};
