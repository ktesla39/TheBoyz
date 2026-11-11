import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Check,
  Upload,
  Image as ImageIcon,
  Sliders,
  Cpu,
  Monitor,
  Sparkles,
  Layers,
  Palette,
  Search,
  RefreshCw,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import {
  MinecraftInstance,
  ModLoaderType,
  GraphicsApiType,
} from '../../types/instance';
import { InstanceCircleLogo, INSTANCE_ICON_PRESETS } from './InstanceCircleLogo';
import {
  fetchMojangVersionManifest,
  getRecommendedJavaVersion,
} from '../../services/mojangApi';
import { MojangVersionManifest, MojangVersionManifestEntry } from '../../types/launcher';
import { playMinecraftClickSound, playMinecraftLevelUpSound } from '../../services/soundService';

interface EditInstanceModalProps {
  instance: MinecraftInstance;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: MinecraftInstance) => void;
}

export const EditInstanceModal: React.FC<EditInstanceModalProps> = ({
  instance,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(instance.name);
  const [loader, setLoader] = useState<ModLoaderType>(instance.loader);
  const [gameVersion, setGameVersion] = useState(instance.gameVersion);
  const [icon, setIcon] = useState<string | undefined>(instance.icon);
  const [graphicsApi, setGraphicsApi] = useState<GraphicsApiType>(instance.graphicsApi || 'auto');
  const [maxMemoryMb, setMaxMemoryMb] = useState<number>(instance.javaConfig.maxMemoryMb || 4096);
  const [minMemoryMb, setMinMemoryMb] = useState<number>(instance.javaConfig.minMemoryMb || 2048);
  const [customIconUrl, setCustomIconUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Official Mojang Manifest State
  const [manifest, setManifest] = useState<MojangVersionManifest | null>(null);
  const [isLoadingManifest, setIsLoadingManifest] = useState(false);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [versionTypeFilter, setVersionTypeFilter] = useState<'release' | 'snapshot' | 'all'>('release');
  const [versionSearchQuery, setVersionSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoadingManifest(true);
    setManifestError(null);

    fetchMojangVersionManifest()
      .then((data) => {
        if (!cancelled) setManifest(data);
      })
      .catch((err) => {
        if (!cancelled) setManifestError(err instanceof Error ? err.message : 'Could not fetch versions.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingManifest(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Filter official versions
  const filteredVersions = useMemo(() => {
    if (!manifest) return [];
    let list = manifest.versions;

    if (versionTypeFilter === 'release') {
      list = list.filter((v) => v.type === 'release');
    } else if (versionTypeFilter === 'snapshot') {
      list = list.filter((v) => v.type === 'snapshot');
    }

    if (versionSearchQuery.trim()) {
      const q = versionSearchQuery.trim().toLowerCase();
      list = list.filter((v) => v.id.toLowerCase().includes(q));
    }

    return list;
  }, [manifest, versionTypeFilter, versionSearchQuery]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setIcon(result);
      playMinecraftLevelUpSound();
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomUrl = () => {
    if (customIconUrl.trim()) {
      setIcon(customIconUrl.trim());
      setCustomIconUrl('');
      playMinecraftClickSound();
    }
  };

  const handleSave = () => {
    playMinecraftClickSound();
    const recommendedJava = getRecommendedJavaVersion(gameVersion) ?? instance.javaConfig.version;
    const updated: MinecraftInstance = {
      ...instance,
      name: name.trim() || instance.name,
      loader,
      gameVersion: gameVersion || instance.gameVersion,
      icon: icon || 'grass_block',
      graphicsApi,
      javaConfig: {
        ...instance.javaConfig,
        version: recommendedJava,
        maxMemoryMb: Number(maxMemoryMb) || 4096,
        minMemoryMb: Number(minMemoryMb) || 2048,
      },
    };
    onSave(updated);
    playMinecraftLevelUpSound();
    onClose();
  };

  const recommendedJava = getRecommendedJavaVersion(gameVersion);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col card-obsidian rounded-2xl border-2 border-white/20 shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-black/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <InstanceCircleLogo loader={loader} icon={icon} size="lg" />
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-white font-display truncate">
                Configure {instance.name}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Choose official Minecraft versions, customize artwork, mod loader, and engine settings.
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

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* 1. Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white font-display block">
              Instance Profile Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Survival SMP, Modded World..."
              className="w-full px-3 py-2 text-xs bg-black/60 border border-white/15 rounded-lg text-white font-mono focus:outline-none focus:border-[var(--mc-accent)]"
            />
          </div>

          {/* 2. Official Minecraft Version Picker (From Mojang Manifest) */}
          <div className="space-y-2 p-3.5 rounded-xl bg-black/40 border border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-white font-display block flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Official Minecraft Version</span>
                  {manifest && (
                    <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.2 rounded border border-emerald-500/30">
                      Verified Mojang Manifest
                    </span>
                  )}
                </label>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Select an official release or snapshot directly from Mojang&apos;s version manifest.
                </p>
              </div>

              {/* Version Type Toggle (Releases vs Snapshots) */}
              <div className="flex items-center gap-1 p-0.5 bg-black/60 border border-white/10 rounded-lg text-[10px] font-mono shrink-0">
                {(['release', 'snapshot', 'all'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      playMinecraftClickSound();
                      setVersionTypeFilter(t);
                    }}
                    className={`btn-mc px-2 py-0.5 rounded cursor-pointer capitalize font-bold ${
                      versionTypeFilter === t
                        ? 'btn-mc-green text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t === 'release' ? 'Releases' : t === 'snapshot' ? 'Snapshots' : 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Version Search & Select */}
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={versionSearchQuery}
                  onChange={(e) => setVersionSearchQuery(e.target.value)}
                  placeholder="Filter versions (e.g. 1.21.4, 1.20.1, 1.16.5)..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-black/70 border border-white/15 rounded-lg text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[var(--mc-accent)]"
                />
              </div>

              {isLoadingManifest ? (
                <div className="flex items-center justify-center gap-2 py-4 text-xs font-mono text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Loading official Minecraft versions from Mojang...</span>
                </div>
              ) : manifestError ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs font-mono text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{manifestError}</span>
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/60 p-1 space-y-1">
                  {filteredVersions.slice(0, 80).map((v) => {
                    const isSelected = gameVersion === v.id;
                    const isLatestRelease = manifest?.latest.release === v.id;
                    const isLatestSnapshot = manifest?.latest.snapshot === v.id;
                    const releaseDate = v.releaseTime ? new Date(v.releaseTime).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : '';

                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          playMinecraftClickSound();
                          setGameVersion(v.id);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-left text-xs font-mono transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/25 border border-emerald-500/50 text-white font-bold shadow-sm'
                            : 'hover:bg-white/10 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                          <span className="truncate">{v.id}</span>
                          {isLatestRelease && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 shrink-0">
                              Latest Release
                            </span>
                          )}
                          {isLatestSnapshot && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-purple-500/30 text-purple-300 border border-purple-500/40 shrink-0">
                              Latest Snapshot
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-500 shrink-0">
                          {releaseDate && <span>{releaseDate}</span>}
                          <span className="uppercase text-slate-400">{v.type}</span>
                        </div>
                      </button>
                    );
                  })}
                  {filteredVersions.length === 0 && (
                    <div className="py-3 text-center text-xs font-mono text-slate-500">
                      No matching versions found in Mojang manifest.
                    </div>
                  )}
                </div>
              )}

              {/* Selected version display & Java recommendation */}
              <div className="flex items-center justify-between text-xs font-mono pt-1 text-slate-400">
                <span>
                  Selected: <strong className="text-emerald-300">{gameVersion || 'None'}</strong>
                </span>
                {recommendedJava !== null && (
                  <span className="text-emerald-400">
                    Auto-configures Java {recommendedJava}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3. Custom Icon Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white font-display flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-[var(--mc-accent)]" />
                <span>Instance Icon &amp; Artwork</span>
              </label>
              {icon && (
                <button
                  type="button"
                  onClick={() => {
                    playMinecraftClickSound();
                    setIcon(undefined);
                  }}
                  className="text-[11px] font-mono text-slate-400 hover:text-rose-400 underline cursor-pointer"
                >
                  Reset to loader badge
                </button>
              )}
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {INSTANCE_ICON_PRESETS.map((preset) => {
                const isSelected = icon === preset.id || (!icon && preset.id === 'loader');
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      playMinecraftClickSound();
                      setIcon(preset.id === 'loader' ? undefined : preset.id);
                    }}
                    className={`btn-mc p-2 rounded-lg flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'btn-mc-green ring-2 ring-white scale-105'
                        : 'hover:border-white/30'
                    }`}
                    title={preset.name}
                  >
                    <InstanceCircleLogo loader={loader} icon={preset.id} size="sm" />
                    <span className="text-[9px] font-mono truncate max-w-full text-slate-200">
                      {preset.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Upload Custom Image / URL */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-mc flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-slate-200 rounded cursor-pointer font-display"
              >
                <Upload className="w-3.5 h-3.5 text-[var(--mc-accent)]" />
                <span>Upload Custom Image</span>
              </button>

              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="text"
                  value={customIconUrl}
                  onChange={(e) => setCustomIconUrl(e.target.value)}
                  placeholder="Or paste image URL (https://...)"
                  className="flex-1 px-3 py-1.5 text-xs bg-black/60 border border-white/15 rounded-lg text-white font-mono focus:outline-none focus:border-[var(--mc-accent)]"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomUrl}
                  disabled={!customIconUrl.trim()}
                  className="btn-mc px-3 py-1.5 text-xs text-white font-bold rounded cursor-pointer font-display disabled:opacity-40"
                >
                  Set
                </button>
              </div>
            </div>
          </div>

          {/* 4. Mod Loader */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white font-display block">
              Mod Loader
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(['vanilla', 'fabric', 'forge', 'neoforge', 'quilt'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    playMinecraftClickSound();
                    setLoader(l);
                  }}
                  className={`btn-mc py-2 px-2 rounded-lg text-xs font-mono font-bold uppercase cursor-pointer ${
                    loader === l
                      ? 'btn-mc-green text-white shadow-sm ring-1 ring-white/60'
                      : 'text-slate-300'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Graphics & RAM */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/10">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white font-display flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-[var(--mc-accent)]" />
                <span>Graphics Engine API</span>
              </label>
              <select
                value={graphicsApi}
                onChange={(e) => setGraphicsApi(e.target.value as GraphicsApiType)}
                className="select-mc w-full text-xs font-mono py-2 px-3"
              >
                <option value="auto">Auto-detect system best</option>
                <option value="vulkan">Vulkan (VulkanMod acceleration)</option>
                <option value="opengl">OpenGL (Classic Minecraft)</option>
                <option value="directx12">DirectX 12 / D3D12 Translation</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-display">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[var(--mc-accent)]" />
                  <span>Max Memory (RAM)</span>
                </span>
                <span className="font-mono text-emerald-400 font-bold">{maxMemoryMb} MB</span>
              </div>
              <input
                type="range"
                min={1024}
                max={16384}
                step={512}
                value={maxMemoryMb}
                onChange={(e) => setMaxMemoryMb(Number(e.target.value))}
                className="w-full accent-[var(--mc-accent)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>1 GB</span>
                <span>4 GB</span>
                <span>8 GB</span>
                <span>16 GB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-white/10 bg-black/40 shrink-0">
          <button
            type="button"
            onClick={() => {
              playMinecraftClickSound();
              onClose();
            }}
            className="btn-mc px-4 py-2 text-xs font-bold text-slate-300 rounded cursor-pointer font-display"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="btn-mc btn-mc-green flex items-center gap-2 px-6 py-2 text-xs font-bold text-white rounded cursor-pointer font-display shadow-lg"
          >
            <Check className="w-4 h-4" />
            <span>Save Instance Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
