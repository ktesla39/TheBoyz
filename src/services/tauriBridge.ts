import { invoke as tauriInvoke, isTauri } from '@tauri-apps/api/core';
import { MinecraftInstance } from '../types/instance';
import { LauncherAccount } from '../types/auth';
import { CurseForgeSearchResponse } from '../types/launcher';

export const isTauriEnvironment = (): boolean =>
  typeof window !== 'undefined' && isTauri();

function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriEnvironment()) {
    throw new Error('This operation is available only in the desktop launcher.');
  }
  return tauriInvoke<T>(cmd, args);
}

export interface TauriHardwareInfo {
  os: string;
  os_version: string;
  total_memory_mb: number;
  available_memory_mb: number;
  cpu_brand: string;
  cpu_cores: number;
  disk_free_gb: number;
  is_low_spec: boolean;
  recommended_ram_mb: number;
}

export interface TauriJavaInstallation {
  path: string;
  major_version: number;
  full_version: string;
  vendor: string | null;
  is_64_bit: boolean | null;
}

export interface LauncherProgress {
  phase: string;
  message: string;
  file: string | null;
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
}

export interface TauriLaunchResult {
  success: boolean;
  pid: number | null;
  executable: string;
  args: string[];
  message: string;
}

export interface TauriImportedInstance {
  id: string;
  name: string;
  game_version: string;
  loader: MinecraftInstance['loader'];
  loader_version: string | null;
  custom_game_dir: string;
  mods: Array<{
    file_name: string;
    name: string;
    enabled: boolean;
    size_bytes: number;
  }>;
}

export async function invokeImportMinecraftInstance(sourcePath: string): Promise<TauriImportedInstance> {
  return invokeTauri<TauriImportedInstance>('import_minecraft_instance', {
    sourcePath,
  });
}

export async function invokeLaunchGame(
  instance: MinecraftInstance,
  account: LauncherAccount,
  serverAddress?: string,
  lowSpecMode = false
): Promise<TauriLaunchResult> {
  return invokeTauri<TauriLaunchResult>('launch_game', {
    payload: {
      instance_id: instance.id,
      instance_name: instance.name,
      game_version: instance.gameVersion,
      loader: instance.loader,
      loader_version: instance.loaderVersion,
      java_path: instance.javaConfig.path || undefined,
      custom_game_dir: instance.customGameDir,
      min_ram_mb: instance.javaConfig.minMemoryMb,
      max_ram_mb: instance.javaConfig.maxMemoryMb,
      username: account.username,
      uuid: account.uuid,
      access_token: account.type === 'microsoft' ? account.accessToken : 'offline',
      jvm_args: instance.javaConfig.jvmArguments,
      graphics_api: instance.graphicsApi,
      low_spec_mode: lowSpecMode,
      dedicated_gpu: true,
      server_address: serverAddress,
      resolution_width: instance.resolution.width,
      resolution_height: instance.resolution.height,
      fullscreen: instance.resolution.fullscreen,
    },
  });
}

export async function invokeInstallMinecraftInstance(instance: MinecraftInstance): Promise<string> {
  return invokeTauri<string>('install_minecraft_instance', {
    request: {
      instance_id: instance.id,
      instance_name: instance.name,
      game_version: instance.gameVersion,
      loader: instance.loader,
      loader_version: instance.loaderVersion,
      java_path: instance.javaConfig.path || undefined,
      custom_game_dir: instance.customGameDir,
    },
  });
}

export async function invokeGetSystemHardware(): Promise<TauriHardwareInfo> {
  return invokeTauri<TauriHardwareInfo>('get_system_hardware');
}

export async function invokeDetectJava(): Promise<TauriJavaInstallation[]> {
  return invokeTauri<TauriJavaInstallation[]>('detect_java_installations');
}

export interface TauriMicrosoftCredentials {
  access_token: string;
  refresh_token?: string | null;
  expires_at: number;
}

export async function invokeSaveMicrosoftCredentials(
  accountId: string,
  credentials: TauriMicrosoftCredentials
): Promise<void> {
  return invokeTauri<void>('save_microsoft_credentials', {
    accountId,
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token,
    expiresAt: credentials.expires_at,
  });
}

export async function invokeGetMicrosoftCredentials(
  accountId: string
): Promise<TauriMicrosoftCredentials | null> {
  return invokeTauri<TauriMicrosoftCredentials | null>('get_microsoft_credentials', { accountId });
}

export async function invokeClearMicrosoftCredentials(accountId: string): Promise<void> {
  return invokeTauri<void>('clear_microsoft_credentials', { accountId });
}

export async function invokeCurseForgeKeyStatus(): Promise<boolean> {
  return invokeTauri<boolean>('get_curseforge_key_status');
}

export async function invokeSaveCurseForgeApiKey(apiKey: string): Promise<void> {
  return invokeTauri<void>('save_curseforge_api_key', { apiKey });
}

export async function invokeClearCurseForgeApiKey(): Promise<void> {
  return invokeTauri<void>('clear_curseforge_api_key');
}

export async function invokeSearchCurseForge(options: {
  query?: string;
  classId?: number;
  gameVersion?: string;
  modLoaderType?: number;
  sortField: number;
  index: number;
  pageSize: number;
}): Promise<CurseForgeSearchResponse> {
  return invokeTauri<CurseForgeSearchResponse>('search_curseforge', options);
}

export async function invokeFetchElyBySkin(username: string): Promise<{ skin_url: string; cape_url?: string }> {
  return invokeTauri('fetch_ely_by_skin', { username });
}

export async function invokeVerifyFileHash(filePath: string, expectedSha1?: string): Promise<boolean> {
  const result = await invokeTauri<{ matches: boolean }>('verify_file_hash', {
    filePath,
    expectedSha1,
  });
  return result.matches;
}

export async function invokePingMinecraftServer(address: string): Promise<{
  address: string;
  online: boolean;
  ping_ms: number;
  motd: string | null;
  players_online: number | null;
  players_max: number | null;
}> {
  return invokeTauri('ping_minecraft_server', { address });
}

export async function invokeCreateDesktopShortcut(instanceName: string, instanceId: string): Promise<string> {
  return invokeTauri('create_desktop_shortcut', { instanceName, instanceId });
}

export async function invokeStopGame(pid: number): Promise<boolean> {
  return invokeTauri('stop_game', { pid });
}

export async function invokeIsGameRunning(pid: number): Promise<boolean> {
  return invokeTauri('is_game_running', { pid });
}

export async function invokeSaveSkinFile(username: string, base64Png: string): Promise<string> {
  return invokeTauri('save_skin_file', { username, base64Png });
}

export async function invokeListInstanceMods(instanceId: string): Promise<Array<{
  file_name: string;
  name: string;
  enabled: boolean;
  size_bytes: number;
}>> {
  return invokeTauri('list_instance_mods', { instanceId });
}

export async function invokeToggleModFile(instanceId: string, fileName: string, enable: boolean): Promise<string> {
  return invokeTauri('toggle_mod_file', { instanceId, fileName, enable });
}

export async function invokeDeleteModFile(instanceId: string, fileName: string): Promise<boolean> {
  return invokeTauri('delete_mod_file', { instanceId, fileName });
}
