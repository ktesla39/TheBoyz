export type ReleaseType = 'release' | 'snapshot' | 'old_beta' | 'old_alpha';

export interface MojangVersionManifestEntry {
  id: string;
  type: ReleaseType;
  url: string;
  time: string;
  releaseTime: string;
  sha1?: string;
  complianceLevel?: number;
}

export interface MojangVersionManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MojangVersionManifestEntry[];
}

export interface ModrinthSearchResult {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  categories: string[];
  client_side: string;
  server_side: string;
  body?: string;
  project_type: 'mod' | 'modpack' | 'resourcepack' | 'shader' | 'datapack';
  downloads: number;
  icon_url: string | null;
  author: string;
  display_categories: string[];
  versions: string[];
  follows: number;
  date_created: string;
  date_modified: string;
  latest_version?: string;
  license: string;
}

export interface CurseForgeSearchResult {
  id: number;
  name: string;
  slug: string;
  summary: string;
  downloadCount: number;
  classId: number | null;
  logoUrl: string | null;
  author: string;
  gameVersions: string[];
  loaders: number[];
  websiteUrl: string | null;
}

export interface CurseForgeSearchResponse {
  totalCount: number;
  data: CurseForgeSearchResult[];
}

export interface DownloadTask {
  id: string;
  title: string;
  category: 'version' | 'library' | 'asset' | 'mod' | 'loader' | 'pack';
  status: 'pending' | 'downloading' | 'verifying' | 'completed' | 'failed' | 'paused';
  progress: number; // 0 - 100
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  targetPath?: string;
  sha1?: string;
  error?: string;
  startTime: number;
  completedTime?: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  source: 'LAUNCHER' | 'JVM' | 'MINECRAFT' | 'LOADER' | 'SYSTEM';
  message: string;
}

export interface SystemHardwareInfo {
  os: string;
  cpuCores: number | null;
  totalRamGb: number | null;
  gpuVendor: string | null;
  gpuRenderer: string | null;
  supportedApis: {
    opengl: boolean;
    vulkan: boolean | null;
    directx12: boolean | null;
  };
  installedJavaVersions: {
    version: number;
    path: string;
    arch: string;
    vendor: string;
  }[] | null;
}
