import React, { useState } from 'react';
import {
  X,
  Download,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  User,
  Heart,
  Tag,
  Cpu,
  Package,
  Check,
  FileCode,
  Flame,
  Globe,
} from 'lucide-react';
import { MinecraftInstance } from '../../types/instance';
import { playMinecraftClickSound, playMinecraftLevelUpSound } from '../../services/soundService';

export interface UnifiedAddonItem {
  id: string | number;
  slug?: string;
  name: string;
  type: 'mod' | 'resourcepack' | 'shader' | 'datapack' | 'modpack';
  source: 'modrinth' | 'curseforge' | 'local';
  iconUrl?: string | null;
  summary: string;
  description?: string;
  author: string;
  downloads: number;
  follows?: number;
  gameVersions: string[];
  loaders?: string[];
  categories: string[];
  clientSide?: string;
  serverSide?: string;
  license?: string;
  dateModified?: string;
  websiteUrl?: string;
  dependencies?: {
    id: string;
    name: string;
    required: boolean;
    installed?: boolean;
  }[];
  versionsList?: {
    versionNumber: string;
    name: string;
    gameVersions: string[];
    loaders: string[];
    date: string;
    downloads: number;
    filename: string;
  }[];
}

interface AddonDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  addon: UnifiedAddonItem | null;
  activeInstance: MinecraftInstance | null;
  instances: MinecraftInstance[];
  onOpenInstallModal: (addon: UnifiedAddonItem, withDependencies?: boolean) => void;
}

export const AddonDetailModal: React.FC<AddonDetailModalProps> = ({
  isOpen,
  onClose,
  addon,
  activeInstance,
  instances,
  onOpenInstallModal,
}) => {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(
    activeInstance?.id ?? ''
  );
  const [activeTab, setActiveTab] = useState<'overview' | 'compatibility' | 'versions'>('overview');
  const [installWithDeps, setInstallWithDeps] = useState(true);

  if (!isOpen || !addon) return null;

  const targetInstance = instances.find((i) => i.id === selectedInstanceId) ?? null;

  // Compute Compatibility Status
  const checkCompatibility = () => {
    if (!targetInstance) {
      return { status: 'unknown', message: 'No target instance selected' };
    }

    const instanceVer = targetInstance.gameVersion;
    const instanceLoader = targetInstance.loader;

    // Check loader compatibility
    const usesModLoader = addon.type === 'mod' || addon.type === 'modpack';
    const hasLoader = usesModLoader && addon.loaders && addon.loaders.length > 0;
    const loaderMatches = !hasLoader || addon.loaders?.some((l) => l.toLowerCase() === instanceLoader.toLowerCase()) || instanceLoader === 'vanilla';

    // Check version compatibility
    const versionMatches = addon.gameVersions.some((v) => {
      if (v === instanceVer) return true;
      // Partial prefix check, e.g. 1.21.x matches 1.21.4
      const partsA = v.split('.');
      const partsB = instanceVer.split('.');
      return partsA[0] === partsB[0] && partsA[1] === partsB[1];
    });

    if (loaderMatches && versionMatches) {
      return {
        status: 'compatible',
        message: `Fully Compatible with ${targetInstance.name} (Minecraft ${instanceVer} • ${instanceLoader.toUpperCase()})`,
      };
    }

    if (!loaderMatches && versionMatches) {
      return {
        status: 'loader_mismatch',
        message: `Loader Warning: ${addon.name} requires ${addon.loaders?.join(' or ')}, but "${targetInstance.name}" is using ${instanceLoader.toUpperCase()}.`,
      };
    }

    if (loaderMatches && !versionMatches) {
      return {
        status: 'version_mismatch',
        message: `Version Warning: ${addon.name} is verified for [${addon.gameVersions.slice(0, 3).join(', ')}], while "${targetInstance.name}" runs ${instanceVer}.`,
      };
    }

    return {
      status: 'incompatible',
      message: `Incompatible Loader & Version: Needs ${addon.loaders?.join('/')} for ${addon.gameVersions.slice(0, 2).join('/')}.`,
    };
  };

  const compat = checkCompatibility();

  const isAlreadyInstalled = targetInstance
    ? addon.type === 'mod'
      ? (targetInstance.mods || []).some(
          (m) => String(m.id) === String(addon.id) || m.name.toLowerCase() === addon.name.toLowerCase()
        )
      : (targetInstance.packs || []).some(
          (p) => String(p.id) === String(addon.id) || p.name.toLowerCase() === addon.name.toLowerCase()
        )
    : false;

  const dependencies = addon.dependencies ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="card-obsidian border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="p-6 border-b border-white/10 bg-[#0a0d14] flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-4 min-w-0">
            {addon.iconUrl ? (
              <img
                src={addon.iconUrl}
                alt={addon.name}
                className="w-16 h-16 rounded-xl object-cover bg-black/50 border border-white/10 shrink-0 shadow-lg"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-emerald-950/50 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg">
                <Package className="w-8 h-8" />
              </div>
            )}

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-white font-display truncate">{addon.name}</h2>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                    addon.source === 'modrinth'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {addon.source === 'modrinth' ? 'Modrinth' : 'CurseForge'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/5 text-slate-300 border border-white/10 uppercase">
                  {addon.type}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-white font-medium">{addon.author}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{addon.downloads.toLocaleString()} downloads</span>
                </span>
                {addon.license && (
                  <>
                    <span>•</span>
                    <span className="text-slate-400">{addon.license}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              playMinecraftClickSound();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-white/5 bg-[#0d1017] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 text-xs font-bold font-display border-b-2 transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Overview & Features
            </button>
            <button
              onClick={() => setActiveTab('compatibility')}
              className={`py-3 text-xs font-bold font-display border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'compatibility'
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Compatibility & Dependencies ({dependencies.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('versions')}
              className={`py-3 text-xs font-bold font-display border-b-2 transition-all cursor-pointer ${
                activeTab === 'versions'
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Versions & Files
            </button>
          </div>

          {/* Quick Target Instance Switcher */}
          <div className="flex items-center gap-2 py-2">
            <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">Target:</span>
            <select
              value={selectedInstanceId}
              onChange={(e) => {
                playMinecraftClickSound();
                setSelectedInstanceId(e.target.value);
              }}
              className="bg-black/60 border border-white/10 text-white font-mono text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-emerald-500 max-w-[180px] truncate"
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.loader} {inst.gameVersion})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Real-time Compatibility Strip */}
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-3 ${
              compat.status === 'compatible'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : compat.status === 'loader_mismatch' || compat.status === 'version_mismatch'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {compat.status === 'compatible' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
            )}
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold font-display block">{compat.message}</span>
              <span className="text-[11px] opacity-80 font-mono block mt-0.5">
                {addon.type === 'mod' || addon.type === 'modpack'
                  ? `Supported Loaders: ${addon.loaders?.join(', ') || 'Not specified by source'} • `
                  : ''}
                Minecraft Versions: {addon.gameVersions.join(', ')}
              </span>
            </div>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Summary / Lead */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">
                  Summary
                </h4>
                <p className="text-sm text-slate-200 leading-relaxed bg-black/30 p-4 rounded-xl border border-white/5 break-anywhere">
                  {addon.summary}
                </p>
              </div>

              {/* Detailed Description */}
              {addon.description && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">
                    Detailed Overview
                  </h4>
                  <div className="text-xs text-slate-300 leading-relaxed bg-black/30 p-4 rounded-xl border border-white/5 space-y-3 break-anywhere">
                    {addon.description.split('\n\n').map((paragraph, idx) => (
                      <p key={idx}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Tags & Meta */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">
                  Tags & Categories
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {addon.categories.map((cat) => (
                    <span
                      key={cat}
                      className="px-2.5 py-1 rounded-lg text-xs bg-black/40 text-slate-300 border border-white/10 font-mono"
                    >
                      #{cat}
                    </span>
                  ))}
                  {addon.clientSide && (
                    <span className="px-2.5 py-1 rounded-lg text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                      Client: {addon.clientSide}
                    </span>
                  )}
                  {addon.serverSide && (
                    <span className="px-2.5 py-1 rounded-lg text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
                      Server: {addon.serverSide}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'compatibility' && (
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">
                  Dependencies reported by source ({dependencies.length})
                </h4>
                {dependencies.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No dependency information was provided by the source.</p>
                ) : (
                  <div className="space-y-2">
                    {dependencies.map((dep) => (
                      <div
                        key={dep.id}
                        className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white font-display">{dep.name}</span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                  dep.required
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                    : 'bg-slate-500/20 text-slate-300'
                                }`}
                              >
                                {dep.required ? 'REQUIRED' : 'OPTIONAL'}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              Mod identifier: {dep.id}
                            </span>
                          </div>
                        </div>

                        <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                          Auto-bundled on Install
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Install with Dependencies Checkbox */}
              {dependencies.length > 0 && (
                <label className="p-3 rounded-xl bg-[#0e131d] border border-emerald-500/30 flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={installWithDeps}
                    onChange={(e) => setInstallWithDeps(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-black/60 border-white/20 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-white block font-display">
                      Automatically install dependencies reported by the source ({dependencies.length})
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      Ensures {addon.name} starts properly without game crashes on launch.
                    </span>
                  </div>
                </label>
              )}
            </div>
          )}

          {activeTab === 'versions' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                Verified Compatible Releases
              </h4>
              <div className="space-y-2">
                {addon.gameVersions.map((ver) => (
                  <div
                    key={ver}
                    className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono">Minecraft {ver}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                        <span>MC {ver}</span>
                        <span>•</span>
                        {(addon.type === 'mod' || addon.type === 'modpack') && (
                          <>
                            <span>{addon.loaders?.join(', ') || 'Loader not specified'}</span>
                            <span>•</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        playMinecraftClickSound();
                        onOpenInstallModal(addon, installWithDeps);
                        onClose();
                      }}
                      className="btn-mc btn-mc-diamond px-3 py-1.5 text-xs font-bold text-white rounded cursor-pointer"
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#0a0d14] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {addon.websiteUrl && (
              <a
                href={addon.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View on Web</span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                playMinecraftClickSound();
                onClose();
              }}
              className="btn-mc px-4 py-2 text-xs font-bold text-slate-300 rounded cursor-pointer font-display"
            >
              Close
            </button>

            <button
              type="button"
              onClick={() => {
                playMinecraftClickSound();
                onOpenInstallModal(addon, installWithDeps);
                onClose();
              }}
              className={`btn-mc flex items-center gap-2 px-6 py-2 font-black text-xs rounded cursor-pointer font-display text-white ${
                addon.source === 'curseforge' ? 'btn-mc-amber' : 'btn-mc-green'
              }`}
              disabled={!targetInstance}
            >
              <Download className="w-4 h-4" />
              <span>
                {isAlreadyInstalled ? 'Reinstall Addon' : targetInstance ? `Install to ${targetInstance.name}` : 'Select an instance'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
