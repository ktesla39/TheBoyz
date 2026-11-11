import React, { useState, useEffect } from 'react';
import {
  Download,
  Sparkles,
  Layers,
  MapPin,
  Check,
  Upload,
  Play,
  Trash2,
  MoveUp,
  MoveDown,
  Search,
  FolderOpen,
  Filter,
  Package,
} from 'lucide-react';
import { MinecraftInstance } from '../../types/instance';
import { NetheriteIngotIcon, EnderEyeIcon, GrassBlockIcon, CraftingTableIcon } from '../icons/MinecraftIcons';
import { playMinecraftClickSound, playMinecraftLevelUpSound } from '../../services/soundService';
import { searchModrinth } from '../../services/modrinthApi';
import { ModrinthSearchResult } from '../../types/launcher';
import { InstallTargetModal, InstallableItem } from '../common/InstallTargetModal';
import { invokeInstallInstanceAddon, isTauriEnvironment } from '../../services/tauriBridge';

interface PacksViewProps {
  activeInstance: MinecraftInstance | null;
  instances?: MinecraftInstance[];
  onUpdateInstance?: (updated: MinecraftInstance) => void;
  onLaunchInstance?: (id: string) => void;
  onCreateInstanceForPack?: (item: any) => void;
}

type PackCategory = 'resourcepacks' | 'shaders' | 'datapacks' | 'worlds' | 'modpacks' | 'installed';

export const PacksView: React.FC<PacksViewProps> = ({
  activeInstance,
  instances = [],
  onUpdateInstance,
  onLaunchInstance,
  onCreateInstanceForPack,
}) => {
  const [subTab, setSubTab] = useState<PackCategory>('resourcepacks');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Install Target Modal State
  const [targetItem, setTargetItem] = useState<InstallableItem | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // Search Results State
  const [modrinthResults, setModrinthResults] = useState<ModrinthSearchResult[]>([]);

  // Fetch results whenever category, provider, or query changes
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const performSearch = async () => {
      setSearchError(null);
      try {
        if (subTab === 'installed') {
          setLoading(false);
          return;
        }

        const projectType =
          subTab === 'resourcepacks'
            ? 'resourcepack'
            : subTab === 'shaders'
              ? 'shader'
              : subTab === 'datapacks'
                ? 'datapack'
                : subTab === 'modpacks'
                  ? 'modpack'
                  : undefined;

        if (!projectType) {
          if (isMounted) setModrinthResults([]);
          return;
        }

        const result = await searchModrinth({ query: searchQuery, projectType });
        if (isMounted) setModrinthResults(result.hits);
      } catch (err) {
        if (isMounted) setSearchError(err instanceof Error ? err.message : String(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const timer = setTimeout(performSearch, 150);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [subTab, searchQuery]);

  const handleOpenInstallModal = (item: InstallableItem) => {
    playMinecraftClickSound();
    setTargetItem(item);
    setIsInstallModalOpen(true);
  };

  const handleConfirmInstall = async (targetInstanceId: string, item: InstallableItem) => {
    const targetInst = instances.find((instance) => instance.id === targetInstanceId);
    if (!targetInst) {
      setSearchError('Select an existing instance before installing.');
      return;
    }
    setSearchError(null);
    try {
      let finalFileName = item.filename || `${item.id}.zip`;
      if (isTauriEnvironment()) {
        const res = await invokeInstallInstanceAddon({
          instance_id: targetInst.id,
          addon_id: String(item.id),
          addon_name: item.name,
          addon_type: item.type,
          provider: (item.source as 'modrinth' | 'curseforge') || 'modrinth',
          game_version: targetInst.gameVersion,
          loader: targetInst.loader,
          file_name: item.filename,
        });
        if (res.file_name) finalFileName = res.file_name;
      }
      if (onUpdateInstance) {
        const newPack = {
          id: String(item.id),
          name: item.name,
          filename: finalFileName,
          type: item.type as 'resourcepack' | 'shader' | 'datapack',
          enabled: true,
          order: (targetInst.packs?.length || 0) + 1,
          description: item.description,
          iconUrl: item.iconUrl || undefined,
          source: item.source || 'modrinth',
        };
        onUpdateInstance({
          ...targetInst,
          packs: [...(targetInst.packs || []), newPack],
        });
      }
      playMinecraftLevelUpSound();
    } catch (err) {
      setSearchError(`Install failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Toggle pack enabled/disabled in active instance
  const handleTogglePack = (packId: string) => {
    if (!activeInstance || !onUpdateInstance) return;
    playMinecraftClickSound();
    const updatedPacks = (activeInstance.packs || []).map((p) =>
      p.id === packId ? { ...p, enabled: !p.enabled } : p
    );
    onUpdateInstance({ ...activeInstance, packs: updatedPacks });
  };

  // Move pack priority up / down
  const handleMovePriority = (index: number, direction: 'up' | 'down') => {
    if (!activeInstance || !onUpdateInstance) return;
    playMinecraftClickSound();
    const packs = [...(activeInstance.packs || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= packs.length) return;

    const temp = packs[index];
    packs[index] = packs[targetIndex];
    packs[targetIndex] = temp;

    const reordered = packs.map((p, idx) => ({ ...p, order: idx + 1 }));
    onUpdateInstance({ ...activeInstance, packs: reordered });
  };

  // Delete pack from active instance
  const handleDeletePack = (packId: string) => {
    if (!activeInstance || !onUpdateInstance) return;
    playMinecraftClickSound();
    const updatedPacks = (activeInstance.packs || []).filter((p) => p.id !== packId);
    onUpdateInstance({ ...activeInstance, packs: updatedPacks });
  };

  const isItemInstalledInInstance = (name: string) => {
    if (!activeInstance) return false;
    const inPacks = (activeInstance.packs || []).some(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    const inWorlds = (activeInstance.worlds || []).some(
      (w) => w.name.toLowerCase() === name.toLowerCase()
    );
    return inPacks || inWorlds;
  };

  const allInstancesList = instances.length > 0 ? instances : activeInstance ? [activeInstance] : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide font-display">
              Add-ons & Content Hub
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase font-mono">
              Modrinth
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Discover, install, and manage Resource Packs, Shaders, Data Packs, Worlds, and Modpacks with per-instance routing.
          </p>
        </div>

        {/* Active Instance Context Info */}
        {activeInstance && (
          <div className="flex items-center gap-3 bg-[#131722] border border-white/10 px-3.5 py-2 rounded-lg self-start md:self-auto">
            <GrassBlockIcon className="w-5 h-5" />
            <div className="text-xs">
              <span className="text-slate-400">Targeting: </span>
              <span className="font-bold text-white font-display">{activeInstance.name}</span>
              <span className="text-slate-400 text-[11px] block font-mono">
                MC {activeInstance.gameVersion} • {activeInstance.loader}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
        {[
          { id: 'resourcepacks', label: 'Resource Packs', icon: Layers },
          { id: 'shaders', label: 'Shader Packs', icon: Sparkles },
          { id: 'datapacks', label: 'Data Packs', icon: NetheriteIngotIcon },
          { id: 'worlds', label: 'World Saves', icon: MapPin },
          { id: 'modpacks', label: 'Modpacks', icon: Package },
          {
            id: 'installed',
            label: `Installed on ${activeInstance?.name || 'Instance'} (${activeInstance?.packs?.length || 0})`,
            icon: Check,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                playMinecraftClickSound();
                setSubTab(tab.id as PackCategory);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                  : 'bg-[#151924] text-slate-300 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search & Provider Filter Toolbar (Visible on Discovery tabs) */}
      {subTab !== 'installed' && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#121620] p-3 rounded-xl border border-white/10">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${subTab} on Modrinth...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0a0d14] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <span className="self-end rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 font-display sm:self-auto">
            Modrinth
          </span>
        </div>
      )}

      {/* Main Content Area */}
      {subTab === 'installed' ? (
        /* Installed on Instance Management View */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#11151f] p-4 rounded-xl border border-white/10">
            <div>
              <h3 className="text-base font-bold text-white font-display">
                Active Content for &quot;{activeInstance?.name || 'Selected Instance'}&quot;
              </h3>
              <p className="text-xs text-slate-400">
                Drag or use arrows to change load priority. Toggle to enable or disable without uninstalling.
              </p>
            </div>
            <label className="btn-mc flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-200 rounded cursor-pointer self-start sm:self-auto">
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Import ZIP File</span>
              <input
                type="file"
                accept=".zip,.mrpack"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSearchError(`Could not import ${file.name}: file-copy support is not available.`);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {/* Installed Packs List */}
          {(!activeInstance?.packs || activeInstance.packs.length === 0) ? (
            <div className="text-center py-12 rounded-xl bg-[#0c0f16] border border-white/5">
              <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-300">No add-ons or packs installed yet</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Explore the Resource Packs, Shaders, and Data Packs tabs to install community content directly into this instance.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeInstance.packs.map((pack, index) => (
                <div
                  key={pack.id}
                  className={`flex items-center justify-between p-3.5 rounded-lg border transition-all ${
                    pack.enabled
                      ? 'bg-[#141924] border-white/10'
                      : 'bg-[#0f121a]/60 border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono font-bold text-slate-500 w-5 text-center">
                      #{index + 1}
                    </span>
                    <div className="p-2 rounded bg-black/40 border border-white/10 shrink-0">
                      {pack.type === 'shader' ? (
                        <Sparkles className="w-4 h-4 text-amber-400" />
                      ) : pack.type === 'datapack' ? (
                        <NetheriteIngotIcon className="w-4 h-4" />
                      ) : (
                        <Layers className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate font-display">
                          {pack.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-white/10 text-slate-300">
                          {pack.type}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono truncate block">
                        {pack.filename}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Priority buttons */}
                    <button
                      onClick={() => handleMovePriority(index, 'up')}
                      disabled={index === 0}
                      title="Move up in priority"
                      className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                    >
                      <MoveUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMovePriority(index, 'down')}
                      disabled={index === activeInstance.packs.length - 1}
                      title="Move down in priority"
                      className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                    >
                      <MoveDown className="w-4 h-4" />
                    </button>

                    {/* Enable/Disable Toggle */}
                    <button
                      onClick={() => handleTogglePack(pack.id)}
                      className={`btn-mc px-3 py-1 text-xs font-bold rounded ${
                        pack.enabled ? 'btn-mc-green text-white' : 'text-slate-400'
                      }`}
                    >
                      {pack.enabled ? 'ACTIVE' : 'OFF'}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeletePack(pack.id)}
                      className="p-1.5 rounded text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors ml-1 cursor-pointer"
                      title="Remove pack"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Discovery Catalog Grid */
        <div>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-xs text-slate-400 font-mono">Searching Modrinth & CurseForge catalogs...</p>
            </div>
          ) : searchError ? (
            <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
              Modrinth search failed: {searchError}
            </div>
          ) : subTab === 'worlds' ? (
            <div className="rounded-xl border border-white/10 bg-black/30 p-8 text-center">
              <p className="text-sm font-bold text-white font-display">World discovery is unavailable</p>
              <p className="mt-2 text-xs text-slate-400">Modrinth does not provide a world-save catalog for this search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Modrinth items */}
              {modrinthResults.map((item) => {
                const installed = isItemInstalledInInstance(item.title);
                return (
                  <div
                    key={`mr_${item.project_id}`}
                    className="p-4 rounded-xl bg-[#131722] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        {item.icon_url && (
                          <img
                            src={item.icon_url}
                            alt={item.title}
                            className="w-12 h-12 rounded-lg object-cover bg-black/40 border border-white/10 shrink-0"
                          />
                        )}
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>Modrinth</span>
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors font-display line-clamp-1">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 h-8">
                        {item.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {item.categories.slice(0, 3).map((c, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-slate-300 font-mono"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                      <div className="text-[11px] font-mono text-slate-400">
                        <span>{(item.downloads / 1000000).toFixed(1)}M downloads</span>
                      </div>

                      <button
                        onClick={() =>
                          handleOpenInstallModal({
                            id: item.project_id,
                            name: item.title,
                            type: subTab === 'shaders' ? 'shader' : subTab === 'modpacks' ? 'modpack' : 'resourcepack',
                            source: 'modrinth',
                            iconUrl: item.icon_url,
                            description: item.description,
                            filename: `${item.slug}.zip`,
                            author: item.author,
                          })
                        }
                        className={`btn-mc px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer ${
                          installed ? 'btn-mc-green text-white' : 'text-emerald-300'
                        }`}
                      >
                        {installed ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Installed</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Install...</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !searchError && modrinthResults.length === 0 && subTab !== 'worlds' && (
            <div className="text-center py-12 rounded-xl bg-[#0c0f16] border border-white/5">
              <Search className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-300">No results found for &quot;{searchQuery}&quot;</h4>
              <p className="text-xs text-slate-500 mt-1">Try another search keyword.</p>
            </div>
          )}
        </div>
      )}

      {/* Target Instance Selection Modal */}
      <InstallTargetModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        instances={allInstancesList}
        activeInstanceId={activeInstance?.id}
        item={targetItem}
        onConfirmInstall={handleConfirmInstall}
        onCreateInstanceWithItem={onCreateInstanceForPack}
      />
    </div>
  );
};
