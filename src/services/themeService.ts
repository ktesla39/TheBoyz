export type ThemePreset =
  | 'obsidian'
  | 'deepslate'
  | 'nether'
  | 'ender'
  | 'emerald'
  | 'glacial'
  | 'redstone'
  | 'cyber'
  | 'oled'
  | 'custom';

export interface ThemeConfig {
  id: ThemePreset;
  name: string;
  description: string;
  bgColor: string;
  surfaceColor: string;
  surfaceHover: string;
  borderColor: string;
  accentColor: string;
  accentHover: string;
  badgeBg: string;
  badgeText: string;
  glowColor: string;
}

export const THEME_PRESETS: Record<ThemePreset, ThemeConfig> = {
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Dark',
    description: 'Deep obsidian purple-charcoal base with vibrant emerald accents and portal sheen',
    bgColor: '#080b11',
    surfaceColor: '#121622',
    surfaceHover: '#181e2e',
    borderColor: '#212738',
    accentColor: '#10b981',
    accentHover: '#059669',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeText: '#34d399',
    glowColor: 'rgba(16, 185, 129, 0.25)',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Grove',
    description: 'Lush mossy deepslate with vibrant Minecraft emerald block and XP orb shimmer',
    bgColor: '#070f0b',
    surfaceColor: '#0e1c15',
    surfaceHover: '#14271e',
    borderColor: '#193828',
    accentColor: '#059669',
    accentHover: '#10b981',
    badgeBg: 'rgba(5, 150, 105, 0.2)',
    badgeText: '#6ee7b7',
    glowColor: 'rgba(16, 185, 129, 0.35)',
  },
  glacial: {
    id: 'glacial',
    name: 'Glacial Diamond',
    description: 'Frosted blue packed ice textures with brilliant cyan diamond crystal reflections',
    bgColor: '#060c14',
    surfaceColor: '#0e1824',
    surfaceHover: '#142335',
    borderColor: '#1a334d',
    accentColor: '#00d2ff',
    accentHover: '#38bdf8',
    badgeBg: 'rgba(0, 210, 255, 0.15)',
    badgeText: '#7dd3fc',
    glowColor: 'rgba(56, 189, 248, 0.3)',
  },
  deepslate: {
    id: 'deepslate',
    name: 'Deepslate Classic',
    description: 'Authentic textured Minecraft stone & deepslate with diamond cyan accents',
    bgColor: '#0b0e14',
    surfaceColor: '#161b26',
    surfaceHover: '#1e2535',
    borderColor: '#262f40',
    accentColor: '#06b6d4',
    accentHover: '#0891b2',
    badgeBg: 'rgba(6, 182, 212, 0.15)',
    badgeText: '#22d3ee',
    glowColor: 'rgba(6, 182, 212, 0.25)',
  },
  nether: {
    id: 'nether',
    name: 'Nether Crimson',
    description: 'Blazing nether fortress atmosphere with fiery amber-gold accents and ember pulses',
    bgColor: '#10080a',
    surfaceColor: '#1e0f14',
    surfaceHover: '#2a151c',
    borderColor: '#381c25',
    accentColor: '#f59e0b',
    accentHover: '#d97706',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeText: '#fbbf24',
    glowColor: 'rgba(245, 158, 11, 0.3)',
  },
  ender: {
    id: 'ender',
    name: 'Ender Void',
    description: 'Mystical end realm void purple with glowing dragon eye lavender and end dust',
    bgColor: '#090712',
    surfaceColor: '#141024',
    surfaceHover: '#1d1733',
    borderColor: '#2b2046',
    accentColor: '#a855f7',
    accentHover: '#9333ea',
    badgeBg: 'rgba(168, 85, 247, 0.15)',
    badgeText: '#c084fc',
    glowColor: 'rgba(168, 85, 247, 0.3)',
  },
  redstone: {
    id: 'redstone',
    name: 'Redstone Core',
    description: 'Industrial high-voltage redstone engineering with ruby crimson glow',
    bgColor: '#0f0808',
    surfaceColor: '#1c1010',
    surfaceHover: '#291717',
    borderColor: '#381d1d',
    accentColor: '#ef4444',
    accentHover: '#dc2626',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    badgeText: '#f87171',
    glowColor: 'rgba(239, 68, 68, 0.3)',
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Matrix',
    description: 'Futuristic high-tech gaming launcher with neon electric mint accents',
    bgColor: '#040b0e',
    surfaceColor: '#0a171d',
    surfaceHover: '#0f222b',
    borderColor: '#152b36',
    accentColor: '#14b8a6',
    accentHover: '#0d9488',
    badgeBg: 'rgba(20, 184, 166, 0.15)',
    badgeText: '#2dd4bf',
    glowColor: 'rgba(20, 184, 166, 0.25)',
  },
  oled: {
    id: 'oled',
    name: 'OLED Pure Black',
    description: 'Zero pixel power, maximum contrast true black for older laptops and OLEDs',
    bgColor: '#000000',
    surfaceColor: '#0c0c0c',
    surfaceHover: '#161616',
    borderColor: '#1e1e1e',
    accentColor: '#22c55e',
    accentHover: '#16a34a',
    badgeBg: 'rgba(34, 197, 94, 0.15)',
    badgeText: '#4ade80',
    glowColor: 'rgba(34, 197, 94, 0.2)',
  },
  custom: {
    id: 'custom',
    name: 'Custom Theme',
    description: 'Fully personalized color palette crafted by the player',
    bgColor: '#080b11',
    surfaceColor: '#121622',
    surfaceHover: '#181e2e',
    borderColor: '#212738',
    accentColor: '#10b981',
    accentHover: '#059669',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeText: '#34d399',
    glowColor: 'rgba(16, 185, 129, 0.25)',
  },
};

export function adjustHexBrightness(hex: string, percent: number): string {
  let num = parseInt(hex.replace('#', ''), 16);
  if (isNaN(num)) return hex;
  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function generateButtonShades(baseHex: string) {
  return {
    bg: baseHex,
    bgHover: adjustHexBrightness(baseHex, 15),
    bgActive: adjustHexBrightness(baseHex, -22),
    border: adjustHexBrightness(baseHex, -50),
    highlight: adjustHexBrightness(baseHex, 38),
    shadow: adjustHexBrightness(baseHex, -35),
    accent: baseHex,
  };
}

export const BUTTON_COLOR_PRESETS: Record<string, {
  name: string;
  bg: string;
  bgHover: string;
  bgActive: string;
  border: string;
  highlight: string;
  shadow: string;
  accent: string;
}> = {
  emerald: {
    name: 'Emerald Play Green (Default)',
    bg: '#2e7d32',
    bgHover: '#388e3c',
    bgActive: '#1b531f',
    border: '#103814',
    highlight: '#70e050',
    shadow: '#134217',
    accent: '#10b981',
  },
  diamond: {
    name: 'Glacial Diamond Cyan',
    bg: '#0284c7',
    bgHover: '#38bdf8',
    bgActive: '#075985',
    border: '#082f49',
    highlight: '#7dd3fc',
    shadow: '#075985',
    accent: '#00d2ff',
  },
  redstone: {
    name: 'Redstone Core Crimson',
    bg: '#b71c1c',
    bgHover: '#ef4444',
    bgActive: '#7f1d1d',
    border: '#450a0a',
    highlight: '#f87171',
    shadow: '#5e0e0e',
    accent: '#ef4444',
  },
  amber: {
    name: 'Nether Blaze Amber Gold',
    bg: '#b45309',
    bgHover: '#f59e0b',
    bgActive: '#78350f',
    border: '#451a03',
    highlight: '#fde68a',
    shadow: '#78350f',
    accent: '#f59e0b',
  },
  purple: {
    name: 'Ender Void Amethyst',
    bg: '#7e22ce',
    bgHover: '#a855f7',
    bgActive: '#581c87',
    border: '#3b0764',
    highlight: '#d8b4fe',
    shadow: '#581c87',
    accent: '#a855f7',
  },
  copper: {
    name: 'Raw Copper Rust',
    bg: '#c2410c',
    bgHover: '#ea580c',
    bgActive: '#7c2d12',
    border: '#431407',
    highlight: '#fdba74',
    shadow: '#7c2d12',
    accent: '#f97316',
  },
  lapis: {
    name: 'Lapis Lazuli Royal Blue',
    bg: '#1d4ed8',
    bgHover: '#2563eb',
    bgActive: '#1e3a8a',
    border: '#172554',
    highlight: '#93c5fd',
    shadow: '#1e3a8a',
    accent: '#3b82f6',
  },
  obsidian: {
    name: 'Obsidian Stealth Carbon',
    bg: '#27272a',
    bgHover: '#3f3f46',
    bgActive: '#18181b',
    border: '#09090b',
    highlight: '#71717a',
    shadow: '#09090b',
    accent: '#a1a1aa',
  },
  netherite: {
    name: 'Netherite Ingot Steel',
    bg: '#332c38',
    bgHover: '#473e4e',
    bgActive: '#221d26',
    border: '#17131a',
    highlight: '#695c74',
    shadow: '#151217',
    accent: '#a78bfa',
  },
  prismarine: {
    name: 'Prismarine Shimmer Teal',
    bg: '#0f766e',
    bgHover: '#14b8a6',
    bgActive: '#115e59',
    border: '#042f2e',
    highlight: '#5eead4',
    shadow: '#042f2e',
    accent: '#2dd4bf',
  },
};

export function applyLauncherTheme(
  preset: ThemePreset,
  customConfig?: Partial<ThemeConfig>,
  lowSpecMode = false,
  buttonTheme: string = 'emerald',
  customBtnHex?: string,
  colorScheme: 'dark' | 'light' | 'system' = 'dark'
): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const resolvedColorScheme = colorScheme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : colorScheme;
  root.setAttribute('data-color-scheme', resolvedColorScheme);
  root.style.colorScheme = resolvedColorScheme;
  const base = THEME_PRESETS[preset];
  if (!base) throw new Error(`Unknown theme preset "${preset}".`);
  const config: ThemeConfig = {
    ...base,
    ...customConfig,
  };

  root.setAttribute('data-theme', config.id);

  root.style.setProperty('--mc-bg', resolvedColorScheme === 'light' ? '#e5e2d9' : config.bgColor);
  root.style.setProperty('--mc-surface', resolvedColorScheme === 'light' ? '#f3f0e8' : config.surfaceColor);
  root.style.setProperty('--mc-surface-hover', resolvedColorScheme === 'light' ? '#e9e5da' : config.surfaceHover);
  root.style.setProperty('--mc-border', resolvedColorScheme === 'light' ? '#bcb7aa' : config.borderColor);
  root.style.setProperty('--mc-text', resolvedColorScheme === 'light' ? '#292820' : '#e2e8f0');
  root.style.setProperty('--mc-muted', resolvedColorScheme === 'light' ? '#575247' : '#94a3b8');
  root.style.setProperty('--mc-panel', resolvedColorScheme === 'light' ? '#f3f0e8' : config.surfaceColor);
  root.style.setProperty('--mc-panel-raised', resolvedColorScheme === 'light' ? '#fffdf7' : config.surfaceHover);
  root.style.setProperty('--mc-line', resolvedColorScheme === 'light' ? '#bcb7aa' : config.borderColor);
  root.style.setProperty('--mc-accent', config.accentColor);
  root.style.setProperty('--mc-accent-hover', config.accentHover);
  root.style.setProperty('--mc-badge-bg', config.badgeBg);
  root.style.setProperty('--mc-badge-text', config.badgeText);
  root.style.setProperty('--mc-glow-color', config.glowColor);

  // Apply button color theme dynamically
  const shades =
    buttonTheme === 'custom'
      ? customBtnHex
        ? generateButtonShades(customBtnHex)
        : null
      : BUTTON_COLOR_PRESETS[buttonTheme] ?? null;
  if (!shades) throw new Error(`No button colors are configured for "${buttonTheme}".`);

  root.style.setProperty('--mc-btn-primary', shades.bg);
  root.style.setProperty('--mc-btn-primary-hover', shades.bgHover);
  root.style.setProperty('--mc-btn-primary-active', shades.bgActive);
  root.style.setProperty('--mc-btn-primary-border', shades.border);
  root.style.setProperty('--mc-btn-primary-highlight', shades.highlight);
  root.style.setProperty('--mc-btn-primary-shadow', shades.shadow);

  if (lowSpecMode) {
    root.classList.add('low-spec-mode');
  } else {
    root.classList.remove('low-spec-mode');
  }
}
