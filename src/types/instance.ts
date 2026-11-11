export type ModLoaderType = 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt';

export type GraphicsApiType = 'auto' | 'opengl' | 'vulkan' | 'directx12';

export interface JavaConfig {
  path: string;
  version: number; // e.g. 8, 17, 21
  minMemoryMb: number; // e.g. 2048
  maxMemoryMb: number; // e.g. 4096
  jvmArguments: string[];
  garbageCollector: 'G1GC' | 'ZGC' | 'Shenandoah' | 'ParallelGC' | 'Default';
}

export interface InstalledMod {
  id: string;
  name: string;
  filename: string;
  version: string;
  enabled: boolean;
  author?: string;
  description?: string;
  iconUrl?: string;
  sizeBytes?: number;
  sha1?: string;
  downloadUrl?: string;
  source: 'modrinth' | 'curseforge' | 'local';
  modrinthId?: string;
  dependencies?: string[];
  hasUpdate?: boolean;
  latestVersion?: string;
}

export interface InstalledPack {
  id: string;
  name: string;
  filename: string;
  type: 'resourcepack' | 'shader' | 'datapack';
  enabled: boolean;
  order: number;
  description?: string;
  iconUrl?: string;
  source: 'modrinth' | 'curseforge' | 'local';
}

export interface MinecraftWorld {
  id: string;
  name: string;
  folderName: string;
  gameMode: 'survival' | 'creative' | 'hardcore' | 'adventure';
  difficulty?: 'peaceful' | 'easy' | 'normal' | 'hard';
  lastPlayed: number;
  sizeMb: number;
  seed?: string;
  cheatsEnabled?: boolean;
  iconUrl?: string;
}

export interface ScreenshotItem {
  id: string;
  filename: string;
  url: string;
  dateTaken: number;
  sizeKb: number;
  width: number;
  height: number;
}

export interface InstanceBackup {
  id: string;
  instanceId: string;
  name: string;
  timestamp: number;
  sizeMb: number;
  modsCount: number;
  savesCount: number;
}

export interface ServerBookmark {
  id: string;
  name: string;
  address: string; // e.g. 'mc.hypixel.net'
  motd: string | null;
  onlinePlayers: number | null;
  maxPlayers: number | null;
  pingMs: number | null;
  versionRequired: string | null;
  iconUrl?: string;
  status: 'online' | 'offline' | 'checking' | 'error';
  error?: string;
}

export interface MinecraftInstance {
  id: string;
  name: string;
  icon: string; // e.g. 'diamond_sword', 'dirt', 'creeper', 'netherite'
  gameVersion: string; // e.g. '1.21.4'
  loader: ModLoaderType;
  loaderVersion?: string; // e.g. '0.16.10'
  graphicsApi: GraphicsApiType;
  javaConfig: JavaConfig;
  resolution: {
    width: number;
    height: number;
    fullscreen: boolean;
  };
  mods: InstalledMod[];
  packs: InstalledPack[];
  worlds: MinecraftWorld[];
  screenshots: ScreenshotItem[];
  backups: InstanceBackup[];
  createdAt: number;
  lastPlayed?: number;
  lastLaunchDurationMs?: number;
  totalPlayTimeMinutes: number;
  customGameDir?: string;
}
