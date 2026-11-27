import { ModrinthSearchResult } from '../types/launcher';
import { ModLoaderType } from '../types/instance';

const MODRINTH_API = 'https://api.modrinth.com/v2';

export interface SearchOptions {
  query?: string;
  projectType?: 'mod' | 'modpack' | 'resourcepack' | 'shader' | 'datapack';
  loader?: ModLoaderType;
  gameVersion?: string;
  sortBy?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';
  limit?: number;
  offset?: number;
}

export async function searchModrinth(
  options: SearchOptions = {}
): Promise<{ hits: ModrinthSearchResult[]; total_hits: number }> {
  const params = new URLSearchParams();
  if (options.query !== undefined) params.append('query', options.query);
  params.append('limit', String(options.limit ?? 20));
  params.append('offset', String(options.offset ?? 0));
  params.append('index', options.sortBy ?? 'downloads');

  const facets: string[][] = [];
  if (options.projectType) facets.push([`project_type:${options.projectType}`]);
  if (options.loader && options.loader !== 'vanilla') facets.push([`categories:${options.loader}`]);
  if (options.gameVersion) facets.push([`versions:${options.gameVersion}`]);
  if (facets.length > 0) params.append('facets', JSON.stringify(facets));

  const response = await fetch(`${MODRINTH_API}/search?${params.toString()}`, {
    headers: {
      'User-Agent': 'TheBoys-MinecraftLauncher/1.0.0 (contact@theboyslauncher.dev)',
    },
  });
  if (!response.ok) {
    throw new Error(`Modrinth search failed with status ${response.status}`);
  }

  const data = await response.json() as { hits: ModrinthSearchResult[]; total_hits: number };
  if (!Array.isArray(data.hits) || typeof data.total_hits !== 'number') {
    throw new Error('Modrinth returned an invalid search response.');
  }
  return data;
}

export async function fetchProjectDetails(projectIdOrSlug: string): Promise<unknown> {
  const response = await fetch(`${MODRINTH_API}/project/${encodeURIComponent(projectIdOrSlug)}`, {
    headers: {
      'User-Agent': 'TheBoys-MinecraftLauncher/1.0.0 (contact@theboyslauncher.dev)',
    },
  });
  if (!response.ok) {
    throw new Error(`Modrinth project lookup failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchLatestProjectVersion(
  projectId: string,
  gameVersion: string,
  loader?: ModLoaderType,
): Promise<{ version_number: string } | null> {
  const params = new URLSearchParams({ game_versions: JSON.stringify([gameVersion]) });
  if (loader && loader !== 'vanilla') {
    params.set('loaders', JSON.stringify([loader]));
  }
  const response = await fetch(
    `${MODRINTH_API}/project/${encodeURIComponent(projectId)}/version?${params}`,
    {
      headers: {
        'User-Agent': 'TheBoys-MinecraftLauncher/1.0.0 (contact@theboyslauncher.dev)',
      },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Modrinth version lookup failed with status ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Modrinth returned an invalid project version list.');
  }
  if (data.length === 0) return null;

  const latest = data[0];
  if (
    !latest ||
    typeof latest !== 'object' ||
    !('version_number' in latest) ||
    typeof latest.version_number !== 'string'
  ) {
    throw new Error('Modrinth returned an invalid project version.');
  }
  return { version_number: latest.version_number };
}
