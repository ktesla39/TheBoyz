import React, { useState } from 'react';
import {
  Plus,
  Play,
  Copy,
  Trash2,
  Puzzle,
  Search,
  Check,
  Monitor,
  FolderInput,
  LoaderCircle,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { MinecraftInstance, ModLoaderType } from '../../types/instance';
import { CreateInstanceModal } from './CreateInstanceModal';
import { DesktopShortcutModal } from '../common/DesktopShortcutModal';
import {
  DiamondSwordIcon,
  GrassBlockIcon,
  RamChipIcon,
  OpenGlApiIcon,
  VulkanApiIcon,
} from '../icons/MinecraftIcons';

interface InstancesViewProps {
  instances: MinecraftInstance[];
  activeInstanceId: string;
  onSelectActiveInstance: (id: string) => void;
  onAddInstance: (instance: MinecraftInstance) => void;
  onDeleteInstance: (id: string) => void;
  onCloneInstance: (id: string) => void;
  onLaunchInstance: (id: string) => void;
  onImportInstance: (sourcePath: string) => Promise<void>;
  onManageMods: (instance: MinecraftInstance) => void;
  onOpenDetail: (instance: MinecraftInstance) => void;
}

export const InstancesView: React.FC<InstancesViewProps> = ({
  instances,
  activeInstanceId,
  onSelectActiveInstance,
  onAddInstance,
  onDeleteInstance,
  onCloneInstance,
  onLaunchInstance,
  onImportInstance,
  onManageMods,
  onOpenDetail,
}) => {
  const [search, setSearch] = useState('');
  const [filterLoader, setFilterLoader] = useState<ModLoaderType | 'all'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [shortcutInstance, setShortcutInstance] = useState<MinecraftInstance | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleImportInstance = async () => {
    setImportError(null);
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select a Minecraft instance or game directory',
      });
      if (!selectedPath || Array.isArray(selectedPath)) return;
      setIsImporting(true);
      await onImportInstance(selectedPath);
    } catch (reason) {
      setImportError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsImporting(false);
    }
  };

  const filteredInstances = instances.filter((inst) => {
    const matchesSearch =
      inst.name.toLowerCase().includes(search.toLowerCase()) ||
      inst.gameVersion.includes(search);
    const matchesLoader = filterLoader === 'all' || inst.loader === filterLoader;
    return matchesSearch && matchesLoader;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 select-none">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
            <DiamondSwordIcon className="w-5 h-5" />
            Minecraft Instance Manager
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure isolated directories, mods, and Java arguments for each installation.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleImportInstance()}
            disabled={isImporting}
            className="btn-mc flex items-center gap-2 px-4 py-2 text-white font-black text-xs rounded-lg cursor-pointer font-display disabled:opacity-50"
            title="Copy mods, saves, configurations, and game options from SKLauncher or another launcher"
          >
            {isImporting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <FolderInput className="w-4 h-4" />}
            <span>{isImporting ? 'Importing…' : 'Import Instance'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="btn-mc btn-mc-green flex items-center gap-2 px-4 py-2 text-white font-black text-xs rounded-lg cursor-pointer font-display"
          >
            <Plus className="w-4 h-4" />
            <span>New Instance</span>
          </button>
        </div>
      </div>
      {importError && (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          {importError}
        </div>
      )}
      <p className="text-[11px] text-slate-400 font-mono">
        Imports copy your saves, mods, configs, resource packs, shaders, and server settings. The source folder is never changed. For SKLauncher 4, select the profile&apos;s Game Directory.
      </p>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search instances..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#0e131f] border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        {/* Loader filters */}
        <div className="flex items-center gap-1.5 p-1 bg-black/40 border border-white/10 rounded-lg text-xs overflow-x-auto w-full sm:w-auto">
          {(['all', 'vanilla', 'fabric', 'forge', 'neoforge', 'quilt'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setFilterLoader(l)}
              className={`btn-mc px-3 py-1 rounded text-xs font-bold font-mono uppercase transition-all cursor-pointer ${
                filterLoader === l
                  ? 'btn-mc-green text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>


      {/* Instances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredInstances.map((inst) => {
          const isActive = inst.id === activeInstanceId;
          const activeModsCount = inst.mods.filter((m) => m.enabled).length;

          return (
            <div
              key={inst.id}
              onClick={() => onSelectActiveInstance(inst.id)}
              data-tone={inst.loader === 'fabric' ? 'ice' : inst.loader === 'quilt' ? 'violet' : inst.loader === 'forge' || inst.loader === 'neoforge' ? 'amber' : 'green'}
              className={`card-obsidian card-selectable min-w-0 overflow-hidden p-5 rounded-xl flex flex-col justify-between gap-4 transition-all cursor-pointer ${isActive ? 'card-selected' : ''}`}
            >
              {/* Top Details */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="card-icon-tile w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
                      <GrassBlockIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-black text-white font-display tracking-tight truncate max-w-[170px] sm:max-w-[210px]">
                        {inst.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs font-mono text-[var(--mc-accent)] mt-0.5 truncate">
                        <span className="font-semibold">MC {inst.gameVersion}</span>
                        <span className="text-slate-600">·</span>
                        <span className="uppercase text-slate-300">{inst.loader}</span>
                      </div>
                    </div>
                  </div>

                  {isActive ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-[var(--mc-badge-bg)] text-[var(--mc-badge-text)] border border-[var(--mc-accent)]/40 font-mono shrink-0">
                      <Check className="w-3 h-3" />
                      ACTIVE
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectActiveInstance(inst.id);
                      }}
                      className="btn-mc btn-mc-diamond text-[10px] font-bold font-display text-white px-2.5 py-1 rounded cursor-pointer shrink-0 shadow-sm"
                    >
                      Select
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2.5 px-3 rounded-lg card-inset text-[10px] font-mono text-slate-400 min-w-0">
                  <div className="truncate">
                    <div className="uppercase text-slate-400 text-[9px]">RAM Limit</div>
                    <div className="text-slate-200 font-bold mt-0.5 truncate">{inst.javaConfig.maxMemoryMb} MB</div>
                  </div>
                  <div className="truncate">
                    <div className="uppercase text-slate-400 text-[9px]">Graphics</div>
                    <div className="text-slate-200 font-bold mt-0.5 uppercase truncate">{inst.graphicsApi}</div>
                  </div>
                  <div className="truncate">
                    <div className="uppercase text-slate-400 text-[9px]">Active Mods</div>
                    <div className="text-slate-200 font-bold mt-0.5 truncate">{activeModsCount} enabled</div>
                  </div>
                  <div className="truncate">
                    <div className="uppercase text-slate-400 text-[9px]">Time to Start</div>
                    <div
                      className="text-slate-200 font-bold mt-0.5 truncate"
                      title="Measured until the Minecraft Java process starts; world loading continues afterward."
                    >
                      {inst.lastLaunchDurationMs === undefined
                        ? 'Not launched'
                        : `${(inst.lastLaunchDurationMs / 1000).toFixed(1)} sec`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShortcutInstance(inst);
                    }}
                    className="btn-mc p-1.5 rounded text-slate-300 hover:text-cyan-300 cursor-pointer"
                    title="Create Desktop Shortcut"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onManageMods(inst);
                    }}
                    className="btn-mc p-1.5 rounded text-slate-300 hover:text-white cursor-pointer"
                    title="Addons & Mods Inventory"
                  >
                    <Puzzle className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloneInstance(inst.id);
                    }}
                    className="btn-mc p-1.5 rounded text-slate-300 hover:text-white cursor-pointer"
                    title="Clone Instance"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {instances.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteInstance(inst.id);
                      }}
                      className="btn-mc btn-mc-red p-1.5 rounded text-white cursor-pointer"
                      title="Delete Instance"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetail(inst);
                    }}
                    className="btn-mc px-2 py-1.5 text-xs font-bold text-slate-200 hover:text-white rounded cursor-pointer font-display"
                  >
                    Manage
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLaunchInstance(inst.id);
                    }}
                    className="btn-mc btn-mc-green flex items-center gap-1 px-2 py-1.5 text-white font-black text-xs rounded cursor-pointer font-display shadow-md"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Launch</span>
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      <CreateInstanceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onInstanceCreated={(inst) => {
          onAddInstance(inst);
          onSelectActiveInstance(inst.id);
        }}
      />

      {shortcutInstance && (
        <DesktopShortcutModal
          isOpen={Boolean(shortcutInstance)}
          onClose={() => setShortcutInstance(null)}
          instance={shortcutInstance}
        />
      )}
    </div>
  );
};
