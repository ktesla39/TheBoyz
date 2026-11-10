import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Upload,
  Sparkles,
  FolderOpen,
  Terminal,
  Cpu,
  Monitor,
  Zap,
  Shield,
  Layers,
  Wrench,
  Search,
  Shuffle,
} from 'lucide-react';
import { MinecraftInstance, ModLoaderType, GraphicsApiType, JavaConfig } from '../../types/instance';
import { fetchMojangVersionManifest, getRecommendedJavaVersion } from '../../services/mojangApi';
import { MojangVersionManifest } from '../../types/launcher';
import {
  GrassBlockIcon,
  CraftingTableIcon,
  DiamondSwordIcon,
  PickaxeIcon,
  EnderEyeIcon,
  NetheriteIngotIcon,
  CreeperFaceIcon,
  RamChipIcon,
} from '../icons/MinecraftIcons';
import { playMinecraftClickSound, playMinecraftLevelUpSound } from '../../services/soundService';

interface CreateInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstanceCreated: (instance: MinecraftInstance) => void;
}

export const INSTANCE_ICON_PRESETS = [
  { id: 'diamond_sword', label: 'Sword', icon: DiamondSwordIcon },
  { id: 'crafting_table', label: 'Crafting', icon: CraftingTableIcon },
  { id: 'grass_block', label: 'Grass', icon: GrassBlockIcon },
  { id: 'pickaxe', label: 'Pickaxe', icon: PickaxeIcon },
  { id: 'ender_eye', label: 'Ender Eye', icon: EnderEyeIcon },
  { id: 'netherite_ingot', label: 'Netherite', icon: NetheriteIngotIcon },
  { id: 'creeper', label: 'Creeper', icon: CreeperFaceIcon },
  { id: 'redstone', label: 'Redstone', icon: RamChipIcon },
];

const RANDOM_NAMES = [
  'Speedrun Odyssey',
  'Netherite Citadel',
  'Cobblestone Kingdom',
  'Aetherial Skies',
  'Redstone Automation',
  'Hardcore Survival S4',
  'Vanilla Plus Chill',
  'Shader Cinematic SMP',
  'Tech Horizons',
  'Hypixel PvP Arena',
];

type ModalTab = 'essentials' | 'directory' | 'java' | 'display';

export const CreateInstanceModal: React.FC<CreateInstanceModalProps> = ({
  isOpen,
  onClose,
  onInstanceCreated,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('essentials');

  // Basic Configuration
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('diamond_sword');
  const [customIconDataUrl, setCustomIconDataUrl] = useState<string | null>(null);
  const [gameVersion, setGameVersion] = useState('');
  const [loader, setLoader] = useState<ModLoaderType>('vanilla');
  const [loaderVersion, setLoaderVersion] = useState('');
  const [versionSearch, setVersionSearch] = useState('');

  // Custom Directory Configuration
  const [useCustomDir, setUseCustomDir] = useState(false);
  const [customGameDir, setCustomGameDir] = useState('');

  // Java & JVM Configuration
  const [javaVersion, setJavaVersion] = useState(21);
  const [minRamMb, setMinRamMb] = useState(2048);
  const [maxRamMb, setMaxRamMb] = useState(4096);
  const [garbageCollector, setGarbageCollector] = useState<JavaConfig['garbageCollector']>('G1GC');
  const [customJvmArgs, setCustomJvmArgs] = useState(
    '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch'
  );

  // Display & Graphics Configuration
  const [graphicsApi, setGraphicsApi] = useState<GraphicsApiType>('opengl');
  const [resolutionPreset, setResolutionPreset] = useState<'1080p' | '1440p' | '720p' | 'custom'>('1080p');
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [fullscreen, setFullscreen] = useState(false);

  // Versions manifest
  const [manifest, setManifest] = useState<MojangVersionManifest | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [manifestRequestId, setManifestRequestId] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingVersions(true);
    setManifestError(null);
    fetchMojangVersionManifest()
      .then((m) => {
        if (cancelled) return;
        setManifest(m);
        setGameVersion(m.latest.release);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setManifestError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setLoadingVersions(false);
      });
    setName('');
      setSelectedIcon('diamond_sword');
      setCustomIconDataUrl(null);
      setGameVersion('');
      setLoader('vanilla');
      setLoaderVersion('');
      setUseCustomDir(false);
      setCustomGameDir('');
      setMinRamMb(2048);
      setMaxRamMb(4096);
      setJavaVersion(21);
      setCustomJvmArgs(
        '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch'
      );
      setActiveTab('essentials');
    return () => {
      cancelled = true;
    };
  }, [isOpen, manifestRequestId]);

  // Sync recommended Java when game version changes
  useEffect(() => {
    if (!gameVersion) return;
    const recJava = getRecommendedJavaVersion(gameVersion);
    if (recJava !== null) setJavaVersion(recJava);
  }, [gameVersion]);

  // Quick preset template applicator
  const applyStarterTemplate = (type: 'performance' | 'vanilla' | 'tech' | 'pvp') => {
    playMinecraftClickSound();
    const latestRelease = manifest?.latest.release;
    if (!latestRelease) {
      setManifestError('Load the official Minecraft version manifest before applying a starter template.');
      return;
    }
    if (type === 'performance') {
      setName('Fabric Performance Engine');
      setLoader('fabric');
      setGameVersion(latestRelease);
      setLoaderVersion('');
      setSelectedIcon('diamond_sword');
      setMaxRamMb(4096);
      setMinRamMb(2048);
      setGarbageCollector('G1GC');
      setCustomJvmArgs(
        '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch'
      );
    } else if (type === 'vanilla') {
      setName('Pure Vanilla');
      setLoader('vanilla');
      setGameVersion(latestRelease);
      setSelectedIcon('grass_block');
      setMaxRamMb(3072);
      setMinRamMb(1024);
      setGarbageCollector('G1GC');
      setCustomJvmArgs('-XX:+UseG1GC -XX:+ParallelRefProcEnabled');
    } else if (type === 'tech') {
      setName('NeoForge Automation Factory');
      setLoader('neoforge');
      setLoaderVersion('');
      setGameVersion(latestRelease);
      setSelectedIcon('crafting_table');
      setMaxRamMb(6144);
      setMinRamMb(3072);
      setGarbageCollector('G1GC');
      setCustomJvmArgs(
        '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=250 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC'
      );
    } else if (type === 'pvp') {
      setName('Competitive PvP Arena');
      setLoader('fabric');
      setGameVersion(latestRelease);
      setLoaderVersion('');
      setSelectedIcon('ender_eye');
      setMaxRamMb(4096);
      setMinRamMb(2048);
      setGarbageCollector('Shenandoah');
      setCustomJvmArgs('-XX:+UseShenandoahGC -XX:ShenandoahGCMode=iu -XX:ShenandoahGCHeuristics=adaptive');
    }
  };

  const handleRandomizeName = () => {
    playMinecraftClickSound();
    const random = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    setName(random);
  };

  const handleCustomIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCustomIconDataUrl(ev.target?.result as string);
      setSelectedIcon('custom');
      playMinecraftClickSound();
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loadingVersions || !manifest || !gameVersion) {
      setManifestError('A Minecraft version from the official manifest is required to create an instance.');
      return;
    }
    playMinecraftLevelUpSound();

    const parsedJvmArgs = customJvmArgs.trim().split(/\s+/).filter(Boolean);

    const newInst: MinecraftInstance = {
      id: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim() || `Minecraft ${gameVersion}`,
      icon: customIconDataUrl || selectedIcon,
      gameVersion,
      loader,
      loaderVersion: loaderVersion.trim() || undefined,
      graphicsApi,
      customGameDir: useCustomDir && customGameDir.trim() ? customGameDir.trim() : undefined,
      javaConfig: {
        path: '',
        version: javaVersion,
        minMemoryMb: minRamMb,
        maxMemoryMb: maxRamMb,
        jvmArguments: parsedJvmArgs,
        garbageCollector,
      },
      resolution: {
        width,
        height,
        fullscreen,
      },
      mods: [],
      packs: [],
      worlds: [],
      screenshots: [],
      backups: [],
      createdAt: Date.now(),
      totalPlayTimeMinutes: 0,
    };

    onInstanceCreated(newInst);
    onClose();
  };

  if (!isOpen) return null;

  const rawReleases = manifest?.versions.filter((v) => v.type === 'release') ?? [];

  const filteredVersions = rawReleases.filter((v) =>
    versionSearch ? v.id.toLowerCase().includes(versionSearch.toLowerCase()) : true
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 select-none">
      <div className="card-obsidian border border-white/10 rounded-2xl w-full max-w-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#0a0d14] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <GrassBlockIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white font-display tracking-tight flex items-center gap-2">
                <span>Create Minecraft Instance</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Advanced Cockpit
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Custom directories, isolated profiles, JVM arguments, and mod loaders.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              playMinecraftClickSound();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Starter Presets Bar */}
        <div className="px-6 py-2.5 bg-black/40 border-b border-white/5 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold shrink-0 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Starters:</span>
          </span>
          <button
            type="button"
            onClick={() => applyStarterTemplate('performance')}
            className="btn-mc btn-mc-diamond px-2.5 py-1 text-[11px] font-bold text-white rounded cursor-pointer shrink-0 truncate"
          >
            ⚡ Fabric Performance
          </button>
          <button
            type="button"
            onClick={() => applyStarterTemplate('vanilla')}
            className="btn-mc btn-mc-green px-2.5 py-1 text-[11px] font-bold text-white rounded cursor-pointer shrink-0 truncate"
          >
            🛡️ Pure Vanilla
          </button>
          <button
            type="button"
            onClick={() => applyStarterTemplate('tech')}
            className="btn-mc btn-mc-amber px-2.5 py-1 text-[11px] font-bold text-white rounded cursor-pointer shrink-0 truncate"
          >
            ⚙️ NeoForge Tech
          </button>
          <button
            type="button"
            onClick={() => applyStarterTemplate('pvp')}
            className="btn-mc px-2.5 py-1 text-[11px] font-bold text-slate-200 rounded cursor-pointer shrink-0 truncate"
          >
            ⚔️ PvP Competitive
          </button>
        </div>

        {/* Tab Navigation Navigation */}
        <div className="px-6 pt-3 border-b border-white/5 bg-[#080b11] flex items-center gap-1 shrink-0 overflow-x-auto">
          {[
            { id: 'essentials', label: '1. Essentials', icon: Layers },
            { id: 'directory', label: '2. Custom Directory', icon: FolderOpen },
            { id: 'java', label: '3. Java & JVM Arguments', icon: Terminal },
            { id: 'display', label: '4. Resolution & Graphics', icon: Monitor },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  playMinecraftClickSound();
                  setActiveTab(tab.id as ModalTab);
                }}
                className={`px-3.5 py-2 text-xs font-bold font-display rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 border-b-2 shrink-0 ${
                  isActive
                    ? 'border-emerald-400 bg-white/5 text-emerald-300'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {manifestError && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <span>{manifestError}</span>
              <button
                type="button"
                onClick={() => setManifestRequestId((id) => id + 1)}
                className="btn-play-tactile shrink-0 rounded px-3 py-1 text-slate-950"
              >
                Retry
              </button>
            </div>
          )}
          {/* =========================================================
              TAB 1: ESSENTIALS (Name, Icon, Version, Loader)
              ========================================================= */}
          {activeTab === 'essentials' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Instance Name with Randomizer */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 font-display">
                    Instance Name <span className="text-emerald-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleRandomizeName}
                    className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Random Name</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (useCustomDir) {
                      const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_');
                      setCustomGameDir(`/home/user/.minecraft/instances/${slug}`);
                    }
                  }}
                  placeholder="e.g. Speedrun S4, Fabric Shader Pack, Hardcore World"
                  className="w-full px-3.5 py-2.5 text-xs bg-black/50 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>

              {/* Badge Icon Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 font-display">
                    Instance Badge Icon
                  </label>
                  <label className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>Upload Custom Image</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleCustomIconUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-2 bg-black/40 rounded-xl border border-white/10">
                  {INSTANCE_ICON_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const isSelected = selectedIcon === preset.id && !customIconDataUrl;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          playMinecraftClickSound();
                          setSelectedIcon(preset.id);
                          setCustomIconDataUrl(null);
                        }}
                        className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/20 border border-emerald-500/50 text-white shadow-sm ring-1 ring-emerald-500/40'
                            : 'hover:bg-white/5 text-slate-400 border border-transparent'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-[9px] font-mono truncate">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>

                {customIconDataUrl && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                    <img
                      src={customIconDataUrl}
                      alt="Custom icon"
                      className="w-7 h-7 rounded-lg object-cover border border-white/10"
                    />
                    <span className="font-mono text-[11px] truncate">Custom icon badge uploaded successfully</span>
                  </div>
                )}
              </div>

              {/* Game Version Picker with Search */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 font-display">
                      Minecraft Version
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      {loadingVersions ? 'Loading...' : `${filteredVersions.length} Releases`}
                    </span>
                  </div>

                  <div className="relative mb-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={versionSearch}
                      onChange={(e) => setVersionSearch(e.target.value)}
                      placeholder="Search versions (e.g. 1.21, 1.20)..."
                      className="w-full pl-8 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <select
                    value={gameVersion}
                    disabled={loadingVersions || filteredVersions.length === 0}
                    onChange={(e) => {
                      playMinecraftClickSound();
                      setGameVersion(e.target.value);
                    }}
                    className="w-full px-3 py-2 text-xs bg-black/50 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {filteredVersions.slice(0, 40).map((v) => (
                      <option key={v.id} value={v.id} className="bg-[#121622] text-white">
                        Release {v.id}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mod Loader Engine */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 font-display">
                    Mod Loader Engine
                  </label>
                  <select
                    value={loader}
                    onChange={(e) => {
                      playMinecraftClickSound();
                      const val = e.target.value as ModLoaderType;
                      setLoader(val);
                      setLoaderVersion('');
                    }}
                    className="w-full px-3 py-2 text-xs bg-black/50 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500 uppercase cursor-pointer"
                  >
                    <option value="fabric" className="bg-[#121622] text-white">Fabric (Sodium &amp; Iris Ready)</option>
                    <option value="neoforge" className="bg-[#121622] text-white">NeoForge (Modern 1.20.4+ Ecosystem)</option>
                    <option value="forge" className="bg-[#121622] text-white">Forge (Legacy &amp; Classic Mods)</option>
                    <option value="vanilla" className="bg-[#121622] text-white">Vanilla (Official Pure Mojang)</option>
                    <option value="quilt" className="bg-[#121622] text-white">Quilt (Modular Toolchain)</option>
                  </select>

                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-[11px] font-mono text-slate-400">
                    {loader === 'fabric' && '✓ Ultra-fast launch times, lightweight, perfect for Sodium/Iris.'}
                    {loader === 'neoforge' && '✓ Official successor to Forge for modern Minecraft 1.20.2+.'}
                    {loader === 'forge' && '✓ Classic heavyweight mod loader with hundreds of thousands of mods.'}
                    {loader === 'vanilla' && '✓ Pure Mojang game files without any mod injection framework.'}
                    {loader === 'quilt' && '✓ Compatible with almost all Fabric mods plus Quilt standard libraries.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 2: CUSTOM DIRECTORY & SANDBOX ISOLATION
              ========================================================= */}
          {activeTab === 'directory' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/30 to-black border border-emerald-500/20 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold font-display text-sm">
                  <FolderOpen className="w-4 h-4" />
                  <span>Isolated Game Directory &amp; Portability</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-mono">
                  Keep worlds, configs, options.txt, resource packs, and mods totally independent from other Minecraft profiles.
                  You can even place this on a secondary SSD, USB drive, or custom drive path.
                </p>
              </div>

              {/* Enable Custom Directory Toggle */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomDir}
                    onChange={(e) => {
                      playMinecraftClickSound();
                      setUseCustomDir(e.target.checked);
                    }}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-white font-display">
                      Use Custom Directory for Game Files
                    </span>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Overrides the default launcher path with your specified custom directory.
                    </p>
                  </div>
                </label>

                {useCustomDir && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <label className="block text-xs font-bold text-slate-300 font-display">
                      Custom Directory Path
                    </label>
                    <input
                      type="text"
                      value={customGameDir}
                      onChange={(e) => setCustomGameDir(e.target.value)}
                      placeholder="/home/user/.minecraft/instances/my_pack"
                      className="w-full px-3 py-2 text-xs bg-black/50 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                    />

                    {/* Quick Path Presets */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Quick Presets:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'instance';
                          setCustomGameDir(`/home/user/.minecraft/instances/${slug}`);
                        }}
                        className="btn-mc px-2 py-0.5 text-[10px] font-mono text-slate-300 rounded cursor-pointer"
                      >
                        Default Isolated
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'instance';
                          setCustomGameDir(`D:/MinecraftInstances/${slug}`);
                        }}
                        className="btn-mc px-2 py-0.5 text-[10px] font-mono text-slate-300 rounded cursor-pointer"
                      >
                        Secondary SSD (D:)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'instance';
                          setCustomGameDir(`/media/usb/MinecraftPortable/${slug}`);
                        }}
                        className="btn-mc px-2 py-0.5 text-[10px] font-mono text-slate-300 rounded cursor-pointer"
                      >
                        Portable USB
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 3: JAVA & JVM ARGUMENTS
              ========================================================= */}
          {activeTab === 'java' && (
            <div className="space-y-4 animate-in fade-in">
              {/* RAM Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-black/40 border border-white/10">
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-300 font-display mb-1">
                    <span>Minimum Memory (-Xms)</span>
                    <span className="font-mono text-emerald-400">{minRamMb} MB ({Math.round((minRamMb / 1024) * 10) / 10} GB)</span>
                  </div>
                  <input
                    type="range"
                    min={512}
                    max={8192}
                    step={256}
                    value={minRamMb}
                    onChange={(e) => setMinRamMb(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-300 font-display mb-1">
                    <span>Maximum Memory (-Xmx)</span>
                    <span className="font-mono text-emerald-400">{maxRamMb} MB ({Math.round((maxRamMb / 1024) * 10) / 10} GB)</span>
                  </div>
                  <input
                    type="range"
                    min={1024}
                    max={16384}
                    step={512}
                    value={maxRamMb}
                    onChange={(e) => setMaxRamMb(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Java Version & Garbage Collector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 font-display mb-1">
                    Java Runtime Version
                  </label>
                  <select
                    value={javaVersion}
                    onChange={(e) => setJavaVersion(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-black/50 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value={21}>Java 21 LTS (Recommended for 1.20.5+)</option>
                    <option value={17}>Java 17 LTS (Required for 1.18 - 1.20.4)</option>
                    <option value={8}>Java 8 Legacy (Required for 1.12.2, 1.8.9)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 font-display mb-1">
                    Garbage Collector Engine
                  </label>
                  <select
                    value={garbageCollector}
                    onChange={(e) => setGarbageCollector(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-black/50 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="G1GC">G1GC (Standard Balanced GC)</option>
                    <option value="ZGC">ZGC (Ultra-Low Latency &lt;1ms Pauses)</option>
                    <option value="Shenandoah">Shenandoah (Real-Time Ultra-Low Pause)</option>
                    <option value="ParallelGC">ParallelGC (High Throughput)</option>
                  </select>
                </div>
              </div>

              {/* JVM Arguments Preset Buttons */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 font-display">
                  JVM Argument Presets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      label: "Aikar's Flags (Best FPS)",
                      args: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch',
                      style: 'btn-mc-green',
                    },
                    {
                      label: 'Low-RAM Budget PC',
                      args: '-XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:+ParallelRefProcEnabled -XX:+UseStringDeduplication',
                      style: 'btn-mc-diamond',
                    },
                    {
                      label: 'Shenandoah Low-Lag',
                      args: '-XX:+UseShenandoahGC -XX:ShenandoahGCMode=iu -XX:ShenandoahGCHeuristics=adaptive',
                      style: 'btn-mc-purple',
                    },
                    {
                      label: 'Pure Mojang Default',
                      args: '-XX:+UseG1GC',
                      style: 'btn-mc',
                    },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        playMinecraftClickSound();
                        setCustomJvmArgs(p.args);
                      }}
                      className={`btn-mc ${p.style} py-1.5 px-2 text-[10px] font-bold text-white rounded cursor-pointer truncate`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom JVM Arguments Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 font-display flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Custom JVM Arguments</span>
                </label>
                <textarea
                  value={customJvmArgs}
                  onChange={(e) => setCustomJvmArgs(e.target.value)}
                  rows={3}
                  placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled ..."
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500 break-anywhere"
                />
                <p className="text-[11px] text-slate-400 font-mono">
                  Supplied directly to the Java Virtual Machine process during Minecraft launch.
                </p>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 4: RESOLUTION & GRAPHICS API
              ========================================================= */}
          {activeTab === 'display' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Graphics API Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 font-display">
                  Rendering Graphics API Backend
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'opengl', label: 'OpenGL (Native)' },
                    { id: 'vulkan', label: 'Vulkan (Fast)' },
                    { id: 'directx12', label: 'DirectX 12' },
                    { id: 'auto', label: 'Auto Hardware' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        playMinecraftClickSound();
                        setGraphicsApi(g.id as GraphicsApiType);
                      }}
                      className={`py-2 px-2 rounded-xl text-xs font-mono font-bold uppercase transition-all cursor-pointer border ${
                        graphicsApi === g.id
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-sm'
                          : 'border-white/10 bg-black/40 text-slate-400 hover:text-white'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution Controls */}
              <div className="space-y-2 p-4 rounded-xl bg-black/40 border border-white/10">
                <label className="block text-xs font-bold text-slate-300 font-display">
                  Window Resolution
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { id: '1080p', label: '1080p (1920x1080)', w: 1920, h: 1080 },
                    { id: '1440p', label: '1440p (2560x1440)', w: 2560, h: 1440 },
                    { id: '720p', label: '720p (1280x720)', w: 1280, h: 720 },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        playMinecraftClickSound();
                        setResolutionPreset(r.id as any);
                        setWidth(r.w);
                        setHeight(r.h);
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        resolutionPreset === r.id
                          ? 'btn-mc btn-mc-green text-white shadow-sm'
                          : 'bg-black/50 text-slate-400 hover:text-white border border-white/5'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Width (px)</label>
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-black/50 border border-white/10 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Height (px)</label>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-black/50 border border-white/10 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fullscreen}
                      onChange={(e) => setFullscreen(e.target.checked)}
                      className="accent-emerald-500 rounded cursor-pointer"
                    />
                    <span>Launch in Fullscreen mode by default</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions & Summary */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
            <div className="text-[11px] font-mono text-slate-400 truncate">
              Ready: <strong className="text-white">{name || 'New Instance'}</strong> • MC {gameVersion} • {loader.toUpperCase()} • {maxRamMb}MB
              {useCustomDir && <span className="text-emerald-400 ml-1">• Custom Dir</span>}
            </div>

            <div className="flex items-center gap-2.5 justify-end">
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
                type="submit"
                disabled={loadingVersions || !manifest || !gameVersion}
                className="btn-mc btn-mc-green flex items-center gap-2 px-6 py-2 text-white font-black text-xs rounded cursor-pointer font-display shadow-lg disabled:opacity-40"
              >
                <Check className="w-4 h-4" />
                <span>Create Instance</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
