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
  buttonColorTheme?: 'emerald' | 'diamond' | 'redstone' | 'amber' | 'purple' | 'obsidian' | 'custom';
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

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Stored value "${key}" must be an array.`);
  }
  return parsed as T[];
}

export function loadSavedInstances(): MinecraftInstance[] {
  return readStoredArray<MinecraftInstance>(STORAGE_KEYS.INSTANCES);
}

export function saveInstances(instances: MinecraftInstance[]): void {
  localStorage.setItem(STORAGE_KEYS.INSTANCES, JSON.stringify(instances));
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
  localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(safeAccounts));
}

export function loadSavedServers(): ServerBookmark[] {
  return readStoredArray<ServerBookmark>(STORAGE_KEYS.SERVERS);
}

export function saveServers(servers: ServerBookmark[]): void {
  localStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(servers));
}

export function loadActiveInstanceId(): string {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_INSTANCE) ?? '';
}

export function saveActiveInstanceId(id: string): void {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_INSTANCE, id);
}

export function loadActiveAccountId(): string {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_ACCOUNT) ?? '';
}

export function saveActiveAccountId(id: string): void {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_ACCOUNT, id);
}

export function loadSettings(): LauncherSettings {
  const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (raw === null) return DEFAULT_SETTINGS;
  const saved = JSON.parse(raw) as Partial<LauncherSettings> & { closeAfterLaunch?: boolean };
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    afterLaunchAction:
      saved.afterLaunchAction ?? (saved.closeAfterLaunch ? 'close' : DEFAULT_SETTINGS.afterLaunchAction),
  };
}

export function saveSettings(settings: LauncherSettings): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function hasShownFirstRunAccountChoice(): boolean {
  return localStorage.getItem(STORAGE_KEYS.FIRST_RUN_ACCOUNT_CHOICE) === 'true';
}

export function markFirstRunAccountChoiceShown(): void {
  localStorage.setItem(STORAGE_KEYS.FIRST_RUN_ACCOUNT_CHOICE, 'true');
}
