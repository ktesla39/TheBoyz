import React, { useEffect, useState } from 'react';
import {
  X,
  Check,
  Plus,
  Download,
  Sparkles,
  FolderDown,
  ShieldCheck,
  AlertTriangle,
  Layers,
  ArrowRight,
  HardDrive,
} from 'lucide-react';
import { MinecraftInstance, InstalledMod, InstalledPack, ModLoaderType } from '../../types/instance';
import { UnifiedAddonItem } from './AddonDetailModal';
import { playMinecraftClickSound, playMinecraftLevelUpSound } from '../../services/soundService';
import {
  DiamondSwordIcon,
  CraftingTableIcon,
  GrassBlockIcon,
  PickaxeIcon,
  EnderEyeIcon,
  NetheriteIngotIcon,
  CreeperFaceIcon,
  RamChipIcon,
} from '../icons/MinecraftIcons';

interface AddonInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  addon: UnifiedAddonItem | null;
  instances: MinecraftInstance[];
  activeInstanceId?: string;
  onConfirmInstall: (
    targetInstanceId: string,
    addon: UnifiedAddonItem,
    withDependencies: boolean
  ) => void;
  onCreateNewInstanceAndInstall: (
    newInstanceData: {
      name: string;
      gameVersion: string;
      loader: 'fabric' | 'forge' | 'neoforge' | 'quilt' | 'vanilla';
    },
    addon: UnifiedAddonItem
  ) => Promise<void>;
}

const MOD_LOADERS: ModLoaderType[] = ['vanilla', 'fabric', 'forge', 'neoforge', 'quilt'];

function getModLoader(loader: string | undefined): ModLoaderType | '' {
  return MOD_LOADERS.find((supportedLoader) => supportedLoader === loader?.toLowerCase()) ?? '';
}

const INSTANCE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  diamond_sword: DiamondSwordIcon,
  crafting_table: CraftingTableIcon,
  grass_block: GrassBlockIcon,
  pickaxe: PickaxeIcon,
  ender_eye: EnderEyeIcon,
  netherite_ingot: NetheriteIngotIcon,
  creeper: CreeperFaceIcon,
  redstone: RamChipIcon,
};

export const AddonInstallModal: React.FC<AddonInstallModalProps> = ({
  isOpen,
  onClose,
  addon,
  instances,
  activeInstanceId,
  onConfirmInstall,
  onCreateNewInstanceAndInstall,
}) => {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(
    activeInstanceId ?? ''
  );
  const [installDependencies, setInstallDependencies] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isCreatingInline, setIsCreatingInline] = useState(addon?.type === 'modpack');
  const [createError, setCreateError] = useState<string | null>(null);

  // New Instance Form state
  const bestVersion = addon?.gameVersions[0] ?? '';
  const usesAddonLoader = addon?.type === 'mod' || addon?.type === 'modpack';
  const bestLoader = usesAddonLoader
    ? getModLoader(addon?.loaders?.[0]) || 'vanilla'
    : 'vanilla';
  const [newInstanceName, setNewInstanceName] = useState(addon ? `${addon.name} Profile` : '');
  const [newInstanceVersion, setNewInstanceVersion] = useState(bestVersion);
  const [newInstanceLoader, setNewInstanceLoader] = useState<ModLoaderType>(bestLoader);

  useEffect(() => {
    setSelectedInstanceId(activeInstanceId ?? '');
    setIsCreatingInline(addon?.type === 'modpack');
    setNewInstanceName(addon ? `${addon.name} Profile` : '');
    setNewInstanceVersion(addon?.gameVersions[0] ?? '');
    setNewInstanceLoader(
      addon?.type === 'mod' || addon?.type === 'modpack'
        ? getModLoader(addon?.loaders?.[0]) || 'vanilla'
        : 'vanilla'
    );
    setCreateError(null);
  }, [addon?.id, addon?.type, activeInstanceId]);

  if (!isOpen || !addon) return null;

  const currentSelected = instances.find((i) => i.id === selectedInstanceId) ?? null;
  const supportedVersions = addon.gameVersions;
  const usesAddonLoaders = addon.type === 'mod' || addon.type === 'modpack';
  const reportedLoaders = usesAddonLoaders ? addon.loaders
    ?.map(getModLoader)
    .filter((loader, index, loaders): loader is ModLoaderType => Boolean(loader) && loaders.indexOf(loader) === index)
    ?? [] : [];
  const supportedLoaders = reportedLoaders.length > 0 ? reportedLoaders : ['vanilla' as const];

  // Calculate compatibility for an arbitrary instance
  const getInstanceCompatibility = (inst: MinecraftInstance) => {
    const hasLoader = addon.loaders && addon.loaders.length > 0;
    const loaderMatches =
      !hasLoader ||
      addon.loaders?.some((l) => l.toLowerCase() === inst.loader.toLowerCase()) ||
      inst.loader === 'vanilla';

    const versionMatches = addon.gameVersions.some((v) => {
      if (v === inst.gameVersion) return true;
      const partsA = v.split('.');
      const partsB = inst.gameVersion.split('.');
      return partsA[0] === partsB[0] && partsA[1] === partsB[1];
    });

    if (loaderMatches && versionMatches) {
      return { status: 'compatible', badge: 'COMPATIBLE', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    }
    if (!loaderMatches && versionMatches) {
      return {
        status: 'loader_mismatch',
        badge: `NEEDS ${addon.loaders?.[0]?.toUpperCase() || 'LOADER'}`,
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      };
    }
    if (loaderMatches && !versionMatches) {
      return {
        status: 'version_mismatch',
        badge: `TESTED FOR ${addon.gameVersions[0]}`,
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      };
    }
    return { status: 'incompatible', badge: 'MISMATCH', color: 'text-red-400 bg-red-500/10 border-red-500/30' };
  };

  const dependenciesList = addon.dependencies ?? [];

  const handleInstallToExisting = () => {
    if (!currentSelected) return;
    setIsInstalling(true);
    playMinecraftLevelUpSound();
    try {
      onConfirmInstall(currentSelected.id, addon, installDependencies);
      onClose();
    } finally {
      setIsInstalling(false);
    }
  };

  const handleCreateAndInstall = async () => {
    if (!newInstanceName.trim() || !newInstanceVersion || !newInstanceLoader) return;
    setIsInstalling(true);
    playMinecraftLevelUpSound();
    try {
      await onCreateNewInstanceAndInstall(
        {
          name: newInstanceName.trim(),
          gameVersion: newInstanceVersion,
          loader: newInstanceLoader,
        },
        addon
      );
      onClose();
    } catch (reason) {
      setCreateError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="card-obsidian border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0a0d14]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <FolderDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white font-display">Install Addon</h3>
              <p className="text-xs text-slate-400 font-mono">
                Installing: <span className="text-emerald-400 font-bold">{addon.name}</span> ({addon.type.toUpperCase()})
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Target Addon Badge Strip */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center gap-3.5">
            {addon.iconUrl ? (
              <img
                src={addon.iconUrl}
                alt={addon.name}
                className="w-12 h-12 rounded-xl object-cover bg-black/50 border border-white/10 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white truncate font-display">{addon.name}</h4>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase font-mono ${
                    addon.source === 'modrinth'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {addon.source}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">
                {addon.summary || 'No description provided by the source.'}
              </p>
            </div>
          </div>

          {!isCreatingInline ? (
            /* Mode 1: Select Existing Instance */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                  Select Target Instance ({instances.length})
                </label>
                {supportedVersions.length > 0 && addon.type !== 'modpack' && (
                  <button
                  type="button"
                  onClick={() => {
                    playMinecraftClickSound();
                    setIsCreatingInline(true);
                  }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold font-display cursor-pointer hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Create New Instance for this Addon</span>
                  </button>
                )}
              </div>

              {addon.type === 'modpack' && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  Modpacks install into a dedicated new instance to keep their files and settings isolated.
                </p>
              )}

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {instances.length === 0 && (
                  <p className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-400">
                    No instances are available. Create one using a version and loader reported by the addon source.
                  </p>
                )}
                {instances.map((inst) => {
                  const IconComp = INSTANCE_ICONS[inst.icon] || DiamondSwordIcon;
                  const isSelected = inst.id === selectedInstanceId;
                  const compat = getInstanceCompatibility(inst);

                  return (
                    <button
                      key={inst.id}
                      type="button"
                      onClick={() => {
                        playMinecraftClickSound();
                        setSelectedInstanceId(inst.id);
                      }}
                      className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                          : 'bg-[#0c0f16] border-white/5 hover:border-white/20 hover:bg-[#121622]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            isSelected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-black/40 text-slate-400'
                          }`}
                        >
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white font-display truncate">
                              {inst.name}
                            </span>
                            {inst.id === activeInstanceId && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                            <span>MC {inst.gameVersion}</span>
                            <span>•</span>
                            <span className="uppercase">{inst.loader}</span>
                            <span>•</span>
                            <span>{inst.mods?.length || 0} mods</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 ml-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${compat.color}`}>
                          {compat.badge}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-400 text-black'
                              : 'border-white/20 bg-black/40'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Dependencies Resolution Checklist */}
              {dependenciesList.length > 0 && (
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                  <label className="flex items-center justify-between text-xs font-bold text-slate-300 font-display cursor-pointer">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span>Automatic Dependency Resolution</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={installDependencies}
                      onChange={(e) => setInstallDependencies(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 bg-black/60 border-white/20 cursor-pointer"
                    />
                  </label>
                  <div className="text-[11px] text-slate-400 font-mono space-y-1 pl-5">
                    {dependenciesList.map((dep) => (
                      <div key={dep.id} className="flex items-center justify-between">
                        <span>• {dep.name}</span>
                        <span className="text-emerald-400 font-bold">{dep.required ? 'REQUIRED' : 'RECOMMENDED'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Mode 2: Quick Inline Instance Creation */
            <div className="p-4 rounded-xl bg-black/40 border border-emerald-500/30 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-bold text-white font-display flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Configure New Compatible Instance</span>
                </span>
                {addon.type !== 'modpack' && <button
                  type="button"
                  onClick={() => setIsCreatingInline(false)}
                  className="text-xs text-slate-400 hover:text-white font-mono cursor-pointer"
                >
                  Back to Existing
                </button>}
              </div>

              {addon.type === 'modpack' && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  Modpacks must be installed into a new instance. Choose its name, Minecraft version, and loader below.
                </p>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Instance Name</label>
                  <input
                    type="text"
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-black/60 border border-white/10 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">Minecraft Version</label>
                    <select
                      value={newInstanceVersion}
                      onChange={(e) => setNewInstanceVersion(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-black/60 border border-white/10 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
                    >
                      {supportedVersions.map((v) => (
                        <option key={v} value={v}>
                          Minecraft {v}
                        </option>
                      ))}
                    </select>
                    {supportedVersions.length === 0 && (
                      <p className="mt-1 text-[10px] text-amber-300">No compatible Minecraft versions were reported.</p>
                    )}
                  </div>

                  {usesAddonLoaders ? <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">Mod Loader</label>
                    <select
                      value={newInstanceLoader}
                      onChange={(e) => setNewInstanceLoader(getModLoader(e.target.value) || 'vanilla')}
                      className="w-full px-3 py-1.5 text-xs bg-black/60 border border-white/10 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500 uppercase"
                    >
                      {supportedLoaders.map((l) => (
                          <option key={l} value={l}>
                            {l.toUpperCase()}
                          </option>
                        ))}
                    </select>
                    {supportedLoaders.length === 0 && (
                      <p className="mt-1 text-[10px] text-amber-300">No supported loader was reported.</p>
                    )}
                  </div> : (
                    <div className="flex items-center rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-slate-300">
                      This pack does not require a mod loader. The new instance will use Vanilla.
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-emerald-400 font-mono bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                  The new instance will use the Minecraft version and loader reported by the source.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-[#0a0d14]">
          <button
            type="button"
            onClick={() => {
              playMinecraftClickSound();
              onClose();
            }}
            className="btn-mc px-4 py-2 text-xs font-semibold text-slate-300 rounded font-display"
          >
            Cancel
          </button>

          {!isCreatingInline ? (
            <button
              type="button"
              onClick={handleInstallToExisting}
              disabled={!currentSelected || isInstalling || addon.type === 'modpack'}
              className={`btn-mc flex items-center gap-2 px-6 py-2 text-white font-bold text-xs rounded cursor-pointer font-display disabled:opacity-50 ${
                addon.source === 'curseforge' ? 'btn-mc-amber' : 'btn-mc-green'
              }`}
            >
              {isInstalling ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Installing...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>{addon.type === 'modpack' ? 'Create a dedicated instance below' : `Install to "${currentSelected?.name}"`}</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex flex-col items-end gap-2">
              {createError && <p role="alert" className="max-w-xs text-right text-[11px] text-red-300">{createError}</p>}
              <button
                type="button"
                onClick={() => void handleCreateAndInstall()}
                disabled={isInstalling || !newInstanceName.trim() || !newInstanceVersion || !newInstanceLoader}
                className="btn-mc btn-mc-green flex items-center gap-2 px-6 py-2 text-white font-bold text-xs rounded cursor-pointer font-display"
              >
                {isInstalling ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating & Installing...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Instance & Install</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
