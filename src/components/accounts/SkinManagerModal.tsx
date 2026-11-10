import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Upload,
  Check,
  Globe,
  Sparkles,
  Link as LinkIcon,
  Layers,
} from 'lucide-react';
import {
  LauncherAccount,
  SkinProvider,
  SkinModel,
} from '../../types/auth';
import {
  validateAndProcessSkinFile,
  getElyBySkinUrl,
  getElyByCapeUrl,
  getMojangSkinUrl,
  STEVE_SKIN_TEXTURE,
  ALEX_SKIN_TEXTURE,
} from '../../services/authService';
import { MinecraftSkinCanvas } from '../skin/MinecraftSkinCanvas';
import { CAPE_PRESETS, createCapeTexture, normalizeCapeTexture } from '../../services/capePresets';
import { playMinecraftClickSound, playMinecraftLevelUpSound } from '../../services/soundService';

interface SkinManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: LauncherAccount;
  onUpdateAccountSkin: (
    updatedFields: {
      skinUrl: string;
      skinProvider: SkinProvider;
      model: SkinModel;
      capeUrl?: string;
      capeName?: string;
    }
  ) => void;
}

export const SkinManagerModal: React.FC<SkinManagerModalProps> = ({
  isOpen,
  onClose,
  account,
  onUpdateAccountSkin,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<SkinProvider | undefined>(account.skinProvider);
  const [currentSkinUrl, setCurrentSkinUrl] = useState<string>(account.skinUrl ?? '');
  const [selectedModel, setSelectedModel] = useState<SkinModel | undefined>(account.model);
  const [selectedCapeUrl, setSelectedCapeUrl] = useState<string>(account.capeUrl ?? '');
  const [selectedCapeName, setSelectedCapeName] = useState<string | undefined>(account.capeName);
  const [elyByUsername, setElyByUsername] = useState<string>(account.username);
  const [mojangUsername, setMojangUsername] = useState<string>(account.username);
  const [customUrlInput, setCustomUrlInput] = useState<string>(
    account.skinProvider === 'custom_url' ? account.skinUrl ?? '' : ''
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [previewBackView, setPreviewBackView] = useState<boolean>(Boolean(account.capeUrl));
  const capePresets = useMemo(
    () => isOpen ? CAPE_PRESETS.map((preset) => ({ ...preset, texture: createCapeTexture(preset) })) : [],
    [isOpen]
  );

  useEffect(() => {
    setSelectedProvider(account.skinProvider);
    setCurrentSkinUrl(account.skinUrl ?? '');
    setSelectedModel(account.model);
    setSelectedCapeUrl(account.capeUrl ?? '');
    setSelectedCapeName(account.capeName);
    setElyByUsername(account.username);
    setMojangUsername(account.username);
    setCustomUrlInput(account.skinProvider === 'custom_url' ? account.skinUrl ?? '' : '');
    setPreviewBackView(Boolean(account.capeUrl));
  }, [account, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);

    try {
      const result = await validateAndProcessSkinFile(file);
      setCurrentSkinUrl(result.dataUrl);
      setSelectedModel(result.detectedModel);
      setSelectedProvider('upload');
      setUploadSuccess(`Uploaded ${file.name} (${result.width}x${result.height}) — Auto-detected ${result.detectedModel.toUpperCase()} arm model.`);
      playMinecraftClickSound();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload skin image.');
    }
  };

  const handleCapeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      setUploadError('Cape PNG is too large (maximum 512KB).');
      e.target.value = '';
      return;
    }
    if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
      setUploadError('Cape textures must be PNG images.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') {
        setUploadError(`Failed to read cape file "${file.name}".`);
        return;
      }
      const image = new Image();
      image.onload = () => {
        try {
          const normalized = normalizeCapeTexture(image, image.naturalWidth, image.naturalHeight);
          setSelectedCapeUrl(normalized.toDataURL('image/png'));
          setSelectedCapeName(file.name.replace(/\.png$/i, ''));
          setPreviewBackView(true);
          setUploadError(null);
          setUploadSuccess(`Custom cape "${file.name}" applied.`);
          playMinecraftClickSound();
        } catch (reason) {
          setUploadError(reason instanceof Error ? reason.message : String(reason));
        }
      };
      image.onerror = () => setUploadError(`Cape file "${file.name}" is not a readable PNG image.`);
      image.src = reader.result;
    };
    reader.onerror = () => setUploadError(`Failed to read cape file "${file.name}".`);
    reader.readAsDataURL(file);
  };

  const handleSelectCape = (cape: { name: string; texture: string }) => {
    setSelectedCapeUrl(cape.texture);
    setSelectedCapeName(cape.name);
    setPreviewBackView(true);
    setUploadError(null);
    setUploadSuccess(`${cape.name} cape equipped.`);
    playMinecraftClickSound();
  };

  const handleSelectElyBy = () => {
    setSelectedProvider('ely.by');
    const skin = getElyBySkinUrl(elyByUsername);
    const cape = getElyByCapeUrl(elyByUsername);
    setCurrentSkinUrl(skin);
    setSelectedCapeUrl(cape);
    setSelectedCapeName('Ely.by Cloak');
    playMinecraftClickSound();
  };

  const handleSelectMojang = () => {
    setSelectedProvider('mojang');
    const skin = getMojangSkinUrl(mojangUsername);
    setCurrentSkinUrl(skin);
    playMinecraftClickSound();
  };

  const handleApplyPreset = (texture: string, model: SkinModel, name: string) => {
    setSelectedProvider('mojang');
    setCurrentSkinUrl(texture);
    setSelectedModel(model);
    setUploadSuccess(`Loaded ${name} preset skin.`);
    playMinecraftClickSound();
  };

  const handleSave = () => {
    if (!selectedProvider || !currentSkinUrl || !selectedModel) {
      setUploadError('Choose a skin source, skin texture, and arm model before saving.');
      return;
    }
    playMinecraftLevelUpSound();
    onUpdateAccountSkin({
      skinUrl: currentSkinUrl,
      skinProvider: selectedProvider,
      model: selectedModel,
      capeUrl: selectedCapeUrl || undefined,
      capeName: selectedCapeName,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none">
      <div className="card-obsidian border border-white/10 rounded-2xl w-full max-w-3xl shadow-[0_16px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#0a0d14] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <Layers className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-white font-display">
                Player Skin Studio & Cape Manager
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Customizing: <span className="text-emerald-400 font-bold">{account.username}</span> ({account.type.toUpperCase()})
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

        {/* Modal Body: Split 2-Column Layout */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Live 2D/3D Skin Viewport & Pedestal */}
          <div className="md:col-span-5 flex flex-col items-center justify-between p-5 rounded-xl bg-gradient-to-b from-[#0e121b] to-[#07090e] border border-white/10 shadow-inner">
            <div className="text-center w-full mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Real-Time 3D Projection
              </span>
              <div className="text-xs font-bold text-white font-display mt-0.5">
                {selectedModel === 'slim'
                  ? 'Slim (Alex 3px Arms)'
                  : selectedModel === 'classic'
                    ? 'Classic (Steve 4px Arms)'
                    : 'Choose an arm model'}
              </div>
            </div>

            {/* Canvas Viewport */}
            <div className="py-2 flex flex-col items-center justify-center">
              <MinecraftSkinCanvas
                skinUrl={currentSkinUrl}
                capeUrl={selectedCapeUrl}
                model={selectedModel}
                mode="full"
                height={260}
                width={170}
                showPedestal={false}
                interactive={true}
                initialBackView={previewBackView}
                className="drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)]"
              />
            </div>

            {/* Model Type Selector */}
            <div className="w-full mt-3 pt-3 border-t border-white/5">
              <div className="text-[10px] font-bold text-slate-400 uppercase font-mono mb-1.5 text-center">
                Player Arm Geometry
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playMinecraftClickSound();
                    setSelectedModel('classic');
                  }}
                  className={`btn-mc py-1.5 px-2 text-xs font-bold rounded flex items-center justify-center gap-1.5 ${
                    selectedModel === 'classic'
                      ? 'btn-mc-green text-white ring-1 ring-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  Classic (4px)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playMinecraftClickSound();
                    setSelectedModel('slim');
                  }}
                  className={`btn-mc py-1.5 px-2 text-xs font-bold rounded flex items-center justify-center gap-1.5 ${
                    selectedModel === 'slim'
                      ? 'btn-mc-green text-white ring-1 ring-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  Slim (3px)
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Providers, File Upload, and Capes */}
          <div className="md:col-span-7 space-y-5">
            {/* Feedback Notifications */}
            {uploadError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-mono">
                {uploadError}
              </div>
            )}
            {uploadSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-mono flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {/* Provider Tabs */}
            <div>
              <label className="block text-xs font-bold text-slate-300 font-display mb-2">
                Skin Source & Provider
              </label>
              <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-black/40 border border-white/5">
                {[
                  { id: 'upload', label: 'Upload PNG', icon: Upload },
                  { id: 'ely.by', label: 'Ely.by', icon: Globe },
                  { id: 'mojang', label: 'Mojang', icon: Sparkles },
                  { id: 'custom_url', label: 'Direct URL', icon: LinkIcon },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      playMinecraftClickSound();
                      setSelectedProvider(p.id as SkinProvider);
                      if (p.id === 'ely.by') handleSelectElyBy();
                      if (p.id === 'mojang') handleSelectMojang();
                    }}
                    className={`py-2 px-1 text-[11px] font-bold rounded-lg font-display flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedProvider === p.id
                        ? 'bg-[#1e2536] text-emerald-400 shadow-sm border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <p.icon className="w-3.5 h-3.5" />
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Provider Specific Controls */}
            {selectedProvider === 'upload' && (
              <div className="p-4 rounded-xl border-2 border-dashed border-white/10 hover:border-emerald-500/50 bg-black/30 transition-all text-center">
                <input
                  type="file"
                  id="skin-file-input"
                  accept=".png,image/png"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="skin-file-input"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <div className="p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white font-display">
                      Click to choose skin PNG or drop file here
                    </span>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Supports standard 64x64 and legacy 64x32 textures.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {selectedProvider === 'ely.by' && (
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white font-display">
                    Ely.by Skin System Integration
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    Active Cloak Support
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={elyByUsername}
                    onChange={(e) => setElyByUsername(e.target.value)}
                    placeholder="Ely.by username"
                    className="flex-1 px-3 py-1.5 text-xs bg-black/60 border border-white/10 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSelectElyBy}
                    className="btn-mc btn-mc-green px-3 py-1.5 text-xs font-bold text-white rounded cursor-pointer"
                  >
                    Fetch
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  Directly queries Ely.by skin and cloak textures for offline players.
                </p>
              </div>
            )}

            {selectedProvider === 'mojang' && (
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
                <span className="text-xs font-bold text-white font-display">
                  Mojang Account Mirror
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mojangUsername}
                    onChange={(e) => setMojangUsername(e.target.value)}
                    placeholder="Java Minecraft username"
                    className="flex-1 px-3 py-1.5 text-xs bg-black/60 border border-white/10 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSelectMojang}
                    className="btn-mc btn-mc-green px-3 py-1.5 text-xs font-bold text-white rounded cursor-pointer"
                  >
                    Fetch
                  </button>
                </div>
              </div>
            )}

            {selectedProvider === 'custom_url' && (
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <span className="text-xs font-bold text-white font-display">
                  Custom Skin Direct URL
                </span>
                <input
                  type="url"
                  value={customUrlInput}
                  onChange={(e) => {
                    setCustomUrlInput(e.target.value);
                    setCurrentSkinUrl(e.target.value);
                  }}
                  placeholder="https://textures.minecraft.net/texture/..."
                  className="w-full px-3 py-1.5 text-xs bg-black/60 border border-white/10 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Cape collection */}
            <section className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-300 font-display flex items-center gap-1.5">
                  Cape wardrobe
                </label>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="custom-cape-input"
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono cursor-pointer flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 transition-colors"
                    title="Upload standard 64x32 or 22x17 cape texture"
                  >
                    <Upload className="w-2.5 h-2.5" />
                    <span>Upload Cape PNG</span>
                  </label>
                  <input
                    type="file"
                    id="custom-cape-input"
                    accept=".png,image/png"
                    onChange={handleCapeUpload}
                    className="hidden"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">16 original patterns</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCapeUrl('');
                      setSelectedCapeName(undefined);
                    }}
                    className={`rounded border px-2 py-1 text-[10px] font-mono transition-colors ${
                      !selectedCapeUrl
                        ? 'border-emerald-500/60 bg-emerald-500/15 text-slate-100'
                        : 'border-white/15 text-slate-500 hover:text-slate-100'
                    }`}
                    aria-pressed={!selectedCapeUrl}
                  >
                    No cape
                  </button>
                  {selectedCapeUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        playMinecraftClickSound();
                        setSelectedCapeUrl('');
                        setSelectedCapeName(undefined);
                      }}
                      className="text-[10px] text-red-400 hover:text-red-300 font-mono cursor-pointer"
                    >
                      Unequip
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Equipped: <span className="font-bold text-[var(--mc-accent)]">{selectedCapeName ?? 'None'}</span>
                {' · '}Select a design or upload a 64×32 / 22×17 PNG.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {capePresets.map((cape) => {
                  const selected = selectedCapeName === cape.name && selectedCapeUrl === cape.texture;
                  return (
                    <button
                      key={cape.id}
                      type="button"
                      onClick={() => handleSelectCape(cape)}
                      aria-pressed={selected}
                      className={`min-w-0 flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                        selected
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-white/10 bg-black/10 hover:border-[var(--mc-accent)]/50'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="grid h-9 w-7 shrink-0 grid-cols-2 overflow-hidden border border-black/20 shadow-sm"
                      >
                        <span style={{ backgroundColor: cape.colors[1] }} />
                        <span style={{ backgroundColor: cape.colors[0] }} />
                        <span style={{ backgroundColor: cape.colors[2] }} />
                        <span style={{ backgroundColor: cape.colors[1] }} />
                        <span className="col-span-2" style={{ backgroundColor: cape.colors[3] }} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-bold text-slate-100">{cape.name}</span>
                        <span className="block text-[9px] uppercase tracking-wide text-slate-500">{cape.pattern}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Quick Classic Presets */}
            <div>
              <label className="block text-xs font-bold text-slate-300 font-display mb-1.5">
                Official Default Characters
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset(STEVE_SKIN_TEXTURE, 'classic', 'Steve')}
                  className="btn-mc px-3 py-1.5 text-xs font-bold text-slate-200 rounded cursor-pointer"
                >
                  Steve (Classic)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(ALEX_SKIN_TEXTURE, 'slim', 'Alex')}
                  className="btn-mc px-3 py-1.5 text-xs font-bold text-slate-200 rounded cursor-pointer"
                >
                  Alex (Slim)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-[#0a0d14] shrink-0 gap-3">
          <span className="text-[11px] text-slate-400 font-mono truncate max-w-[200px] sm:max-w-sm">
            Saved to encrypted local launcher storage
          </span>
          <div className="flex items-center gap-3 shrink-0">
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
              disabled={!selectedProvider || !currentSkinUrl || !selectedModel}
              className="btn-mc btn-mc-green flex items-center gap-2 px-5 py-2 text-white font-black text-xs rounded cursor-pointer font-display"
            >
              <Check className="w-4 h-4" />
              <span>Apply Skin to Profile</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
