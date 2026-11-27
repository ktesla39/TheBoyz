import { MinecraftInstance, ServerBookmark } from '../types/instance';
import { LauncherAccount } from '../types/auth';
import { ThemePreset } from './themeService';

const STORAGE_KEYS = {
  INSTANCES: 'theboys_instances_v2',
  ACTIVE_INSTANCE: 'theboys_active_instance_v2',
  ACCOUNTS: 'theboys_accounts_v2',
  ACTIVE_ACCOUNT: 'theboys_active_account_v2',
  SETTINGS: 'theboys_settings_v2',
  SERVERS: 'theboys_servers_v2',
  FIRST_RUN_ACCOUNT_CHOICE: 'theboys_first_run_account_choice_v1',
};

export interface LauncherSettings {
  theme: 'dark' | 'light' | 'system';
  themePreset: ThemePreset;
  customBgColor?: string;
  customAccentColor?: string;
  customSurfaceColor?: string;
  buttonStyle: 'classic_mc' | 'modern_deepslate' | 'futuristic_glow';
  launcherIcon?: string;
  buttonColorTheme?: 'emerald' | 'diamond' | 'redstone' | 'amber' | 'purple' | 'copper' | 'lapis' | 'obsidian' | 'netherite' | 'prismarine' | 'custom';
  customButtonColor?: string;
  soundEffectsEnabled: boolean;
  lowSpecMode: boolean;
  dedicatedGpuOffload: boolean;
  cpuThreadAffinity: 'all' | 'high_priority' | '2_cores' | '4_cores';
  afterLaunchAction: 'keep_open' | 'minimize' | 'hide_to_tray' | 'close';
  maxConcurrentDownloads: number;
  downloadSpeedLimitMb: number;
  discordRpcEnabled: boolean;
  autoUpdateChecks: boolean;
  gameDirectory: string;
}

export const DEFAULT_SETTINGS: LauncherSettings = {
  theme: 'dark',
  themePreset: 'obsidian',
  customBgColor: '#080b11',
  customAccentColor: '#10b981',
  customSurfaceColor: '#121622',
  buttonStyle: 'classic_mc',
  launcherIcon: 'default',
  buttonColorTheme: 'emerald',
  customButtonColor: '#2e7d32',
  soundEffectsEnabled: true,
  lowSpecMode: false,
  dedicatedGpuOffload: true,
  cpuThreadAffinity: 'all',
  afterLaunchAction: 'keep_open',
  maxConcurrentDownloads: 4,
  downloadSpeedLimitMb: 0,
  discordRpcEnabled: true,
  autoUpdateChecks: true,
  gameDirectory: '',
};

function readStoredArray<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (raw === null) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as T[];
    throw new Error(`Stored value "${key}" must be an array.`);
  } catch (reason) {
    preserveInvalidStoredValue(key, raw, reason);
    return [];
  }
}

function preserveInvalidStoredValue(key: string, raw: string, reason: unknown): void {
  const backupKey = `${key}_invalid_${Date.now()}`;
  try {
    localStorage.setItem(backupKey, raw);
  } catch (backupReason) {
    console.error(`Could not preserve invalid launcher data from "${key}".`, backupReason);
  }
  console.error(`Launcher data in "${key}" is invalid; using an empty/default value.`, reason);
}

/** Fills fields that older or hand-edited saves may lack so the UI never reads undefined. */
function normalizeInstance(raw: MinecraftInstance): MinecraftInstance {
  const javaConfig = (raw.javaConfig ?? {}) as Partial<MinecraftInstance['javaConfig']>;
  const resolution = (raw.resolution ?? {}) as Partial<MinecraftInstance['resolution']>;
  return {
    ...raw,
    graphicsApi: raw.graphicsApi ?? 'auto',
    javaConfig: {
      path: javaConfig.path ?? '',
      version: javaConfig.version ?? 17,
      minMemoryMb: javaConfig.minMemoryMb ?? 2048,
      maxMemoryMb: javaConfig.maxMemoryMb ?? 4096,
      jvmArguments: javaConfig.jvmArguments ?? [],
      garbageCollector: javaConfig.garbageCollector ?? 'G1GC',
    },
    resolution: {
      width: resolution.width ?? 1920,
      height: resolution.height ?? 1080,
      fullscreen: resolution.fullscreen ?? false,
    },
    mods: raw.mods ?? [],
    packs: raw.packs ?? [],
    worlds: raw.worlds ?? [],
    screenshots: raw.screenshots ?? [],
    backups: raw.backups ?? [],
  };
}

export function loadSavedInstances(): MinecraftInstance[] {
  return readStoredArray<MinecraftInstance>(STORAGE_KEYS.INSTANCES)
    .filter((instance) => instance && typeof instance === 'object' && typeof instance.id === 'string')
    .map(normalizeInstance);
}

function writeStored(key: string, value: string): void {
  // Storage can be full (large data-URL icons/skins) or unavailable; never let that crash the UI.
  try {
    localStorage.setItem(key, value);
  } catch (reason) {
    console.error(`Could not save launcher data for "${key}".`, reason);
  }
}

export function saveInstances(instances: MinecraftInstance[]): void {
  writeStored(STORAGE_KEYS.INSTANCES, JSON.stringify(instances));
}

export function loadSavedAccounts(): LauncherAccount[] {
  return readStoredArray<LauncherAccount>(STORAGE_KEYS.ACCOUNTS);
}

export function saveAccounts(accounts: LauncherAccount[]): void {
  const safeAccounts = accounts.map((account) => {
    if (account.type !== 'microsoft') return account;
    const { accessToken: _accessToken, refreshToken: _refreshToken, ...profile } = account;
    return profile;
  });
  writeStored(STORAGE_KEYS.ACCOUNTS, JSON.stringify(safeAccounts));
}

export function loadSavedServers(): ServerBookmark[] {
  // A ping that was in flight when the launcher closed would otherwise stay "checking" forever.
  return readStoredArray<ServerBookmark>(STORAGE_KEYS.SERVERS).map((server) =>
    server.status === 'checking' ? { ...server, status: 'offline' as const } : server
  );
}

export function saveServers(servers: ServerBookmark[]): void {
  writeStored(STORAGE_KEYS.SERVERS, JSON.stringify(servers));
}

export function loadActiveInstanceId(): string {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_INSTANCE) ?? '';
}

export function saveActiveInstanceId(id: string): void {
  writeStored(STORAGE_KEYS.ACTIVE_INSTANCE, id);
}

export function loadActiveAccountId(): string {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_ACCOUNT) ?? '';
}

export function saveActiveAccountId(id: string): void {
  writeStored(STORAGE_KEYS.ACTIVE_ACCOUNT, id);
}

export function loadSettings(): LauncherSettings {
  const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (raw === null) return DEFAULT_SETTINGS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Stored value "${STORAGE_KEYS.SETTINGS}" must be an object.`);
    }
    const saved = parsed as Partial<LauncherSettings> & { closeAfterLaunch?: boolean };
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      afterLaunchAction:
        saved.afterLaunchAction ?? (saved.closeAfterLaunch ? 'close' : DEFAULT_SETTINGS.afterLaunchAction),
    };
  } catch (reason) {
    preserveInvalidStoredValue(STORAGE_KEYS.SETTINGS, raw, reason);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: LauncherSettings): void {
  writeStored(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function hasShownFirstRunAccountChoice(): boolean {
  return localStorage.getItem(STORAGE_KEYS.FIRST_RUN_ACCOUNT_CHOICE) === 'true';
}

export function markFirstRunAccountChoiceShown(): void {
  writeStored(STORAGE_KEYS.FIRST_RUN_ACCOUNT_CHOICE, 'true');
}
