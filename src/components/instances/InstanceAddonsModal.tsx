import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  X,
  Search,
  Download,
  Check,
  Package,
  Layers,
  Sparkles,
  Upload,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Flame,
  Key,
} from 'lucide-react';
import {
  MinecraftInstance,
  InstalledMod,
  InstalledPack,
  ModLoaderType,
} from '../../types/instance';
import { searchModrinth, SearchOptions } from '../../services/modrinthApi';
import { ModrinthSearchResult, CurseForgeSearchResult } from '../../types/launcher';
import {
  invokeSearchCurseForge,
  invokeCurseForgeKeyStatus,
  invokeInstallInstanceAddon,
  isTauriEnvironment,
} from '../../services/tauriBridge';
import { playMinecraftClickSound, playMinecraftLevelUpSound } from '../../services/soundService';
import { InstanceCircleLogo } from './InstanceCircleLogo';

interface InstanceAddonsModalProps {
  instance: MinecraftInstance;
  isOpen: boolean;
  onClose: () => void;
  onUpdateInstance: (updated: MinecraftInstance) => void;
}

type CatalogProvider = 'modrinth' | 'curseforge';
type AddonCategory = 'all' | 'mod' | 'resourcepack' | 'shader' | 'datapack';
type SortOption = 'downloads' | 'relevance' | 'updated' | 'newest';

interface UnifiedModalItem {
  id: string;
  name: string;
  slug?: string;
  type: string;
  summary: string;
  author: string;
  downloads: number;
  iconUrl?: string;
  source: CatalogProvider;
  websiteUrl?: string;
}

const PAGE_SIZE = 20;

const CURSEFORGE_CLASS_IDS: Record<Exclude<AddonCategory, 'all'>, number> = {
  mod: 6,
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

export const InstanceAddonsModal: React.FC<InstanceAddonsModalProps> = ({
  instance,
  isOpen,
  onClose,
  onUpdateInstance,
}) => {
  const [provider, setProvider] = useState<CatalogProvider>('modrinth');
  const [category, setCategory] = useState<AddonCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('downloads');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalHits, setTotalHits] = useState(0);

  const [items, setItems] = useState<UnifiedModalItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [filterStrictVersion, setFilterStrictVersion] = useState(true);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);
  const [curseForgeKeyPresent, setCurseForgeKeyPresent] = useState(true);

  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Set of installed mod / pack IDs for quick lookup
  const installedIds = useMemo(() => {
    const ids = new Set<string>();
    instance.mods.forEach((m) => {
      ids.add(m.id);
      if (m.modrinthId) ids.add(m.modrinthId);
      ids.add(m.name.toLowerCase());
      if (m.filename) ids.add(m.filename.toLowerCase());
    });
    instance.packs.forEach((p) => {
      ids.add(p.id);
      ids.add(p.name.toLowerCase());
      if (p.filename) ids.add(p.filename.toLowerCase());
    });
    return ids;
  }, [instance.mods, instance.packs]);

  // Check CurseForge Key Status when provider is CurseForge
  useEffect(() => {
    if (provider === 'curseforge' && isTauriEnvironment()) {
      invokeCurseForgeKeyStatus()
        .then((hasKey) => setCurseForgeKeyPresent(hasKey))
        .catch(() => setCurseForgeKeyPresent(false));
    }
  }, [provider]);

  // Reset page when search, category, provider, or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, category, provider, sortBy, filterStrictVersion]);

  // Fetch Addons with 20 items per page
  const fetchPage = useCallback(async () => {
    if (!isOpen) return;
    setIsLoading(true);
    setError(null);

    const offset = (currentPage - 1) * PAGE_SIZE;

    try {
      if (provider === 'modrinth') {
        const options: SearchOptions = {
          query: searchQuery.trim() || undefined,
          projectType: category === 'all' ? undefined : category,
          loader: instance.loader !== 'vanilla' ? instance.loader : undefined,
          gameVersion: filterStrictVersion ? instance.gameVersion : undefined,
          limit: PAGE_SIZE,
          offset,
          sortBy: sortBy === 'downloads'
            ? 'downloads'
            : sortBy === 'relevance'
              ? 'relevance'
              : sortBy === 'updated'
                ? 'updated'
                : 'newest',
        };

        const data = await searchModrinth(options);
        const mapped: UnifiedModalItem[] = (data.hits || []).map((hit: ModrinthSearchResult) => ({
          id: hit.project_id,
          name: hit.title,
          slug: hit.slug,
          type: hit.project_type,
          summary: hit.description,
          author: hit.author,
          downloads: hit.downloads || 0,
          iconUrl: hit.icon_url ?? undefined,
          source: 'modrinth',
          websiteUrl: `https://modrinth.com/${hit.project_type}/${hit.slug || hit.project_id}`,
        }));

        setItems(mapped);
        setTotalHits(data.total_hits || mapped.length);
      } else {
        // CurseForge Provider
        if (!isTauriEnvironment()) {
          throw new Error('CurseForge API integration connects directly via the desktop launcher.');
        }

        const classId = category === 'all' ? undefined : CURSEFORGE_CLASS_IDS[category];
        const loaderId = CURSEFORGE_LOADER_IDS[instance.loader];
        const sortField = sortBy === 'downloads' ? 6 : sortBy === 'updated' ? 3 : sortBy === 'newest' ? 11 : 2;

        const cfData = await invokeSearchCurseForge({
          query: searchQuery.trim() || undefined,
          classId,
          gameVersion: filterStrictVersion ? instance.gameVersion : undefined,
          modLoaderType: loaderId,
          sortField,
          index: offset,
          pageSize: PAGE_SIZE,
        });

        const cfItems = Array.isArray(cfData.data) ? cfData.data : [];
        const mapped: UnifiedModalItem[] = cfItems.map((item: CurseForgeSearchResult) => {
          const itemType =
            item.classId === 12
              ? 'resourcepack'
              : item.classId === 6552
                ? 'shader'
                : item.classId === 17
                  ? 'datapack'
                  : 'mod';

          return {
            id: String(item.id),
            name: item.name,
            slug: item.slug,
            type: itemType,
            summary: item.summary,
            author: item.author,
            downloads: item.downloadCount || 0,
            iconUrl: item.logoUrl ?? undefined,
            source: 'curseforge',
            websiteUrl: item.websiteUrl || `https://www.curseforge.com/minecraft/mc-mods/${item.slug}`,
          };
        });

        setItems(mapped);
        const total = cfData.totalCount ?? mapped.length;
        setTotalHits(total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search addons.');
      setItems([]);
      setTotalHits(0);
    } finally {
      setIsLoading(false);
    }
  }, [
    isOpen,
    provider,
    category,
    searchQuery,
    sortBy,
    currentPage,
    instance.loader,
    instance.gameVersion,
    filterStrictVersion,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPage();
    }, 250);

    return () => clearTimeout(timer);
  }, [fetchPage]);

  if (!isOpen) return null;

  const totalPages = Math.max(1, Math.ceil(totalHits / PAGE_SIZE));

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    playMinecraftClickSound();
    setCurrentPage(newPage);
    if (listContainerRef.current) {
      listContainerRef.current.scrollTop = 0;
    }
  };

  const handleInstallAddon = async (item: UnifiedModalItem) => {
    playMinecraftClickSound();
    setInstallingId(item.id);
    setError(null);

    try {
      let finalFileName = `${item.slug || item.id}.${['resourcepack', 'shader', 'datapack'].includes(item.type) ? 'zip' : 'jar'}`;

      if (isTauriEnvironment()) {
        const installResult = await invokeInstallInstanceAddon({
          instance_id: instance.id,
          addon_id: item.id,
          addon_name: item.name,
          addon_type: item.type,
          provider: item.source,
          game_version: instance.gameVersion,
          loader: instance.loader,
        });
        if (installResult.file_name) {
          finalFileName = installResult.file_name;
        }
      }

      const isPack = ['resourcepack', 'shader', 'datapack'].includes(item.type);
      if (isPack) {
        const newPack: InstalledPack = {
          id: item.id,
          name: item.name,
          filename: finalFileName,
          type: item.type as 'resourcepack' | 'shader' | 'datapack',
          enabled: true,
          order: instance.packs.length + 1,
          description: item.summary,
          iconUrl: item.iconUrl,
          source: item.source,
        };
        onUpdateInstance({
          ...instance,
          packs: [...instance.packs, newPack],
        });
      } else {
        const newMod: InstalledMod = {
          id: item.id,
          name: item.name,
          filename: finalFileName,
          version: 'Latest',
          enabled: true,
          author: item.author,
          description: item.summary,
          iconUrl: item.iconUrl,
          source: item.source,
          modrinthId: item.source === 'modrinth' ? item.id : undefined,
        };
        onUpdateInstance({
          ...instance,
          mods: [...instance.mods, newMod],
        });
      }

      playMinecraftLevelUpSound();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstallingId(null);
    }
  };

  const handleProcessFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const addedMods: InstalledMod[] = [];
    const addedPacks: InstalledPack[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.jar')) {
        const cleanName = file.name.replace(/\.jar$/, '');
        addedMods.push({
          id: `local_mod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: cleanName,
          filename: file.name,
          version: 'Local file',
          enabled: true,
          author: 'Manual import',
          sizeBytes: file.size,
          source: 'local',
        });
      } else if (lower.endsWith('.zip')) {
        const cleanName = file.name.replace(/\.zip$/, '');
        addedPacks.push({
          id: `local_pack_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: cleanName,
          filename: file.name,
          type: 'resourcepack',
          enabled: true,
          order: instance.packs.length + addedPacks.length + 1,
          description: 'Manually imported ZIP pack',
          source: 'local',
        });
      }
    }

    if (addedMods.length > 0 || addedPacks.length > 0) {
      onUpdateInstance({
        ...instance,
        mods: [...instance.mods, ...addedMods],
        packs: [...instance.packs, ...addedPacks],
      });
      playMinecraftLevelUpSound();
      setLocalFeedback(`Added ${addedMods.length + addedPacks.length} file(s) directly to ${instance.name}!`);
      setTimeout(() => setLocalFeedback(null), 3500);
    }
  };

  // Compute pagination range buttons
  const paginationRange = useMemo(() => {
    const range: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }, [currentPage, totalPages]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-5xl max-h-[94vh] flex flex-col card-obsidian rounded-2xl border-2 border-white/20 shadow-[0_25px_80px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-5 border-b border-white/10 bg-black/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <InstanceCircleLogo loader={instance.loader} icon={instance.icon} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white font-display truncate">
                  Get Addons &amp; Mods for {instance.name}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase bg-[var(--mc-badge-bg)] text-[var(--mc-badge-text)] border border-[var(--mc-accent)]/30 shrink-0">
                  MC {instance.gameVersion} · {instance.loader}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                Full Modrinth &amp; CurseForge integration with fast 20-item paging and one-click installs.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playMinecraftClickSound();
              onClose();
            }}
            className="btn-mc p-2 rounded-lg text-slate-400 hover:text-white cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Local Drop Feedback */}
        {localFeedback && (
          <div className="px-4 py-2 bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{localFeedback}</span>
          </div>
        )}

        {/* Provider Switcher + Controls Strip */}
        <div className="p-3 sm:p-4 border-b border-white/10 bg-black/35 space-y-3 shrink-0">
          {/* Row 1: Provider Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Catalog Providers */}
            <div className="flex items-center gap-1.5 p-1 bg-black/60 border border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  playMinecraftClickSound();
                  setProvider('modrinth');
                }}
                className={`btn-mc px-3.5 py-1.5 text-xs font-black font-display rounded-lg cursor-pointer flex items-center gap-1.5 transition-all ${
                  provider === 'modrinth'
                    ? 'btn-mc-green text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                <span>Modrinth</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playMinecraftClickSound();
                  setProvider('curseforge');
                }}
                className={`btn-mc px-3.5 py-1.5 text-xs font-black font-display rounded-lg cursor-pointer flex items-center gap-1.5 transition-all ${
                  provider === 'curseforge'
                    ? 'btn-mc-green text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>CurseForge</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${provider === 'modrinth' ? 'Modrinth' : 'CurseForge'} ${instance.loader} ${category === 'all' ? 'addons' : category + 's'}...`}
                className="w-full pl-9 pr-4 py-2 text-xs bg-black/70 border border-white/15 rounded-lg text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[var(--mc-accent)]"
              />
            </div>

            {/* File Drop button */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".jar,.zip"
              multiple
              className="hidden"
              onChange={(e) => handleProcessFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-mc flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-slate-200 font-bold rounded cursor-pointer font-display shrink-0"
              title="Install local .jar or .zip directly"
            >
              <Upload className="w-3.5 h-3.5 text-[var(--mc-accent)]" />
              <span>Drop Local File</span>
            </button>
          </div>

          {/* Row 2: Categories, Sort & Strict Version Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            {/* Category tabs */}
            <div className="flex items-center gap-1 p-0.5 bg-black/50 border border-white/10 rounded-lg text-xs overflow-x-auto">
              {(['all', 'mod', 'resourcepack', 'shader', 'datapack'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    playMinecraftClickSound();
                    setCategory(cat);
                  }}
                  className={`btn-mc px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer capitalize font-display ${
                    category === cat
                      ? 'btn-mc-diamond text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cat === 'all' ? 'All Addons' : cat === 'resourcepack' ? 'Resource Packs' : cat + 's'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {/* Sort By Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="select-mc text-[11px] font-mono py-1 px-2.5"
              >
                <option value="downloads">Most Downloaded</option>
                <option value="relevance">Relevance</option>
                <option value="updated">Recently Updated</option>
                <option value="newest">Newest Releases</option>
              </select>

              {/* Exact Version checkbox */}
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-mono text-slate-300">
                <input
                  type="checkbox"
                  checked={filterStrictVersion}
                  onChange={(e) => setFilterStrictVersion(e.target.checked)}
                  className="accent-[var(--mc-accent)] rounded cursor-pointer"
                />
                <span>Exact MC {instance.gameVersion}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Results Container */}
        <div
          ref={listContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 min-h-[360px]"
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <RefreshCw className="w-7 h-7 animate-spin text-[var(--mc-accent)]" />
              <span className="text-xs font-mono">
                Querying {provider === 'modrinth' ? 'Modrinth' : 'CurseForge'} catalog (Page {currentPage})...
              </span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-mono space-y-2">
              <div className="font-bold">Search Notice</div>
              <p>{error}</p>
              {provider === 'curseforge' && (
                <button
                  type="button"
                  onClick={() => {
                    playMinecraftClickSound();
                    setProvider('modrinth');
                  }}
                  className="btn-mc btn-mc-green px-3 py-1.5 text-xs text-white rounded font-display"
                >
                  Switch to Modrinth Catalog
                </button>
              )}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Package className="w-12 h-12 text-slate-500 mx-auto" />
              <div className="text-base font-bold text-white font-display">No addons found</div>
              <p className="text-xs text-slate-400 font-mono max-w-md mx-auto">
                No matching results found on {provider} for this search. Try switching provider, unchecking exact version match, or using a broader query.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((addon) => {
                const isInstalled =
                  installedIds.has(addon.id) ||
                  installedIds.has(addon.name.toLowerCase()) ||
                  (addon.slug && installedIds.has(addon.slug.toLowerCase()));
                const isInstalling = installingId === addon.id;

                return (
                  <div
                    key={`${addon.source}_${addon.id}`}
                    className="card-obsidian card-selectable card-tactile p-3.5 rounded-xl border border-white/10 flex items-start gap-3 justify-between hover:border-[var(--mc-accent)] transition-all"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {addon.iconUrl ? (
                        <img
                          src={addon.iconUrl}
                          alt={addon.name}
                          className="w-11 h-11 rounded-lg object-cover border border-white/20 shrink-0 bg-black/40"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center shrink-0 text-slate-400">
                          <Package className="w-5 h-5" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-white font-display truncate">
                            {addon.name}
                          </h4>
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-white/10 text-slate-300 shrink-0 font-bold">
                            {addon.type}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400 font-mono line-clamp-2 mt-1 leading-snug">
                          {addon.summary}
                        </p>

                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 mt-2">
                          <span className="truncate">by {addon.author}</span>
                          <span>·</span>
                          <span className="shrink-0">{addon.downloads.toLocaleString()} DLs</span>
                          {addon.websiteUrl && (
                            <a
                              href={addon.websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-white shrink-0 ml-auto"
                              title="View official page"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      {isInstalled ? (
                        <div className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300">
                          <Check className="w-3.5 h-3.5" />
                          <span>Installed</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isInstalling}
                          onClick={() => handleInstallAddon(addon)}
                          className="btn-mc btn-mc-green flex items-center gap-1.5 px-3 py-1.5 text-xs text-white font-black rounded cursor-pointer font-display shadow-md disabled:opacity-50"
                        >
                          {isInstalling ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>{isInstalling ? 'Installing…' : 'Install'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dedicated 20-per-page Pagination Footer */}
        <div className="p-3 sm:p-4 border-t border-white/10 bg-black/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-400 shrink-0">
          {/* Pagination Counter Info */}
          <div className="flex items-center gap-2 min-w-0">
            <span>
              Showing <strong className="text-white">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalHits)}</strong> of{' '}
              <strong className="text-emerald-400">{totalHits.toLocaleString()}</strong> addons
            </span>
            <span className="hidden sm:inline text-slate-600">·</span>
            <span className="hidden sm:inline">
              Page <strong className="text-white">{currentPage}</strong> of <strong className="text-white">{totalPages}</strong>
            </span>
          </div>

          {/* Pagination Page Controls (20 per page) */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => handlePageChange(1)}
              className="btn-mc p-1.5 rounded text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => handlePageChange(currentPage - 1)}
              className="btn-mc p-1.5 px-2.5 rounded text-xs font-bold font-display text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer flex items-center gap-1"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            {/* Page number buttons */}
            <div className="flex items-center gap-1">
              {paginationRange.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handlePageChange(p)}
                  className={`btn-mc w-7 h-7 text-xs font-mono font-bold rounded flex items-center justify-center cursor-pointer transition-all ${
                    currentPage === p
                      ? 'btn-mc-green text-white ring-1 ring-white shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => handlePageChange(currentPage + 1)}
              className="btn-mc p-1.5 px-2.5 rounded text-xs font-bold font-display text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer flex items-center gap-1"
              title="Next Page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => handlePageChange(totalPages)}
              className="btn-mc p-1.5 rounded text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                playMinecraftClickSound();
                onClose();
              }}
              className="btn-mc ml-3 px-3.5 py-1.5 rounded text-white text-xs font-bold font-display cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
