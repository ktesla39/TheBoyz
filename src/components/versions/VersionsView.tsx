import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, Loader2, Plus } from 'lucide-react';
import { fetchMojangVersionManifest, getRecommendedJavaVersion } from '../../services/mojangApi';
import { MojangVersionManifest, ReleaseType } from '../../types/launcher';
import { PickaxeIcon, GrassBlockIcon } from '../icons/MinecraftIcons';

interface VersionsViewProps {
  onCreateInstanceWithVersion: (version: string) => void;
}

export const VersionsView: React.FC<VersionsViewProps> = ({ onCreateInstanceWithVersion }) => {
  const [manifest, setManifest] = useState<MojangVersionManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadId, setReloadId] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ReleaseType | 'all'>('release');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchMojangVersionManifest()
      .then((data) => {
        if (!cancelled) setManifest(data);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setLoadError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadId]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-xs font-mono">Synchronizing with official Mojang version manifest v2...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <p className="text-sm font-bold text-red-300">Could not load official Minecraft versions.</p>
        <p className="max-w-xl text-center text-xs font-mono">{loadError}</p>
        <button
          type="button"
          onClick={() => setReloadId((id) => id + 1)}
          className="btn-play-tactile rounded px-4 py-2 text-xs font-bold text-slate-950"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!manifest || !Array.isArray(manifest.versions) || !manifest.latest) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-3 px-6 py-24 text-center text-slate-400">
        <p className="text-sm font-bold text-red-300">The Minecraft version manifest was incomplete.</p>
        <p className="font-mono text-xs">Mojang returned data that could not be used. Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => setReloadId((id) => id + 1)}
          className="btn-play-tactile rounded px-4 py-2 text-xs font-bold text-slate-950"
        >
          Retry
        </button>
      </div>
    );
  }

  const filteredVersions = manifest.versions.filter((v) => {
    const matchesSearch = v.id.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || v.type === typeFilter;
    return matchesSearch && matchesType;
  });
  const totalPages = Math.max(1, Math.ceil(filteredVersions.length / pageSize));
  const pageVersions = filteredVersions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
            <PickaxeIcon className="w-5 h-5" />
            Official Minecraft Versions
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Browse Mojang releases, experimental snapshots, and legacy Alpha/Beta packages.
          </p>
        </div>

        {/* Latest indicators */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
            Latest: <strong className="text-white">{manifest.latest.release}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[#0e131f] border border-white/10 text-slate-300">
            Snapshot: <strong className="text-white">{manifest.latest.snapshot}</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search version (e.g. 1.21.4)..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#0e131f] border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1.5 p-1 bg-[#0a0d14] border border-white/5 rounded-lg text-xs overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'release', label: 'Releases' },
            { id: 'snapshot', label: 'Snapshots' },
            { id: 'old_beta', label: 'Beta' },
            { id: 'old_alpha', label: 'Alpha' },
            { id: 'all', label: 'All' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id as ReleaseType | 'all')}
              className={`px-3 btn-mc py-1 rounded-md text-xs font-bold font-display transition-colors cursor-pointer ${
                typeFilter === tab.id
                  ? 'bg-emerald-500/15 btn-mc-diamond text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Version Table */}
      <div className="card-obsidian rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0a0d14] text-slate-400 border-b border-white/5 uppercase tracking-wider text-[10px] font-bold font-display">
              <tr>
                <th className="py-3 px-4">Version ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Required Java</th>
                <th className="py-3 px-4">Release Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {pageVersions.map((v) => {
                const recommendedJava = getRecommendedJavaVersion(v.id);
                return (
                  <tr key={v.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <GrassBlockIcon className="w-3.5 h-3.5" />
                      <span>{v.id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          v.type === 'release'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : v.type === 'snapshot'
                            ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {v.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {recommendedJava ? `Java ${recommendedJava}${recommendedJava === 8 || recommendedJava === 16 ? '' : ' (LTS)'}` : 'Check requirements'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {typeof v.releaseTime === 'string' ? v.releaseTime.substring(0, 10) : 'Unknown'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onCreateInstanceWithVersion(v.id)}
                        className="btn-play-tactile inline-flex items-center gap-1.5 px-3 py-1 text-slate-950 font-black text-xs rounded cursor-pointer font-display"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Install</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredVersions.length === 0 && (
          <div className="py-12 text-center text-xs text-slate-500">
            No versions matched your search criteria.
          </div>
        )}
      </div>
      {filteredVersions.length > 0 && (
        <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
          <span>
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredVersions.length)} of {filteredVersions.length} versions
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="btn-mc flex items-center gap-1 rounded px-3 py-2 font-bold disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <span className="font-mono">Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="btn-mc flex items-center gap-1 rounded px-3 py-2 font-bold disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
