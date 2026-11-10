import { MojangVersionManifest, MojangVersionManifestEntry, ReleaseType } from '../types/launcher';

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

let cachedManifest: MojangVersionManifest | null = null;

export async function fetchMojangVersionManifest(): Promise<MojangVersionManifest> {
  if (cachedManifest) return cachedManifest;

  const response = await fetch(MANIFEST_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Minecraft version manifest: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (
    !data ||
    typeof data !== 'object' ||
    !('latest' in data) ||
    !('versions' in data) ||
    !data.latest ||
    typeof data.latest !== 'object' ||
    !('release' in data.latest) ||
    typeof data.latest.release !== 'string' ||
    !('snapshot' in data.latest) ||
    typeof data.latest.snapshot !== 'string' ||
    !Array.isArray(data.versions) ||
    !data.versions.every((version) =>
      version &&
      typeof version === 'object' &&
      'id' in version &&
      typeof version.id === 'string' &&
      'type' in version &&
      ['release', 'snapshot', 'old_beta', 'old_alpha'].includes(String(version.type)) &&
      'releaseTime' in version &&
      typeof version.releaseTime === 'string'
    )
  ) {
    throw new Error('Mojang returned an invalid Minecraft version manifest.');
  }

  const manifest = data as MojangVersionManifest;
  cachedManifest = manifest;
  return manifest;
}

export function getRecommendedJavaVersion(minecraftVersion: string): number | null {
  if (/^(?:26\.|26w)/.test(minecraftVersion)) return 25;
  if (/^(1\.21|1\.20\.(5|6)|24w)/.test(minecraftVersion)) return 21;
  if (/^(1\.20|1\.19|1\.18)/.test(minecraftVersion)) return 17;
  if (minecraftVersion.startsWith('1.17')) return 16;
  if (/^(1\.(16|15|14|13|12|11|10|9|8|7|6|5|4|3|2)|b|a)/.test(minecraftVersion)) return 8;
  return null;
}

export function filterVersions(
  manifest: MojangVersionManifest,
  search: string,
  typeFilter: ReleaseType | 'all'
): MojangVersionManifestEntry[] {
  let list = manifest.versions;

  if (typeFilter !== 'all') {
    list = list.filter((version) => version.type === typeFilter);
  }

  if (search.trim()) {
    const query = search.trim().toLowerCase();
    list = list.filter((version) => version.id.toLowerCase().includes(query));
  }

  return list;
}
