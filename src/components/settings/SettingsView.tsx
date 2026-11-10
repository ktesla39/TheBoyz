import React, { useEffect, useState } from 'react';
import {
  Settings,
  Folder,
  Download,
  Moon,
  Sun,
  Shield,
  CheckCircle,
  FileDown,
  Palette,
  Cpu,
  Zap,
  Volume2,
  Sliders,
  HardDrive,
  Monitor,
  Upload,
  Sparkles,
  Play,
  RotateCcw,
  Check,
  Link,
  Trash2,
  KeyRound,
} from 'lucide-react';
import { LauncherSettings, saveSettings } from '../../services/storageService';
import {
  THEME_PRESETS,
  ThemePreset,
  applyLauncherTheme,
  BUTTON_COLOR_PRESETS,
} from '../../services/themeService';
import {
  TheBoysEmblemIcon,
  DiamondSwordIcon,
  CraftingTableIcon,
  GrassBlockIcon,
  PickaxeIcon,
  EnderEyeIcon,
  NetheriteIngotIcon,
  CreeperFaceIcon,
  RedstoneDustIcon,
  GoldenAppleIcon,
  EnchantedBookIcon,
  BeaconIcon,
  TotemIcon,
  PotionBottleIcon,
  DragonEggIcon,
  TridentIcon,
  MinecraftShieldIcon,
  RamChipIcon,
  OpenGlApiIcon,
} from '../icons/MinecraftIcons';
import { playMinecraftClickSound, playMinecraftLevelUpSound } from '../../services/soundService';
import {
  invokeClearCurseForgeApiKey,
  invokeCurseForgeKeyStatus,
  invokeSaveCurseForgeApiKey,
  isTauriEnvironment,
} from '../../services/tauriBridge';

interface SettingsViewProps {
  settings: LauncherSettings;
  onUpdateSettings: (newSettings: LauncherSettings) => void;
}

const TheBoysLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <img src="/logo.png" alt="The Boys Official Logo" className={`${className} object-contain rounded`} />
);

const LAUNCHER_ICON_PRESETS = [
  { id: 'default', label: 'The Boys Crest', icon: TheBoysLogoIcon },
  { id: 'diamond_sword', label: 'Diamond Sword', icon: DiamondSwordIcon },
  { id: 'pickaxe', label: 'Diamond Pickaxe', icon: PickaxeIcon },
  { id: 'netherite_ingot', label: 'Netherite Ingot', icon: NetheriteIngotIcon },
  { id: 'ender_eye', label: 'Eye of Ender', icon: EnderEyeIcon },
  { id: 'grass_block', label: 'Grass Block', icon: GrassBlockIcon },
  { id: 'crafting_table', label: 'Crafting Table', icon: CraftingTableIcon },
  { id: 'creeper_face', label: 'Creeper Face', icon: CreeperFaceIcon },
  { id: 'redstone_dust', label: 'Redstone Dust', icon: RedstoneDustIcon },
  { id: 'golden_apple', label: 'Golden Apple', icon: GoldenAppleIcon },
  { id: 'enchanted_book', label: 'Enchanted Book', icon: EnchantedBookIcon },
  { id: 'beacon', label: 'Nether Beacon', icon: BeaconIcon },
  { id: 'totem', label: 'Totem of Undying', icon: TotemIcon },
  { id: 'potion', label: 'Potion Bottle', icon: PotionBottleIcon },
  { id: 'dragon_egg', label: 'Dragon Egg', icon: DragonEggIcon },
  { id: 'trident', label: 'Trident', icon: TridentIcon },
  { id: 'shield', label: 'Knight Shield', icon: MinecraftShieldIcon },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [localSettings, setLocalSettings] = useState<LauncherSettings>(settings);
  const [saved, setSaved] = useState(false);
  const [customIconUrlInput, setCustomIconUrlInput] = useState('');
  const [curseForgeKeyConfigured, setCurseForgeKeyConfigured] = useState<boolean | null>(null);
  const [curseForgeKeyInput, setCurseForgeKeyInput] = useState('');
  const [curseForgeKeyError, setCurseForgeKeyError] = useState<string | null>(null);
  const [curseForgeKeySaving, setCurseForgeKeySaving] = useState(false);

  useEffect(() => {
    if (!isTauriEnvironment()) return;
    invokeCurseForgeKeyStatus()
      .then(setCurseForgeKeyConfigured)
      .catch((error: unknown) => setCurseForgeKeyError(
        error instanceof Error ? error.message : String(error)
      ));
  }, []);

  // Sync theme changes live immediately to document root and state
  const applyLiveChanges = (updated: LauncherSettings) => {
    applyLauncherTheme(
      updated.themePreset,
      {
        bgColor: updated.customBgColor,
        surfaceColor: updated.customSurfaceColor,
        accentColor: updated.customAccentColor,
      },
      updated.lowSpecMode,
      updated.buttonColorTheme || 'emerald',
      updated.customButtonColor,
      updated.theme
    );
    saveSettings(updated);
    onUpdateSettings(updated);
  };

  const handleSelectPreset = (presetKey: ThemePreset) => {
    playMinecraftClickSound();
    const preset = THEME_PRESETS[presetKey];
    const updated: LauncherSettings = {
      ...localSettings,
      themePreset: presetKey,
      customAccentColor: preset.accentColor,
      customBgColor: preset.bgColor,
      customSurfaceColor: preset.surfaceColor,
    };
    setLocalSettings(updated);
    applyLiveChanges(updated);
  };

  const handleButtonColorSelect = (colorKey: string) => {
    playMinecraftClickSound();
    const preset = BUTTON_COLOR_PRESETS[colorKey];
    const updated: LauncherSettings = {
      ...localSettings,
      buttonColorTheme: colorKey as any,
      customButtonColor: preset ? preset.bg : localSettings.customButtonColor,
      customAccentColor: preset ? preset.accent : localSettings.customAccentColor,
    };
    setLocalSettings(updated);
    applyLiveChanges(updated);
  };

  const handleCustomButtonColorChange = (hexVal: string) => {
    const updated: LauncherSettings = {
      ...localSettings,
      buttonColorTheme: 'custom',
      customButtonColor: hexVal,
      customAccentColor: hexVal,
    };
    setLocalSettings(updated);
    applyLiveChanges(updated);
  };

  const handleCustomColorChange = (
    key: 'customAccentColor' | 'customBgColor' | 'customSurfaceColor',
    val: string
  ) => {
    const updated = {
      ...localSettings,
      themePreset: 'custom' as ThemePreset,
      [key]: val,
    };
    setLocalSettings(updated);
    applyLiveChanges(updated);
  };

  const handleLauncherIconSelect = (iconId: string) => {
    playMinecraftClickSound();
    const updated: LauncherSettings = {
      ...localSettings,
      launcherIcon: iconId,
    };
    setLocalSettings(updated);
    applyLiveChanges(updated);
  };

  const handleCustomIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      playMinecraftLevelUpSound();
      const updated: LauncherSettings = {
        ...localSettings,
        launcherIcon: dataUrl,
      };
      setLocalSettings(updated);
      applyLiveChanges(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomIconUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customIconUrlInput.trim()) return;
    playMinecraftLevelUpSound();
    const updated: LauncherSettings = {
      ...localSettings,
      launcherIcon: customIconUrlInput.trim(),
    };
    setLocalSettings(updated);
    applyLiveChanges(updated);
    setCustomIconUrlInput('');
  };

  const handleToggleLowSpec = (checked: boolean) => {
    playMinecraftClickSound();
    const updated = { ...localSettings, lowSpecMode: checked };
    setLocalSettings(updated);
    applyLiveChanges(updated);
  };

  const handleSave = () => {
    playMinecraftLevelUpSound();
    saveSettings(localSettings);
    onUpdateSettings(localSettings);
    applyLiveChanges(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const handleExportConfig = () => {
    playMinecraftClickSound();
    const blob = new Blob([JSON.stringify(localSettings, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `theboys-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentBtnTheme = localSettings.buttonColorTheme || 'emerald';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8 select-none">
      {/* Header with Aesthetic Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--mc-border)] pb-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-[var(--mc-accent)] shrink-0" />
            <span className="truncate">Launcher Preferences &amp; Aesthetic Studio</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1 break-words">
            Personalize launcher branding icons, custom button colors, background themes, and system hardware paths.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="btn-mc btn-mc-green flex items-center justify-center gap-2 px-6 py-2.5 text-white font-black text-xs rounded cursor-pointer font-display shadow-lg shrink-0"
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{saved ? 'Preferences Saved!' : 'Save Preferences'}</span>
        </button>
      </div>

      {/* 1. Custom Launcher App Icon & Branding */}
      <div className="card-obsidian p-5 sm:p-6 rounded-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-sm font-black text-white font-display flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--mc-accent)] shrink-0" />
              <span>Launcher Brand Icon &amp; Crest</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Choose your personal launcher icon preset, upload an image file of your own, or paste any custom icon URL.
            </p>
          </div>

          <label className="btn-mc btn-mc-diamond px-3.5 py-1.5 text-xs font-bold text-white rounded cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shrink-0 font-display">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image File</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleCustomIconUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Preset Icons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2.5">
          {LAUNCHER_ICON_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isSelected =
              localSettings.launcherIcon === preset.id ||
              (!localSettings.launcherIcon && preset.id === 'default');
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleLauncherIconSelect(preset.id)}
                className={`btn-mc p-2.5 rounded-xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer min-w-0 ${isSelected
                  ? 'btn-mc-green text-white ring-2 ring-[var(--mc-accent)] shadow-md'
                  : 'text-slate-300 hover:text-white'
                  }`}
                title={preset.label}
              >
                <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-[var(--mc-accent)] shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono font-bold truncate max-w-full text-center">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom URL Icon Input Form */}
        <form onSubmit={handleApplyCustomIconUrl} className="pt-2 border-t border-white/5 space-y-2">
          <label className="block text-xs font-bold text-slate-300 font-display">
            Or Paste Custom Icon Image URL / Data URI
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Link className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 shrink-0" />
              <input
                type="text"
                placeholder="https://example.com/icon.png or data:image/png;base64,..."
                value={customIconUrlInput}
                onChange={(e) => setCustomIconUrlInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white font-mono focus:outline-none focus:border-[var(--mc-accent)] truncate"
              />
            </div>
            <button
              type="submit"
              className="btn-mc btn-mc-diamond px-4 py-2 text-xs font-bold text-white rounded cursor-pointer font-display shrink-0 shadow-sm"
            >
              Apply Icon URL
            </button>
          </div>
        </form>

        {/* Custom Uploaded Icon Preview */}
        {localSettings.launcherIcon &&
          (localSettings.launcherIcon.startsWith('data:') ||
            localSettings.launcherIcon.startsWith('http')) && (
            <div className="p-3 bg-[var(--mc-badge-bg)] border border-[var(--mc-accent)]/30 rounded-xl flex items-center justify-between gap-3 min-w-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <img
                  src={localSettings.launcherIcon}
                  alt="Custom uploaded launcher icon"
                  className="w-9 h-9 rounded-lg object-cover border border-white/20 shadow-md shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white font-display truncate">
                    Custom Brand Icon Active
                  </div>
                  <div className="text-[10px] text-[var(--mc-accent)] font-mono truncate">
                    Rendered live across the sidebar crest and application window
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleLauncherIconSelect('default')}
                className="btn-mc px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white rounded cursor-pointer shrink-0"
              >
                Reset to Default
              </button>
            </div>
          )}
      </div>

      {/* 2. Tactile Button Colors & Aesthetic Theme Customizer */}
      <div className="card-obsidian p-5 sm:p-6 rounded-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-sm font-black text-white font-display flex items-center gap-2">
              <Palette className="w-4 h-4 text-[var(--mc-accent)] shrink-0" />
              <span>Aesthetic Tactile Button Colors</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Transforms the global 3D highlights, bevels, and active tactile depression of all buttons launcher-wide.
            </p>
          </div>
          <span className="text-[10px] font-mono text-[var(--mc-accent)] bg-[var(--mc-badge-bg)] px-2.5 py-0.5 rounded border border-[var(--mc-accent)]/20 font-bold shrink-0 self-start sm:self-auto">
            Dynamic Bevel Engine
          </span>
        </div>

        {/* Button Color Preset Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-10 gap-2.5">
          {[
            { id: 'emerald', name: 'Emerald', hex: '#2e7d32', highlight: '#70e050', text: 'Classic MC' },
            { id: 'diamond', name: 'Diamond', hex: '#0284c7', highlight: '#7dd3fc', text: 'Glacial Cyan' },
            { id: 'redstone', name: 'Redstone', hex: '#b71c1c', highlight: '#f87171', text: 'Crimson' },
            { id: 'amber', name: 'Nether Gold', hex: '#b45309', highlight: '#fde68a', text: 'Blaze Amber' },
            { id: 'purple', name: 'Ender Void', hex: '#7e22ce', highlight: '#d8b4fe', text: 'Amethyst' },
            { id: 'copper', name: 'Raw Copper', hex: '#c2410c', highlight: '#fdba74', text: 'Rust Orange' },
            { id: 'lapis', name: 'Lapis Lazuli', hex: '#1d4ed8', highlight: '#93c5fd', text: 'Royal Blue' },
            { id: 'obsidian', name: 'Obsidian', hex: '#27272a', highlight: '#71717a', text: 'Stealth' },
            { id: 'netherite', name: 'Netherite', hex: '#332c38', highlight: '#695c74', text: 'Dark Ingot' },
            { id: 'prismarine', name: 'Prismarine', hex: '#0f766e', highlight: '#5eead4', text: 'Teal Monument' },
          ].map((btn) => {
            const isSelected = currentBtnTheme === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleButtonColorSelect(btn.id)}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-2.5 transition-all cursor-pointer shadow-md min-w-0 ${isSelected
                  ? 'ring-2 ring-white border-white scale-[1.02]'
                  : 'border-white/10 hover:border-white/20'
                  }`}
                style={{ backgroundColor: btn.hex }}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/50 shrink-0"
                    style={{ backgroundColor: btn.highlight }}
                  />
                  {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-white font-display leading-tight truncate">
                    {btn.name}
                  </div>
                  <div className="text-[9px] text-white/80 font-mono mt-0.5 truncate">
                    {btn.text}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom Button Color Wheel & Input */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white font-display block">
                Custom Color Picker (Any Hex Value)
              </span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Automatically computes high-contrast 3D highlights, shadows, and hover transitions.
              </p>
            </div>
            <div className="flex items-center gap-2.5 bg-black/60 p-1.5 rounded-xl border border-white/15 shrink-0">
              <input
                type="color"
                value={localSettings.customButtonColor || '#2e7d32'}
                onChange={(e) => handleCustomButtonColorChange(e.target.value)}
                className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent shrink-0"
              />
              <input
                type="text"
                value={localSettings.customButtonColor || '#2e7d32'}
                onChange={(e) => handleCustomButtonColorChange(e.target.value)}
                className="w-24 text-xs font-mono text-white bg-transparent focus:outline-none uppercase font-bold"
              />
            </div>
          </div>
        </div>

        {/* Live Interactive Button Preview Box */}
        <div className="p-4 rounded-xl bg-black/50 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <span className="text-[10px] font-mono uppercase text-[var(--mc-accent)] font-extrabold tracking-wider">
              Live Tactile Button Preview
            </span>
            <div className="text-xs text-slate-200 font-mono truncate">
              Active Style: <strong className="text-white uppercase">{currentBtnTheme}</strong> ({localSettings.customButtonColor || '#2e7d32'})
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => playMinecraftClickSound()}
              className="btn-mc btn-mc-green flex items-center gap-2 px-6 py-2.5 text-white font-black text-xs rounded cursor-pointer font-display shadow-lg"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>TEST PLAY BUTTON</span>
            </button>

            <button
              type="button"
              onClick={() => playMinecraftClickSound()}
              className="btn-mc px-3.5 py-2 text-xs font-bold text-slate-200 hover:text-white rounded cursor-pointer font-display"
            >
              Secondary Stone
            </button>

            <button
              type="button"
              onClick={() => playMinecraftClickSound()}
              className="btn-mc btn-mc-diamond px-3.5 py-2 text-xs font-bold text-white rounded cursor-pointer font-display"
            >
              Diamond Accent
            </button>

            <button
              type="button"
              onClick={() => playMinecraftClickSound()}
              className="btn-mc btn-mc-red px-3 py-2 text-xs font-bold text-white rounded cursor-pointer font-display"
            >
              Danger Stop
            </button>
          </div>
        </div>
      </div>
      <section className="card-obsidian p-5 sm:p-6 rounded-2xl space-y-4">
        <div>
          <h3 className="text-sm font-black text-white font-display flex items-center gap-2">
            <Sun className="w-4 h-4 text-[var(--mc-accent)]" />
            Light &amp; dark appearance
          </h3>
          <p className="text-xs text-slate-400 mt-1">Choose the launcher brightness independently from your accent and texture presets.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          {([
            { id: 'dark', label: 'Dark', Icon: Moon },
            { id: 'light', label: 'Light', Icon: Sun },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                playMinecraftClickSound();
                const updated = { ...localSettings, theme: id };
                setLocalSettings(updated);
                applyLiveChanges(updated);
              }}
              aria-pressed={localSettings.theme === id}
              className={`btn-mc ${localSettings.theme === id ? 'btn-mc-green' : ''} px-4 py-3 rounded flex items-center justify-center gap-2 text-sm font-bold text-white font-display`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* 3. Atmospheric Background & Surface Themes */}
      <div className="card-obsidian p-5 sm:p-6 rounded-2xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-sm font-black text-white font-display flex items-center gap-2">
              <Moon className="w-4 h-4 text-[var(--mc-accent)] shrink-0" />
              <span>Atmospheric Background &amp; Surface Themes</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Instantly transforms the launcher&apos;s viewport glows, stone tiles, borders, and surface depths.
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
            Live Global Retheme
          </span>
        </div>

        {/* Preset Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {Object.values(THEME_PRESETS)
            .filter((t) => t.id !== 'custom')
            .map((p) => {
              const isSelected = localSettings.themePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p.id)}
                  className={`btn-mc p-3 rounded-xl text-left flex flex-col justify-between gap-2.5 transition-all cursor-pointer min-w-0 ${isSelected ? 'ring-2 ring-[var(--mc-accent)] shadow-xl' : ''
                    }`}
                  style={{
                    backgroundColor: p.surfaceColor,
                    borderColor: isSelected ? p.accentColor : p.borderColor,
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-white font-display truncate">
                      {p.name}
                    </span>
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 ml-1"
                      style={{ backgroundColor: p.accentColor }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-300 line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>
                </button>
              );
            })}
        </div>

        {/* Custom Color Wheel / Hex Inputs */}
        <div className="pt-2 border-t border-white/5 space-y-3">
          <label className="block text-xs font-bold text-slate-300 font-display">
            Custom Palette Fine-Tuning (Direct Hex Tints)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-[11px] font-mono text-slate-400 block mb-1">
                Accent Highlight Color
              </span>
              <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/10">
                <input
                  type="color"
                  value={localSettings.customAccentColor || '#10b981'}
                  onChange={(e) => handleCustomColorChange('customAccentColor', e.target.value)}
                  className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent shrink-0"
                />
                <input
                  type="text"
                  value={localSettings.customAccentColor || '#10b981'}
                  onChange={(e) => handleCustomColorChange('customAccentColor', e.target.value)}
                  className="w-full text-xs font-mono text-white bg-transparent focus:outline-none"
                />
              </div>
            </div>

            <div>
              <span className="text-[11px] font-mono text-slate-400 block mb-1">
                Background Deep Tint
              </span>
              <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/10">
                <input
                  type="color"
                  value={localSettings.customBgColor || '#080b11'}
                  onChange={(e) => handleCustomColorChange('customBgColor', e.target.value)}
                  className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent shrink-0"
                />
                <input
                  type="text"
                  value={localSettings.customBgColor || '#080b11'}
                  onChange={(e) => handleCustomColorChange('customBgColor', e.target.value)}
                  className="w-full text-xs font-mono text-white bg-transparent focus:outline-none"
                />
              </div>
            </div>

            <div>
              <span className="text-[11px] font-mono text-slate-400 block mb-1">
                Surface Card Tint
              </span>
              <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/10">
                <input
                  type="color"
                  value={localSettings.customSurfaceColor || '#121622'}
                  onChange={(e) => handleCustomColorChange('customSurfaceColor', e.target.value)}
                  className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent shrink-0"
                />
                <input
                  type="text"
                  value={localSettings.customSurfaceColor || '#121622'}
                  onChange={(e) => handleCustomColorChange('customSurfaceColor', e.target.value)}
                  className="w-full text-xs font-mono text-white bg-transparent focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Older Hardware & Dedicated Resource Management */}
      <div className="card-obsidian p-5 sm:p-6 rounded-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white font-display flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[var(--mc-accent)] shrink-0" />
            <span>Older Hardware &amp; Dedicated Resource Allocation</span>
          </h3>
          <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold shrink-0">
            Performance Engine
          </span>
        </div>

        {/* Low-Spec Toggle */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="space-y-0.5 pr-4 min-w-0">
              <span className="text-xs font-bold text-white font-display flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Low-Spec Hardware Mode (Potato PC Mode)</span>
              </span>
              <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                Disables backdrop blur filters, heavy drop shadows, and complex animations to maximize FPS on older dual-core laptops and legacy graphics.
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.lowSpecMode}
              onChange={(e) => handleToggleLowSpec(e.target.checked)}
              className="w-5 h-5 accent-[var(--mc-accent)] rounded cursor-pointer shrink-0"
            />
          </label>
        </div>

        {/* Dedicated GPU & Threads with Aesthetic Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="pr-3 min-w-0">
                <span className="text-xs font-bold text-white font-display flex items-center gap-2">
                  <Monitor className="w-3.5 h-3.5 text-[var(--mc-accent)] shrink-0" />
                  <span>Force Dedicated GPU Offload</span>
                </span>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-relaxed">
                  Injects NVIDIA / AMD discrete GPU flags (NV_PRIME / DRI_PRIME) for gaming laptops.
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.dedicatedGpuOffload}
                onChange={(e) => {
                  playMinecraftClickSound();
                  const updated = { ...localSettings, dedicatedGpuOffload: e.target.checked };
                  setLocalSettings(updated);
                  applyLiveChanges(updated);
                }}
                className="w-4 h-4 accent-[var(--mc-accent)] rounded cursor-pointer shrink-0"
              />
            </label>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2 min-w-0">
            <label className="block text-xs font-bold text-white font-display mb-1">
              CPU Affinity Allocation
            </label>
            <select
              value={localSettings.cpuThreadAffinity}
              onChange={(e) => {
                playMinecraftClickSound();
                const updated = { ...localSettings, cpuThreadAffinity: e.target.value as any };
                setLocalSettings(updated);
                applyLiveChanges(updated);
              }}
              className="select-mc w-full text-xs font-mono py-2 px-3"
            >
              <option value="all">All Available Cores &amp; Hyperthreads</option>
              <option value="high_priority">High Priority Scheduling (Auto Pinning)</option>
              <option value="4_cores">Cap at 4 Physical Performance Cores</option>
              <option value="2_cores">Cap at 2 Cores (Low Heat / Battery Saver)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Directory & Downloads */}
      <div className="card-obsidian p-5 sm:p-6 rounded-2xl space-y-5">
        <h3 className="text-sm font-black text-white font-display flex items-center gap-2">
          <Folder className="w-4 h-4 text-[var(--mc-accent)] shrink-0" />
          <span>Game Storage &amp; Network Downloads</span>
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 font-display mb-1">
              Shared Game Directory
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={localSettings.gameDirectory}
                onChange={(e) => {
                  const updated = { ...localSettings, gameDirectory: e.target.value };
                  setLocalSettings(updated);
                  applyLiveChanges(updated);
                }}
                className="flex-1 px-3.5 py-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white font-mono focus:outline-none focus:border-[var(--mc-accent)] min-w-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 font-display mb-1">
                Max Concurrent Download Streams
              </label>
              <input
                type="number"
                min={1}
                max={16}
                value={localSettings.maxConcurrentDownloads}
                onChange={(e) => {
                  const updated = { ...localSettings, maxConcurrentDownloads: Number(e.target.value) };
                  setLocalSettings(updated);
                  applyLiveChanges(updated);
                }}
                className="w-full px-3 py-2 text-xs bg-black/50 border border-white/10 rounded-lg text-white font-mono focus:outline-none focus:border-[var(--mc-accent)]"
              />
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={handleExportConfig}
                className="btn-mc btn-mc-diamond w-full py-2 px-3 text-xs font-bold text-white rounded flex items-center justify-center gap-2 cursor-pointer shadow-sm font-display"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export Launcher Profile (.json)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
