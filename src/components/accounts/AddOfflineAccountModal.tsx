import React, { useState } from 'react';
import { X, Check, RefreshCw, Upload, Globe, Sparkles } from 'lucide-react';
import {
  createOfflineProfile,
  generateOfflineUuid,
  validateUsername,
  validateAndProcessSkinFile,
  getElyBySkinUrl,
  getMojangSkinUrl,
} from '../../services/authService';
import { OfflineProfile, SkinProvider, SkinModel } from '../../types/auth';
import { OfflineShieldIcon } from '../icons/MinecraftIcons';
import { MinecraftSkinCanvas } from '../skin/MinecraftSkinCanvas';
import { playMinecraftClickSound, playMinecraftLevelUpSound } from '../../services/soundService';

interface AddOfflineAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated: (account: OfflineProfile) => void;
}

export const AddOfflineAccountModal: React.FC<AddOfflineAccountModalProps> = ({
  isOpen,
  onClose,
  onAccountCreated,
}) => {
  const [username, setUsername] = useState('');
  const [customDisplayName, setCustomDisplayName] = useState('');
  const [skinProvider, setSkinProvider] = useState<SkinProvider>('ely.by');
  const [model, setModel] = useState<SkinModel>('classic');
  const [customSkinUrl, setCustomSkinUrl] = useState('');
  const [customUuid, setCustomUuid] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const previewUuid = username ? generateOfflineUuid(username) : '';

  const previewSkinUrl =
    skinProvider === 'upload' || skinProvider === 'custom_url'
      ? customSkinUrl
      : username
        ? skinProvider === 'ely.by'
          ? getElyBySkinUrl(username)
          : getMojangSkinUrl(username)
        : '';

  const handleGenerateRandomUuid = () => {
    playMinecraftClickSound();
    const s = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    setCustomUuid(s);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await validateAndProcessSkinFile(file);
      setCustomSkinUrl(res.dataUrl);
      setModel(res.detectedModel);
      setSkinProvider('upload');
      playMinecraftClickSound();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid skin file');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validation = validateUsername(username);
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid username');
      return;
    }

    try {
      const newProfile = createOfflineProfile(username, {
        skinProvider,
        model,
        skinUrl: previewSkinUrl || undefined,
        uuid: customUuid || undefined,
        displayName: customDisplayName || undefined,
      });
      playMinecraftLevelUpSound();
      onAccountCreated(newProfile);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none">
      <div className="card-obsidian border border-white/10 rounded-2xl w-full max-w-xl shadow-[0_16px_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#0a0d14]">
          <div className="flex items-center gap-3">
            <OfflineShieldIcon className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-black text-white font-display">Create Offline Profile</h3>
              <p className="text-[11px] text-slate-400">Supports Ely.by skin system, custom PNG uploads, and offline play</p>
            </div>
          </div>
          <button
            onClick={() => {
              playMinecraftClickSound();
              onClose();
            }}
            className="text-slate-500 hover:text-white p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form & Live Skin Preview */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-mono">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
            {/* Live Skin Preview Canvas */}
            <div className="sm:col-span-4 flex flex-col items-center justify-center p-3 rounded-xl bg-black/40 border border-white/10">
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase mb-1">
                Skin Preview
              </span>
              <MinecraftSkinCanvas
                skinUrl={previewSkinUrl}
                model={model}
                mode="full"
                height={170}
                width={100}
                showPedestal={true}
                interactive={true}
              />
              <span className="text-[8px] font-mono text-emerald-400 font-semibold mt-1">
                {skinProvider.toUpperCase()}
              </span>
            </div>

            {/* Inputs */}
            <div className="sm:col-span-8 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 font-display mb-1">
                  Username <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. Steve_Craft99"
                  className="w-full px-3 py-1.5 text-xs bg-black/50 border border-white/10 rounded text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 font-display mb-1">
                  Skin Provider
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      playMinecraftClickSound();
                      setSkinProvider('ely.by');
                    }}
                    className={`btn-mc py-1 px-2 text-[10px] font-bold rounded flex items-center justify-center gap-1 ${
                      skinProvider === 'ely.by'
                        ? 'btn-mc-green text-white ring-1 ring-emerald-400'
                        : 'text-slate-300'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    <span>Ely.by</span>
                  </button>
                  <label
                    className={`btn-mc py-1 px-2 text-[10px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer ${
                      skinProvider === 'upload'
                        ? 'btn-mc-green text-white ring-1 ring-emerald-400'
                        : 'text-slate-300'
                    }`}
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload PNG</span>
                    <input
                      type="file"
                      accept=".png,image/png"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      playMinecraftClickSound();
                      setSkinProvider('mojang');
                    }}
                    className={`btn-mc py-1 px-2 text-[10px] font-bold rounded flex items-center justify-center gap-1 ${
                        skinProvider === 'mojang'
                        ? 'btn-mc-green text-white ring-1 ring-emerald-400'
                        : 'text-slate-300'
                    }`}
                  >
                      <Sparkles className="w-3 h-3" />
                      <span>Mojang</span>
                    </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 font-display mb-1">
                  Arm Model
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      playMinecraftClickSound();
                      setModel('classic');
                    }}
                    className={`btn-mc py-1 text-xs font-bold rounded ${
                      model === 'classic' ? 'btn-mc-green text-white' : 'text-slate-300'
                    }`}
                  >
                    Classic (4px)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playMinecraftClickSound();
                      setModel('slim');
                    }}
                    className={`btn-mc py-1 text-xs font-bold rounded ${
                      model === 'slim' ? 'btn-mc-green text-white' : 'text-slate-300'
                    }`}
                  >
                    Slim (3px)
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-400 font-display">
                    Offline UUID v3
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomUuid}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    Randomize
                  </button>
                </div>
                <div className="px-2 py-1 bg-black/60 rounded border border-white/5 font-mono text-[10px] text-emerald-400 truncate select-all">
                  {customUuid || previewUuid}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-3">
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
              className="btn-mc btn-mc-green flex items-center gap-2 px-5 py-2 text-white font-black text-xs rounded cursor-pointer font-display"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Offline Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
