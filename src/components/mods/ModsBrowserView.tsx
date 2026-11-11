import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  Download,
  Check,
  Loader2,
  ExternalLink,
  Globe,
  Filter,
} from 'lucide-react';
import { searchModrinth, SearchOptions } from '../../services/modrinthApi';
import { ModrinthSearchResult } from '../../types/launcher';
import { MinecraftInstance, InstalledMod, ModLoaderType } from '../../types/instance';
import { EnderEyeIcon } from '../icons/MinecraftIcons';
import { playMinecraftClickSound, playMinecraftLevelUpSound } from '../../services/soundService';
import { InstallTargetModal, InstallableItem } from '../common/InstallTargetModal';
import { invokeInstallInstanceAddon, isTauriEnvironment } from '../../services/tauriBridge';

interface ModsBrowserViewProps {
  activeInstance: MinecraftInstance | null;
  instances?: MinecraftInstance[];
  onInstallMod: (mod: InstalledMod) => void;
  onInstallModToInstance?: (targetInstanceId: string, mod: InstalledMod) => void;
}

export const ModsBrowserView: React.FC<ModsBrowserViewProps> = ({
  activeInstance,
  instances = [],
  onInstallMod,
  onInstallModToInstance,
}) => {
  const [query, setQuery] = useState('');
  const [loaderFilter, setLoaderFilter] = useState<ModLoaderType | 'all'>(
    activeInstance?.loader && activeInstance.loader !== 'vanilla' ? activeInstance.loader : 'all'
  );
  const [sortBy, setSortBy] = useState<'downloads' | 'relevance' | 'follows' | 'newest'>('downloads');
  const [modrinthResults, setModrinthResults] = useState<ModrinthSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Install Target Modal State
  const [targetItem, setTargetItem] = useState<InstallableItem | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  const performSearch = async () => {
    setLoading(true);
    setSearchError(null);
    try {
      const opts: SearchOptions = {
        query: query.trim() || undefined,
        projectType: 'mod',
        loader: loaderFilter === 'all' ? undefined : loaderFilter,
        sortBy,
        limit: 24,
      };
      const res = await searchModrinth(opts);
      setModrinthResults(res.hits);
    } catch (reason) {
      setSearchError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 200);
    return () => clearTimeout(timer);
  }, [query, loaderFilter, sortBy]);

  const handleOpenInstallModal = (item: InstallableItem) => {
    playMinecraftClickSound();
    setTargetItem(item);
    setIsInstallModalOpen(true);
  };

  const handleConfirmInstall = async (targetInstanceId: string, item: InstallableItem) => {
    const targetInst = instances.find((i) => i.id === targetInstanceId) ?? null;
    if (!targetInst) {
      setSearchError('Select an existing instance before installing.');
      return;
    }
    setSearchError(null);

    try {
      let finalFileName = item.filename || `${item.id}.jar`;
      if (isTauriEnvironment()) {
        const res = await invokeInstallInstanceAddon({
          instance_id: targetInst.id,
          addon_id: String(item.id),
          addon_name: item.name,
          addon_type: 'mod',
          provider: (item.source as 'modrinth' | 'curseforge') || 'modrinth',
          game_version: targetInst.gameVersion,
          loader: targetInst.loader,
          custom_game_dir: targetInst.customGameDir,
          file_name: item.filename,
        });
        if (res.file_name) finalFileName = res.file_name;
      }

      const installed: InstalledMod = {
        id: String(item.id),
        name: item.name,
        filename: finalFileName,
        version: item.version || 'Latest',
        enabled: true,
        author: item.author,
        description: item.description,
        iconUrl: item.iconUrl || undefined,
        source: item.source,
        modrinthId: item.source === 'modrinth' ? String(item.id) : undefined,
      };

      if (onInstallModToInstance) {
        onInstallModToInstance(targetInstanceId, installed);
      } else {
        onInstallMod(installed);
      }
      playMinecraftLevelUpSound();
    } catch (err) {
      setSearchError(`Install failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const isAlreadyInstalled = (name: string, id: string) => {
    if (!activeInstance) return false;
    return (activeInstance.mods || []).some(
      (m) => m.id === id || m.name.toLowerCase() === name.toLowerCase()
    );
  };

  const allInstancesList = instances.length > 0 ? instances : activeInstance ? [activeInstance] : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 select-none">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
            <EnderEyeIcon className="w-5 h-5" />
            <span>Discover Minecraft Mods</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Search from over 100,000+ community mods with multi-instance target installation.
          </p>
        </div>

        <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 font-display">
          Modrinth
        </span>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#11151f] p-3 rounded-xl border border-white/10">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Modrinth mods (e.g. Sodium, Iris, Lithium)..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#0a0d14] border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        {/* Loader filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#0a0d14] border border-white/5 rounded-lg text-xs">
            {(['all', 'fabric', 'forge', 'neoforge', 'quilt'] as const).map((l) => (
              <button
                key={l}
                onClick={() => {
                  playMinecraftClickSound();
                  setLoaderFilter(l);
                }}
                className={`px-2.5 py-1 rounded text-xs font-mono uppercase font-bold transition-colors cursor-pointer ${
                  loaderFilter === l
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 text-xs bg-[#0a0d14] border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
          >
            <option value="downloads">Most Downloaded</option>
            <option value="relevance">Highest Relevance</option>
            <option value="follows">Most Followed</option>
            <option value="newest">Recently Updated</option>
          </select>
        </div>
      </div>

      {/* Mod Cards Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-xs font-mono">Querying Modrinth API v2...</p>
        </div>
      ) : searchError ? (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
          {searchError}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modrinthResults.map((item) => {
                const installed = isAlreadyInstalled(item.title, item.project_id);

                return (
                  <div
                    key={item.project_id}
                    className="card-obsidian p-5 rounded-xl flex flex-col justify-between gap-4 transition-all group"
                  >
                    {/* Top Info */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        {item.icon_url && (
                          <img
                            src={item.icon_url}
                            alt={item.title}
                            className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 object-cover shrink-0 shadow-sm"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-white font-display tracking-tight truncate group-hover:text-emerald-400 transition-colors">
                            {item.title}
                          </h3>
                          <div className="text-[11px] text-slate-400 truncate">
                            by <strong className="text-slate-300 font-medium">{item.author}</strong>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono font-semibold mt-0.5">
                            <Download className="w-3 h-3" />
                            <span>{(item.downloads / 1000000).toFixed(1)}M downloads</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        {item.categories.slice(0, 3).map((cat) => (
                          <span
                            key={cat}
                            className="px-2 py-0.5 rounded text-[9px] font-mono font-bold text-slate-400 bg-black/40 border border-white/5 uppercase"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Action */}
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                      <a
                        href={`https://modrinth.com/mod/${item.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono"
                      >
                        <span>View project</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>

                      <button
                        onClick={() =>
                          handleOpenInstallModal({
                            id: item.project_id,
                            name: item.title,
                            type: 'mod',
                            source: 'modrinth',
                            iconUrl: item.icon_url,
                            description: item.description,
                            version: item.latest_version,
                            author: item.author,
                          })
                        }
                        className={`btn-mc px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
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

      {/* Target Instance Selection Modal */}
      <InstallTargetModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        instances={allInstancesList}
        activeInstanceId={activeInstance?.id}
        item={targetItem}
        onConfirmInstall={handleConfirmInstall}
      />
    </div>
  );
};
