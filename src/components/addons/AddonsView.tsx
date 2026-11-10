import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Search,
  Download,
  Layers,
  Check,
  Trash2,
  Upload,
  MoveUp,
  MoveDown,
  Globe,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  MinecraftInstance,
  InstalledMod,
  InstalledPack,
  ModLoaderType,
} from '../../types/instance';
import { searchModrinth } from '../../services/modrinthApi';
import { CurseForgeSearchResult, ModrinthSearchResult } from '../../types/launcher';
import {
  invokeCurseForgeKeyStatus,
  invokeSearchCurseForge,
  isTauriEnvironment,
} from '../../services/tauriBridge';
import { playMinecraftClickSound } from '../../services/soundService';
import { AddonDetailModal, UnifiedAddonItem } from './AddonDetailModal';
import { AddonInstallModal } from './AddonInstallModal';
import {
  DiamondSwordIcon,
  CraftingTableIcon,
  GrassBlockIcon,
  EnderEyeIcon,
  PickaxeIcon,
  NetheriteIngotIcon,
  CreeperFaceIcon,
  RamChipIcon,
} from '../icons/MinecraftIcons';

interface AddonsViewProps {
  activeInstance: MinecraftInstance | null;
  instances: MinecraftInstance[];
  onUpdateInstance: (updated: MinecraftInstance) => void;
  onAddTask?: (task: any) => void;
  onOpenCreateInstance?: () => void;
}

type MainViewMode = 'inventory' | 'browse';
type AddonCategory = 'all' | 'mod' | 'resourcepack' | 'shader' | 'datapack' | 'modpack';
type CatalogProvider = 'modrinth' | 'curseforge';

const CURSEFORGE_CLASS_IDS: Record<Exclude<AddonCategory, 'all'>, number> = {
  mod: 6,
  modpack: 4471,
  resourcepack: 12,
  shader: 6552,
  datapack: 17,
};

const CURSEFORGE_LOADER_IDS: Partial<Record<ModLoaderType, number>> = {
  forge: 1,
  fabric: 4,
  quilt: 5,
  neoforge: 6,
};

export const AddonsView: React.FC<AddonsViewProps> = ({
  activeInstance,
  instances,
  onUpdateInstance,
  onOpenCreateInstance,
}) => {
  // Navigation & Sub-views
  const [viewMode, setViewMode] = useState<MainViewMode>('inventory');
  const [catalogProvider, setCatalogProvider] = useState<CatalogProvider>('modrinth');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(
    activeInstance?.id ?? ''
  );
  const [isInstanceSelectorOpen, setIsInstanceSelectorOpen] = useState(false);

  // Browse State
  const [category, setCategory] = useState<AddonCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [versionFilter, setVersionFilter] = useState<string>('all');
  const [loaderFilter, setLoaderFilter] = useState<ModLoaderType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'downloads' | 'popularity' | 'newest' | 'name'>('downloads');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Results & Counts (Strictly 20 items per page)
  const [modrinthResults, setModrinthResults] = useState<ModrinthSearchResult[]>([]);
  const [curseForgeResults, setCurseForgeResults] = useState<CurseForgeSearchResult[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const availableVersions = useMemo(
    () => Array.from(new Set(catalogProvider === 'modrinth'
      ? modrinthResults.flatMap((result) => result.versions)
      : curseForgeResults.flatMap((result) => result.gameVersions))).sort(),
    [catalogProvider, modrinthResults, curseForgeResults]
  );

  // Modals State
  const [inspectingAddon, setInspectingAddon] = useState<UnifiedAddonItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [installingAddon, setInstallingAddon] = useState<UnifiedAddonItem | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // Notification Banner
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    setSelectedInstanceId(activeInstance?.id ?? '');
  }, [activeInstance?.id]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const targetInstance = useMemo(
    () => instances.find((i) => i.id === selectedInstanceId) ?? null,
    [instances, selectedInstanceId, activeInstance]
  );

  // Synchronize target instance loader filter when switching to browse
  useEffect(() => {
    if (targetInstance && targetInstance.loader !== 'vanilla' && loaderFilter === 'all') {
      setLoaderFilter(targetInstance.loader);
    }
  }, [targetInstance]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, category, loaderFilter, versionFilter, sortBy]);

  // Fetch results from the live Modrinth catalog.
  const performSearch = async () => {
    if (viewMode !== 'browse') return;
    setLoading(true);
    setSearchError(null);

    try {
      if (catalogProvider === 'curseforge') {
        if (!isTauriEnvironment()) {
          throw new Error('CurseForge search requires the desktop launcher and a securely stored API key.');
        }
        if (!await invokeCurseForgeKeyStatus()) {
          throw new Error('Add your CurseForge API key in Settings to browse its catalog.');
        }
        const result = await invokeSearchCurseForge({
          query: searchQuery.trim() || undefined,
          classId: category === 'all' ? undefined : CURSEFORGE_CLASS_IDS[category],
          gameVersion: versionFilter === 'all' ? undefined : versionFilter,
          modLoaderType: loaderFilter === 'all' ? undefined : CURSEFORGE_LOADER_IDS[loaderFilter],
          sortField: sortBy === 'downloads' ? 6 : sortBy === 'newest' ? 3 : sortBy === 'name' ? 4 : 2,
          index: (currentPage - 1) * 20,
          pageSize: 20,
        });
        setCurseForgeResults(result.data);
        setTotalHits(result.totalCount);
        return;
      }

      const pType = category === 'all' ? undefined : category;

      const offset = (currentPage - 1) * 20;
      const res = await searchModrinth({
        query: searchQuery.trim() || undefined,
        projectType: pType,
        loader: loaderFilter === 'all' ? undefined : loaderFilter,
        gameVersion: versionFilter === 'all' ? undefined : versionFilter,
        sortBy: sortBy === 'downloads' ? 'downloads' : sortBy === 'newest' ? 'newest' : sortBy === 'popularity' ? 'follows' : 'relevance',
        limit: 20,
        offset,
      });
      setModrinthResults(res.hits);
      setCurseForgeResults([]);
      setTotalHits(res.total_hits);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery, category, loaderFilter, versionFilter, sortBy, viewMode, currentPage, catalogProvider]);

  // Convert Modrinth item to UnifiedAddonItem
  const unifiedModrinthList: UnifiedAddonItem[] = useMemo(() => {
    return modrinthResults.map((r) => ({
      id: r.project_id,
      slug: r.slug,
      name: r.title,
      type: r.project_type,
      source: 'modrinth',
      iconUrl: r.icon_url,
      summary: r.description,
      description: r.body || r.description,
      author: r.author,
      downloads: r.downloads,
      follows: r.follows,
      gameVersions: r.versions ?? [],
      loaders: r.categories.filter((c) =>
        ['fabric', 'forge', 'neoforge', 'quilt', 'liteloader'].includes(c.toLowerCase())
      ),
      categories: r.display_categories ?? r.categories,
      clientSide: r.client_side,
      serverSide: r.server_side,
      license: r.license,
      dateModified: r.date_modified,
      websiteUrl: `https://modrinth.com/${r.project_type}/${r.slug}`,
    }));
  }, [modrinthResults]);

  const unifiedCurseForgeList: UnifiedAddonItem[] = useMemo(() => curseForgeResults.map((item) => {
    const type: UnifiedAddonItem['type'] =
      item.classId === 4471 ? 'modpack'
        : item.classId === 12 ? 'resourcepack'
          : item.classId === 6552 ? 'shader'
            : item.classId === 17 ? 'datapack' : 'mod';
    const loaderNames: Record<number, string> = { 1: 'forge', 4: 'fabric', 5: 'quilt', 6: 'neoforge' };
    return {
      id: item.id,
      slug: item.slug,
      name: item.name,
      type,
      source: 'curseforge',
      iconUrl: item.logoUrl,
      summary: item.summary,
      description: item.summary,
      author: item.author,
      downloads: item.downloadCount,
      gameVersions: item.gameVersions,
      loaders: [...new Set(item.loaders.flatMap((id) => loaderNames[id] ? [loaderNames[id]] : []))],
      categories: [],
      websiteUrl: item.websiteUrl ?? `https://www.curseforge.com/minecraft/${type === 'modpack' ? 'modpacks' : type === 'resourcepack' ? 'texture-packs' : type === 'shader' ? 'shaders' : 'mc-mods'}/${item.slug}`,
    };
  }), [curseForgeResults]);

  const activeAddonList = catalogProvider === 'curseforge' ? unifiedCurseForgeList : unifiedModrinthList;
  const totalPages = Math.max(1, Math.ceil(totalHits / 20));

  // Inventory states
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState<
    'all' | 'mods' | 'resourcepacks' | 'shaders' | 'datapacks'
  >('all');

  const installedMods = targetInstance?.mods || [];
  const installedPacks = targetInstance?.packs || [];

  // Open Details Modal
  const handleOpenDetails = (addon: UnifiedAddonItem) => {
    playMinecraftClickSound();
    setInspectingAddon(addon);
    setIsDetailModalOpen(true);
  };

  // Open Install Modal
  const handleOpenInstallModal = (addon: UnifiedAddonItem) => {
    playMinecraftClickSound();
    setInstallingAddon(addon);
    setIsInstallModalOpen(true);
  };

  // Confirm Install into chosen instance
  const handleConfirmInstall = (
    chosenInstanceId: string,
    addon: UnifiedAddonItem
  ) => {
    const inst = instances.find((i) => i.id === chosenInstanceId);
    if (!inst) {
      showNotification('Select an existing instance before installing.');
      return;
    }
    showNotification(`Could not install ${addon.name}: no downloadable file was provided by the source.`);
  };

  // Create new instance and install
  const handleCreateNewInstanceAndInstall = (
    _newInstanceData: { name: string; gameVersion: string; loader: ModLoaderType },
    addon: UnifiedAddonItem
  ) => {
    showNotification(`Could not install ${addon.name}: no downloadable file was provided by the source.`);
  };

  // Toggle mod in inventory
  const handleToggleMod = (modId: string) => {
    if (!targetInstance) return;
    playMinecraftClickSound();
    const updated = targetInstance.mods.map((m) =>
      m.id === modId ? { ...m, enabled: !m.enabled } : m
    );
    onUpdateInstance({ ...targetInstance, mods: updated });
  };

  // Delete mod from inventory
  const handleDeleteMod = (modId: string) => {
    if (!targetInstance) return;
    playMinecraftClickSound();
    const updated = targetInstance.mods.filter((m) => m.id !== modId);
    onUpdateInstance({ ...targetInstance, mods: updated });
    showNotification('Mod removed from instance inventory.');
  };

  // Toggle pack in inventory
  const handleTogglePack = (packId: string) => {
    if (!targetInstance) return;
    playMinecraftClickSound();
    const updated = targetInstance.packs.map((p) =>
      p.id === packId ? { ...p, enabled: !p.enabled } : p
    );
    onUpdateInstance({ ...targetInstance, packs: updated });
  };

  // Delete pack from inventory
  const handleDeletePack = (packId: string) => {
    if (!targetInstance) return;
    playMinecraftClickSound();
    const updated = targetInstance.packs.filter((p) => p.id !== packId);
    onUpdateInstance({ ...targetInstance, packs: updated });
    showNotification('Pack removed from instance inventory.');
  };

  // Move pack order
  const handleMovePack = (index: number, direction: 'up' | 'down') => {
    if (!targetInstance) return;
    const packs = [...targetInstance.packs];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= packs.length) return;
    playMinecraftClickSound();
    const temp = packs[index];
    packs[index] = packs[targetIdx];
    packs[targetIdx] = temp;
    packs.forEach((p, i) => (p.order = i));
    onUpdateInstance({ ...targetInstance, packs });
  };

  // Import local JAR or ZIP file
  const handleImportLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!targetInstance) {
      showNotification('Select an instance before importing local files.');
      e.target.value = '';
      return;
    }
    showNotification('Local file installation is unavailable until files can be copied into an instance.');
    e.target.value = '';
  };

  // Helper: render instance icon
  const renderInstanceIcon = (iconName: string, className = 'w-5 h-5') => {
    if (iconName.startsWith('data:') || iconName.startsWith('http')) {
      return <img src={iconName} alt="Instance Icon" className={`${className} rounded object-cover`} />;
    }
    switch (iconName) {
      case 'crafting_table':
        return <CraftingTableIcon className={className} />;
      case 'grass_block':
        return <GrassBlockIcon className={className} />;
      case 'pickaxe':
        return <PickaxeIcon className={className} />;
      case 'ender_eye':
        return <EnderEyeIcon className={className} />;
      case 'netherite_ingot':
        return <NetheriteIngotIcon className={className} />;
      case 'creeper':
        return <CreeperFaceIcon className={className} />;
      case 'redstone':
        return <RamChipIcon className={className} />;
      default:
        return <DiamondSwordIcon className={className} />;
    }
  };

  // Filtered inventory items
  const filteredInstalledMods = installedMods.filter(
    (m) =>
      inventorySearch === '' ||
      m.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      m.filename.toLowerCase().includes(inventorySearch.toLowerCase())
  );

  const filteredInstalledPacks = installedPacks.filter((p) => {
    const matchesSearch =
      inventorySearch === '' ||
      p.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      p.filename.toLowerCase().includes(inventorySearch.toLowerCase());

    if (!matchesSearch) return false;
    if (inventoryFilter === 'resourcepacks') return p.type === 'resourcepack';
    if (inventoryFilter === 'shaders') return p.type === 'shader';
    if (inventoryFilter === 'datapacks') return p.type === 'datapack';
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 select-none">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-mono text-xs shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 backdrop-blur-md">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Primary Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight flex items-center gap-3">
                <span>Addons</span>
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-xl">
                Browse Modrinth or CurseForge projects and manage installed content.
              </p>
            </div>
          </div>
        </div>

        {/* Mode Switcher + Enhanced Target Instance Picker */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Main Mode Toggle */}
          <div className="p-1 rounded-xl bg-black/60 border border-white/10 flex items-center gap-1 shadow-inner">
            <button
              type="button"
              onClick={() => {
                playMinecraftClickSound();
                setViewMode('inventory');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-display flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'inventory'
                  ? 'btn-mc btn-mc-green text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Installed Inventory</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playMinecraftClickSound();
                setViewMode('browse');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-display flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'browse'
                  ? 'btn-mc btn-mc-diamond text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Browse Online</span>
            </button>
          </div>

          
          
        </div>
      </div>

      {/* ====================================================================
          MODE 1: INSTALLED INVENTORY
          ==================================================================== */}
      {viewMode === 'inventory' && (
        <div className="space-y-6">
          {/* Inventory Controls & Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Active Target Instance</span>
              <div className="text-sm font-bold text-white font-display truncate">
                {targetInstance?.name || 'No Instance Selected'}
              </div>
              <div className="text-[11px] text-emerald-400 font-mono">
                MC {targetInstance?.gameVersion} • {targetInstance?.loader.toUpperCase()}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Loaded Mods</span>
              <div className="text-xl font-black text-white font-display">
                {installedMods.filter((m) => m.enabled).length} / {installedMods.length}
              </div>
              <div className="text-[11px] text-slate-400 font-mono truncate">
                In .minecraft/instances/{targetInstance?.id}/mods
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Resource &amp; Shaders</span>
              <div className="text-xl font-black text-white font-display">
                {installedPacks.filter((p) => p.enabled).length} / {installedPacks.length}
              </div>
              <div className="text-[11px] text-slate-400 font-mono truncate">
                Active in current load order
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col justify-between">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Add Local Files</span>
              <div className="pt-2">
                <input
                  type="file"
                  id="inventory-import-file"
                  multiple
                  accept=".jar,.zip,.jar.disabled"
                  onChange={handleImportLocalFile}
                  className="hidden"
                />
                <label
                  htmlFor="inventory-import-file"
                  className="btn-mc btn-mc-diamond w-full py-1.5 px-3 text-xs font-bold text-white rounded flex items-center justify-center gap-2 cursor-pointer shadow-sm truncate"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import .JAR / .ZIP</span>
                </label>
              </div>
            </div>
          </div>

          {/* Sub-Filters & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/5">
              {[
                { id: 'all', label: 'All Addons', count: installedMods.length + installedPacks.length },
                { id: 'mods', label: 'Mods (.jar)', count: installedMods.length },
                {
                  id: 'resourcepacks',
                  label: 'Resource Packs',
                  count: installedPacks.filter((p) => p.type === 'resourcepack').length,
                },
                {
                  id: 'shaders',
                  label: 'Shader Packs',
                  count: installedPacks.filter((p) => p.type === 'shader').length,
                },
                {
                  id: 'datapacks',
                  label: 'Data Packs',
                  count: installedPacks.filter((p) => p.type === 'datapack').length,
                },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => {
                    playMinecraftClickSound();
                    setInventoryFilter(pill.id as any);
                  }}
                  className={`px-3 btn-mc py-1.5 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                    inventoryFilter === pill.id
                      ? 'bg-emerald-500/20 btn-mc-diamond text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{pill.label}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/50 text-slate-400">
                    {pill.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                placeholder="Search installed addons..."
                className="w-full pl-9 pr-3 py-1.5 bg-black/50 border border-white/10 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Installed Content Tables */}
          {(inventoryFilter === 'all' || inventoryFilter === 'mods') && filteredInstalledMods.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                  <CraftingTableIcon className="w-4 h-4 text-emerald-400" />
                  <span>Installed Mods ({filteredInstalledMods.length})</span>
                </h3>
              </div>

              <div className="space-y-2">
                {filteredInstalledMods.map((mod) => (
                  <div
                    key={mod.id}
                    className="p-3.5 rounded-xl bg-black/40 border border-white/5 hover:border-white/15 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {mod.iconUrl ? (
                        <img
                          src={mod.iconUrl}
                          alt={mod.name}
                          onError={(e) => { e.currentTarget.hidden = true; }}
                          className="w-10 h-10 rounded-lg object-cover bg-black/50 border border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                          <EnderEyeIcon className="w-5 h-5" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white font-display truncate">
                            {mod.name}
                          </h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-slate-400 border border-white/5 shrink-0">
                            v{mod.version}
                          </span>
                          <span
                            className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-bold shrink-0 ${
                              mod.source === 'modrinth'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : mod.source === 'curseforge'
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {mod.source}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                          {mod.filename}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleToggleMod(mod.id)}
                        className={`btn-mc px-3 py-1 text-xs font-bold rounded cursor-pointer ${
                          mod.enabled
                            ? 'btn-mc-green text-white'
                            : 'text-slate-400 bg-black/40'
                        }`}
                      >
                        {mod.enabled ? 'Enabled' : 'Disabled'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteMod(mod.id)}
                        className="btn-mc btn-mc-red p-1.5 rounded text-white cursor-pointer"
                        title="Delete Mod"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Installed Packs List */}
          {(inventoryFilter === 'all' || inventoryFilter !== 'mods') && filteredInstalledPacks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Installed Packs &amp; Shaders ({filteredInstalledPacks.length})</span>
                </h3>
              </div>

              <div className="space-y-2">
                {filteredInstalledPacks.map((pack, idx) => (
                  <div
                    key={pack.id}
                    className="p-3.5 rounded-xl bg-black/40 border border-white/5 hover:border-white/15 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {pack.iconUrl ? (
                        <img
                          src={pack.iconUrl}
                          alt={pack.name}
                          onError={(e) => { e.currentTarget.hidden = true; }}
                          className="w-10 h-10 rounded-lg object-cover bg-black/50 border border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white font-display truncate">
                            {pack.name}
                          </h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-slate-400 border border-white/5 uppercase shrink-0">
                            {pack.type}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                          {pack.filename}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleMovePack(idx, 'up')}
                        disabled={idx === 0}
                        className="btn-mc p-1.5 rounded text-slate-300 disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMovePack(idx, 'down')}
                        disabled={idx === filteredInstalledPacks.length - 1}
                        className="btn-mc p-1.5 rounded text-slate-300 disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTogglePack(pack.id)}
                        className={`btn-mc px-3 py-1 text-xs font-bold rounded cursor-pointer ${
                          pack.enabled
                            ? 'btn-mc-green text-white'
                            : 'text-slate-400 bg-black/40'
                        }`}
                      >
                        {pack.enabled ? 'Active' : 'Inactive'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePack(pack.id)}
                        className="btn-mc btn-mc-red p-1.5 rounded text-white cursor-pointer"
                        title="Delete Pack"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {installedMods.length === 0 && installedPacks.length === 0 && (
            <div className="p-12 text-center rounded-2xl border-2 border-dashed border-white/10 bg-black/20 space-y-3">
              <Package className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white font-display">No addons installed in this instance yet</h3>
              <p className="text-xs text-slate-400 font-mono max-w-md mx-auto">
                Switch to &quot;Browse Online&quot; to search live add-on catalogs.
              </p>
              <button
                type="button"
                onClick={() => {
                  playMinecraftClickSound();
                  setViewMode('browse');
                }}
                className="btn-mc btn-mc-green px-5 py-2 text-xs font-bold text-white rounded cursor-pointer mt-2"
              >
                Discover Addons Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
      MODE 2: BROWSE ADDONS
          ==================================================================== */}
      {viewMode === 'browse' && (
        <div className="space-y-6">
          {/* Repository */}
          <div className="card-obsidian p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
                Add-on Repository
              </span>
              <div className="text-xs text-slate-300 font-mono">
                Active Source: <strong className="text-[var(--mc-accent)]">{catalogProvider.toUpperCase()}</strong>
                {targetInstance && (
                  <span className="text-slate-400 ml-2">
                    (Target: {targetInstance.name} - {targetInstance.loader} {targetInstance.gameVersion})
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(['modrinth', 'curseforge'] as const).map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => {
                    playMinecraftClickSound();
                    setCatalogProvider(provider);
                    setCurrentPage(1);
                  }}
                  className={`btn-mc ${catalogProvider === provider ? 'btn-mc-green' : ''} px-4 py-2.5 rounded flex items-center gap-2 text-xs font-black text-white font-display`}
                >
                  <span>{provider === 'modrinth' ? 'MODRINTH' : 'CURSEFORGE'}</span>
                </button>
              ))}
              {catalogProvider === 'curseforge' && !isTauriEnvironment() && (
                <span className="text-[10px] text-amber-300 font-mono">Desktop app required</span>
              )}
            </div>
          </div>

          {/* Filter Bar: Category Tabs + Search + Version Filter + Loader Filter + Sorter */}
          <div className="space-y-3">
            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/5">
              {[
                { id: 'all', label: 'All Addons' },
                { id: 'mod', label: 'Mods' },
                { id: 'resourcepack', label: 'Resource Packs' },
                { id: 'shader', label: 'Shader Packs' },
                { id: 'datapack', label: 'Data Packs' },
                { id: 'modpack', label: 'Modpacks' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    playMinecraftClickSound();
                    setCategory(c.id as any);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-display transition-all cursor-pointer ${
                    category === c.id
                      ? 'btn-mc btn-mc-green text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Search and Secondary Filter Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              {/* Search input */}
              <div className="relative sm:col-span-2 lg:col-span-5">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${catalogProvider === 'modrinth' ? 'Modrinth' : 'CurseForge'} add-ons...`}
                  className="w-full pl-10 pr-4 py-2 bg-black/50 border border-white/10 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Game Version Selector Filter */}
              <div className="lg:col-span-3">
                <select
                  value={versionFilter}
                  onChange={(e) => {
                    playMinecraftClickSound();
                    setVersionFilter(e.target.value);
                  }}
                  className="w-full bg-black/60 border border-white/10 text-white font-mono text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all" className="bg-[#121622] text-white">All Game Versions</option>
                  {versionFilter !== 'all' && !availableVersions.includes(versionFilter) && (
                    <option value={versionFilter} className="bg-[#121622] text-white">{versionFilter}</option>
                  )}
                  {availableVersions.map((version) => (
                    <option key={version} value={version} className="bg-[#121622] text-white">
                      {version}
                    </option>
                  ))}
                </select>
              </div>

              {/* Loader Selector */}
              <div className="lg:col-span-2">
                <select
                  value={loaderFilter}
                  onChange={(e) => {
                    playMinecraftClickSound();
                    setLoaderFilter(e.target.value as any);
                  }}
                  className="w-full bg-black/60 border border-white/10 text-white font-mono text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 uppercase cursor-pointer"
                >
                  <option value="all">ALL LOADERS</option>
                  <option value="fabric">FABRIC</option>
                  <option value="neoforge">NEOFORGE</option>
                  <option value="forge">FORGE</option>
                  <option value="quilt">QUILT</option>
                </select>
              </div>

              {/* Sorter Selector */}
              <div className="lg:col-span-2">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    playMinecraftClickSound();
                    setSortBy(e.target.value as any);
                  }}
                  className="w-full bg-black/60 border border-white/10 text-white font-mono text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="downloads">Most Downloads</option>
                  <option value="popularity">Trending / Popular</option>
                  <option value="newest">Recently Updated</option>
                  <option value="name">Alphabetical</option>
                </select>
              </div>
            </div>

            {/* Quick Filter Reset / Sync bar */}
            {versionFilter !== 'all' && targetInstance && (
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5">
                <span className="truncate">
                  Filtering by version: <strong className="text-emerald-400">{versionFilter}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setVersionFilter('all')}
                  className="text-emerald-400 hover:text-emerald-300 underline font-bold cursor-pointer shrink-0 ml-2"
                >
                  Clear Version Filter
                </button>
              </div>
            )}
          </div>

          {/* Results Grid */}
          {loading ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-mono">Querying Modrinth repository (20 items/page)...</p>
            </div>
          ) : searchError ? (
            <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
              Modrinth search failed: {searchError}
            </div>
          ) : activeAddonList.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-white/10 bg-black/30 space-y-2">
              <p className="text-sm font-bold text-white font-display">No addons found matching current filters</p>
              <p className="text-xs text-slate-400 font-mono">Try clearing the game version filter or adjusting your search keywords.</p>
              <button
                type="button"
                onClick={() => {
                  setVersionFilter('all');
                  setSearchQuery('');
                  setCategory('all');
                }}
                className="btn-mc btn-mc-diamond px-4 py-1.5 text-xs font-bold text-white rounded cursor-pointer mt-2"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Addons Grid (Strictly 20 items per page) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activeAddonList.map((addon) => {
                  const isInstalledInTarget = targetInstance
                    ? (targetInstance.mods || []).some(
                        (m) => String(m.id) === String(addon.id) || m.name.toLowerCase() === addon.name.toLowerCase()
                      ) ||
                      (targetInstance.packs || []).some(
                        (p) => String(p.id) === String(addon.id) || p.name.toLowerCase() === addon.name.toLowerCase()
                      )
                    : false;

                  const isCompatible = targetInstance
                    ? addon.gameVersions.some((v) => v.startsWith(targetInstance.gameVersion.slice(0, 4)))
                    : true;

                  return (
                    <div
                      key={String(addon.id)}
                      onClick={() => handleOpenDetails(addon)}
                      className="p-4 rounded-xl bg-[#0c0f16] border border-white/5 hover:border-white/20 transition-all flex flex-col justify-between gap-3 group cursor-pointer hover:shadow-xl hover:-translate-y-0.5"
                    >
                      <div className="space-y-2.5">
                        {/* Card Header: Icon + Title + Source Badge */}
                        <div className="flex items-start gap-3 min-w-0">
                          {addon.iconUrl ? (
                            <img
                              src={addon.iconUrl}
                              alt={addon.name}
                              onError={(e) => { e.currentTarget.hidden = true; }}
                              className="w-11 h-11 rounded-lg object-cover bg-black/50 border border-white/10 shrink-0 group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                              <Package className="w-5 h-5" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-black text-white font-display truncate group-hover:text-emerald-300 transition-colors">
                              {addon.name}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono truncate mt-0.5">
                              <span className="truncate">{addon.author}</span>
                            </div>
                          </div>
                        </div>

                        {/* Summary with strict line-clamp-2 to avoid text overflow */}
                        <p className="text-xs text-slate-300 leading-snug line-clamp-2 break-anywhere">
                          {addon.summary}
                        </p>

                        {/* Metadata Tags */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase font-mono border ${
                              addon.source === 'modrinth'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {addon.source}
                          </span>

                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-white/5 text-slate-400 font-mono uppercase">
                            {addon.type}
                          </span>

                          {isCompatible ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                              ✓ Compatible
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                              Ver {addon.gameVersions[0]}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Downloads Count + Quick Install Button */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2 mt-auto">
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 truncate">
                          <Download className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{addon.downloads.toLocaleString()}</span>
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetails(addon);
                            }}
                            className="btn-mc px-2 py-1 text-[11px] font-bold text-slate-300 rounded cursor-pointer"
                          >
                            Details
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenInstallModal(addon);
                            }}
                            className={`btn-mc px-3 py-1 text-[11px] font-black rounded cursor-pointer text-white flex items-center gap-1 ${
                              isInstalledInTarget ? 'btn-mc-diamond' : 'btn-mc-green'
                            }`}
                          >
                            <Download className="w-3 h-3" />
                            <span>{isInstalledInTarget ? 'Installed' : 'Install'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sleek Pagination Bar (Strictly 20 mods per page) */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-400 font-mono">
                  Showing <strong className="text-white">{(currentPage - 1) * 20 + 1}</strong> to{' '}
                  <strong className="text-white">{Math.min(currentPage * 20, totalHits)}</strong> of{' '}
                  <strong className="text-emerald-400">{totalHits}</strong> addons (Page {currentPage} of {totalPages})
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playMinecraftClickSound();
                      setCurrentPage((p) => Math.max(1, p - 1));
                    }}
                    disabled={currentPage <= 1}
                    className="btn-mc px-3 py-1.5 rounded text-xs font-bold text-white flex items-center gap-1 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // Smart sliding window of pages
                      let pageNum = i + 1;
                      if (totalPages > 5 && currentPage > 3) {
                        pageNum = Math.min(totalPages - 4 + i, Math.max(1, currentPage - 2 + i));
                      }
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => {
                            playMinecraftClickSound();
                            setCurrentPage(pageNum);
                          }}
                          className={`w-8 h-8 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                            currentPage === pageNum
                              ? 'btn-mc btn-mc-green text-white shadow-md'
                              : 'bg-black/40 text-slate-400 hover:text-white border border-white/5'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      playMinecraftClickSound();
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                    }}
                    disabled={currentPage >= totalPages}
                    className="btn-mc px-3 py-1.5 rounded text-xs font-bold text-white flex items-center gap-1 disabled:opacity-30 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full Addon Details Modal */}
      {inspectingAddon && (
        <AddonDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          addon={inspectingAddon}
          activeInstance={targetInstance}
          instances={instances}
          onOpenInstallModal={(item) => {
            handleOpenInstallModal(item);
          }}
        />
      )}

      {/* Target Instance Chooser & Compatibility Install Modal */}
      {installingAddon && (
        <AddonInstallModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
          addon={installingAddon}
          instances={instances}
          activeInstanceId={targetInstance?.id}
          onConfirmInstall={handleConfirmInstall}
          onCreateNewInstanceAndInstall={handleCreateNewInstanceAndInstall}
        />
      )}
    </div>
  );
};
