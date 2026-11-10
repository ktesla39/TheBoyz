import React, { useState } from 'react';
import { X, Check, Plus, Download, Sparkles, FolderDown, ShieldCheck, AlertCircle } from 'lucide-react';
import { MinecraftInstance } from '../../types/instance';
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

export interface InstallableItem {
  id: string | number;
  name: string;
  type: 'mod' | 'resourcepack' | 'shader' | 'datapack' | 'world' | 'modpack';
  source: 'modrinth' | 'curseforge' | 'local';
  iconUrl?: string | null;
  description?: string;
  version?: string;
  filename?: string;
  downloads?: string | number;
  author?: string;
}

interface InstallTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  instances: MinecraftInstance[];
  activeInstanceId?: string;
  item: InstallableItem | null;
  onConfirmInstall: (targetInstanceId: string, item: InstallableItem) => void;
  onCreateInstanceWithItem?: (item: InstallableItem) => void;
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

export const InstallTargetModal: React.FC<InstallTargetModalProps> = ({
  isOpen,
  onClose,
  instances,
  activeInstanceId,
  item,
  onConfirmInstall,
  onCreateInstanceWithItem,
}) => {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(() => {
    return activeInstanceId ?? '';
  });
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isOpen || !item) return null;

  const currentSelected = instances.find((i) => i.id === selectedInstanceId) ?? null;

  const handleInstall = () => {
    if (!currentSelected) return;
    setIsInstalling(true);
    playMinecraftLevelUpSound();
    try {
      onConfirmInstall(currentSelected.id, item);
      onClose();
    } finally {
      setIsInstalling(false);
    }
  };

  const getTypeName = (t: string) => {
    switch (t) {
      case 'resourcepack':
        return 'Resource Pack';
      case 'shader':
        return 'Shader Pack';
      case 'datapack':
        return 'Data Pack';
      case 'world':
        return 'World Save';
      case 'modpack':
        return 'Complete Modpack';
      case 'mod':
        return 'Mod';
      default:
        return t;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#141923] border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0f131c]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <FolderDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">Install to Instance</h3>
              <p className="text-xs text-slate-400">Choose destination instance for this {getTypeName(item.type)}</p>
            </div>
          </div>
          <button
            onClick={() => {
              playMinecraftClickSound();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Target Item Preview Card */}
          <div className="p-3.5 rounded-lg bg-[#0c0f16] border border-white/10 flex items-center gap-3.5">
            {item.iconUrl ? (
              <img
                src={item.iconUrl}
                alt={item.name}
                className="w-12 h-12 rounded-lg object-cover bg-black/40 border border-white/10 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white truncate font-display">{item.name}</h4>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                    item.source === 'modrinth'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {item.source}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/5 text-slate-300 border border-white/10">
                  {getTypeName(item.type)}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {item.description ?? item.version ?? 'No description provided by the source.'}
              </p>
            </div>
          </div>

          {/* Instance Selection Section */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                Select Destination Instance ({instances.length})
              </label>
              {onCreateInstanceWithItem && (
                <button
                  onClick={() => {
                    playMinecraftClickSound();
                    onCreateInstanceWithItem(item);
                    onClose();
                  }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Instance for this</span>
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {instances.map((inst) => {
                const IconComp = INSTANCE_ICONS[inst.icon];
                const isSelected = inst.id === selectedInstanceId;

                return (
                  <button
                    key={inst.id}
                    onClick={() => {
                      playMinecraftClickSound();
                      setSelectedInstanceId(inst.id);
                    }}
                    className={`w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                        : 'bg-[#0e121a] border-white/5 hover:border-white/20 hover:bg-[#131824]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isSelected ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-black/40 border border-white/10'
                        }`}
                      >
                        {IconComp && <IconComp className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white font-display">{inst.name}</span>
                          {inst.id === activeInstanceId && (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                          <span>MC {inst.gameVersion}</span>
                          <span>•</span>
                          <span className="capitalize">{inst.loader}</span>
                          <span>•</span>
                          <span>{inst.mods?.length || 0} mods</span>
                          <span>•</span>
                          <span>{inst.packs?.length || 0} packs</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center">
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
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/10 bg-[#0f131c]">
          <button
            onClick={() => {
              playMinecraftClickSound();
              onClose();
            }}
            className="btn-mc px-4 py-2 text-xs font-semibold text-slate-300 rounded"
          >
            Cancel
          </button>

          <button
            onClick={handleInstall}
            disabled={!currentSelected || isInstalling}
            className="btn-mc btn-mc-green flex items-center gap-2 px-5 py-2 text-white font-bold text-xs tracking-wide rounded cursor-pointer disabled:opacity-50"
          >
            {isInstalling ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Installing...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Install to &quot;{currentSelected?.name}&quot;</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
