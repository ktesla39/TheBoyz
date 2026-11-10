import {
  OfflineProfile,
  MicrosoftAccount,
  DeviceCodeResponse,
  SkinProvider,
  SkinModel,
} from '../types/auth';

/**
 * Generates an offline Minecraft UUID based on the standard UUID v3 formula:
 * MD5("OfflinePlayer:" + username) with version 3 and variant 1 bits set.
 */
function md5Utf8(value: string): Uint8Array {
  const input = new TextEncoder().encode(value);
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const bitLength = input.length * 8;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, bitLength >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true);

  const shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const constants = Array.from({ length: 64 }, (_, i) =>
    Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0
  );
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const words = new DataView(bytes.buffer);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const block = Array.from({ length: 16 }, (_, i) => words.getUint32(offset + i * 4, true));
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const sum = (a + f + constants[i] + block[g]) >>> 0;
      const shift = shifts[i];
      const rotated = ((sum << shift) | (sum >>> (32 - shift))) >>> 0;
      [a, b, c, d] = [d, (b + rotated) >>> 0, b, c];
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const digest = new Uint8Array(16);
  const digestView = new DataView(digest.buffer);
  [a0, b0, c0, d0].forEach((word, index) => digestView.setUint32(index * 4, word, true));
  return digest;
}

export function generateOfflineUuid(username: string): string {
  const bytes = md5Utf8(`OfflinePlayer:${username}`);
  bytes[6] = (bytes[6] & 0x0f) | 0x30;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function validateUsername(username: string): { valid: boolean; error?: string } {
  const trimmed = username.trim();
  if (!trimmed) {
    return { valid: false, error: 'Username cannot be empty.' };
  }
  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long.' };
  }
  if (trimmed.length > 16) {
    return { valid: false, error: 'Username cannot exceed 16 characters.' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { valid: false, error: 'Username can only contain alphanumeric characters and underscores.' };
  }
  return { valid: true };
}

const MS_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID?.trim();

function requireMicrosoftClientId(): string {
  if (!MS_CLIENT_ID) {
    throw new Error('Microsoft sign-in is not configured. Set VITE_MICROSOFT_CLIENT_ID before building the launcher.');
  }
  return MS_CLIENT_ID;
}

/** Official Standard Steve Skin Texture URL */
export const STEVE_SKIN_TEXTURE =
  'https://textures.minecraft.net/texture/4454b5df5b7218679f225d36e2f17195d886ff0d3c01f60fa00dd1d2931168f8';

/** Official Standard Alex Skin Texture URL */
export const ALEX_SKIN_TEXTURE =
  'https://textures.minecraft.net/texture/a6b47c617180bf857f6b95b4526d1a93b0e352d1c6fe9bf867c4bf7f0beecb59';

/**
 * Returns skin URL for Ely.by skinsystem
 * Ely.by provides textures via http://skinsystem.ely.by/textures/<username>
 */
export function getElyBySkinUrl(username: string): string {
  const clean = username.trim();
  return `http://skinsystem.ely.by/textures/${encodeURIComponent(clean)}`;
}

/**
 * Returns cape URL for Ely.by skinsystem
 */
export function getElyByCapeUrl(username: string): string {
  const clean = username.trim();
  return `http://skinsystem.ely.by/cloaks/${encodeURIComponent(clean)}`;
}

/**
 * Returns Mojang / official player skin URL
 */
export function getMojangSkinUrl(username: string): string {
  const clean = username.trim();
  return `https://minotar.net/skin/${encodeURIComponent(clean)}`;
}

/**
 * Creates an offline profile with full skin and provider configuration
 */
export function createOfflineProfile(
  username: string,
  options: {
    skinProvider: SkinProvider;
    model: SkinModel;
    skinUrl?: string;
    uuid?: string;
    displayName?: string;
  }
): OfflineProfile {
  const uuid = options.uuid?.trim() || generateOfflineUuid(username.trim());
  const resolvedSkinUrl = options.skinUrl ??
    (options.skinProvider === 'ely.by'
      ? getElyBySkinUrl(username)
      : options.skinProvider === 'mojang'
        ? getMojangSkinUrl(username)
        : undefined);
  if (!resolvedSkinUrl) throw new Error('A skin URL is required for this profile.');

  return {
    id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: 'offline',
    username: username.trim(),
    uuid,
    skinType: options.skinProvider === 'upload' || options.skinProvider === 'custom_url'
      ? 'custom'
      : options.model === 'slim'
        ? 'alex'
        : 'steve',
    skinProvider: options.skinProvider,
    skinUrl: resolvedSkinUrl,
    model: options.model,
    createdAt: Date.now(),
    lastUsed: Date.now(),
    customDisplayName: options.displayName?.trim() || undefined,
  };
}

/**
 * Validates and reads an uploaded skin PNG file from user's filesystem
 */
export function validateAndProcessSkinFile(file: File): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  detectedModel: SkinModel;
}> {
  return new Promise((resolve, reject) => {
    if (!file.type.includes('png') && !file.name.toLowerCase().endsWith('.png')) {
      return reject(new Error('Invalid file format. Minecraft skins must be a PNG image.'));
    }

    if (file.size > 2 * 1024 * 1024) {
      return reject(new Error('Skin file is too large (maximum 2MB).'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result !== 'string') {
        reject(new Error('The selected skin could not be read as a data URL.'));
        return;
      }
      const dataUrl = result;
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        if (!((width === 64 && height === 64) || (width === 64 && height === 32) || (width === 128 && height === 128))) {
          return reject(
            new Error(
              `Invalid skin dimensions (${width}x${height}). Standard Minecraft skins are 64x64 or 64x32.`
            )
          );
        }

        // Detect if slim (Alex) or classic (Steve) by inspecting the 4th column of right arm (pixel at x=54, y=20)
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not inspect the selected skin image.');
          ctx.drawImage(img, 0, 0);
          const skinScale = width / 64;
          const pixel = ctx.getImageData(54 * skinScale, 20 * skinScale, 1, 1).data;
          const detectedModel: SkinModel = pixel[3] === 0 ? 'slim' : 'classic';
          resolve({ dataUrl, width, height, detectedModel });
        } catch (reason) {
          reject(reason instanceof Error ? reason : new Error(String(reason)));
        }
      };
      img.onerror = () => reject(new Error('Failed to load image file.'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Failed to read file from disk.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Initiates Microsoft Device Code OAuth flow
 */
export async function requestMicrosoftDeviceCode(): Promise<DeviceCodeResponse> {
  const clientId = requireMicrosoftClientId();
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'XboxLive.signin offline_access',
  });
  const response = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || `Device code request failed with status ${response.status}`);
  }

  if (
    typeof data.device_code !== 'string' ||
    typeof data.user_code !== 'string' ||
    typeof data.verification_uri !== 'string' ||
    typeof data.expires_in !== 'number' ||
    typeof data.interval !== 'number' ||
    typeof data.message !== 'string'
  ) {
    throw new Error('Microsoft returned an incomplete device authorization response.');
  }
  return data as DeviceCodeResponse;
}

function waitForAuthorizationInterval(intervalSeconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Microsoft sign-in cancelled.', 'AbortError'));
      return;
    }

    const abort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Microsoft sign-in cancelled.', 'AbortError'));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, intervalSeconds * 1000);
    signal.addEventListener('abort', abort, { once: true });
  });
}

/**
 * Exchanges a Microsoft device authorization for a verified Minecraft profile.
 */
export async function completeMicrosoftLogin(
  deviceCode: DeviceCodeResponse,
  signal: AbortSignal
): Promise<MicrosoftAccount> {
  const clientId = requireMicrosoftClientId();
  const tokenUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
  const deadline = Date.now() + deviceCode.expires_in * 1000;
  let interval = deviceCode.interval;
  let microsoftAccessToken: string | undefined;
  let microsoftRefreshToken: string | undefined;

  while (Date.now() < deadline) {
    await waitForAuthorizationInterval(interval, signal);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: clientId,
        device_code: deviceCode.device_code,
      }),
      signal,
    });
    const tokenData = await response.json();

    if (response.ok && typeof tokenData.access_token === 'string') {
      microsoftAccessToken = tokenData.access_token;
      if (typeof tokenData.refresh_token === 'string') microsoftRefreshToken = tokenData.refresh_token;
      break;
    }
    if (tokenData.error === 'authorization_pending') continue;
    if (tokenData.error === 'slow_down') {
      interval += 5;
      continue;
    }
    throw new Error(tokenData.error_description || `Microsoft sign-in failed with status ${response.status}`);
  }

  if (!microsoftAccessToken) {
    throw new Error('Microsoft device authorization expired before it was approved.');
  }

  return exchangeMicrosoftToken(microsoftAccessToken, microsoftRefreshToken, signal);
}

export async function refreshMicrosoftAccount(
  account: MicrosoftAccount,
  refreshToken: string,
): Promise<MicrosoftAccount> {
  const clientId = requireMicrosoftClientId();
  const response = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken,
      scope: 'XboxLive.signin offline_access',
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const tokenData = await response.json();
  if (!response.ok || typeof tokenData.access_token !== 'string') {
    throw new Error(tokenData.error_description || `Microsoft token refresh failed with status ${response.status}. Sign in again if this continues.`);
  }
  const nextRefreshToken = typeof tokenData.refresh_token === 'string' ? tokenData.refresh_token : refreshToken;
  const updated = await exchangeMicrosoftToken(tokenData.access_token, nextRefreshToken, AbortSignal.timeout(30_000));
  if (updated.id !== account.id) throw new Error('Microsoft returned a different Minecraft profile during token refresh. Sign in again.');
  return { ...account, ...updated, createdAt: account.createdAt, lastUsed: Date.now() };
}

async function exchangeMicrosoftToken(
  microsoftAccessToken: string,
  microsoftRefreshToken: string | undefined,
  signal: AbortSignal,
): Promise<MicrosoftAccount> {
  const xboxResponse = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${microsoftAccessToken}`,
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    }),
    signal,
  });
  const xboxData = await xboxResponse.json();
  if (!xboxResponse.ok || typeof xboxData.Token !== 'string' || typeof xboxData.DisplayClaims?.xui?.[0]?.uhs !== 'string') {
    throw new Error(xboxData.Message || `Xbox authentication failed with status ${xboxResponse.status}`);
  }
  const userHash = xboxData.DisplayClaims.xui[0].uhs as string;

  const xstsResponse = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: { SandboxId: 'RETAIL', UserTokens: [xboxData.Token] },
      RelyingParty: 'http://xboxlive.com',
      TokenType: 'JWT',
    }),
    signal,
  });
  const xstsData = await xstsResponse.json();
  if (!xstsResponse.ok || typeof xstsData.Token !== 'string') {
    throw new Error(xstsData.Message || `Xbox security authentication failed with status ${xstsResponse.status}`);
  }

  const minecraftResponse = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${userHash};${xstsData.Token}` }),
    signal,
  });
  const minecraftData = await minecraftResponse.json();
  if (!minecraftResponse.ok || typeof minecraftData.access_token !== 'string') {
    throw new Error(minecraftData.errorMessage || `Minecraft authentication failed with status ${minecraftResponse.status}`);
  }

  const profileResponse = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Authorization: `Bearer ${minecraftData.access_token}` },
    signal,
  });
  const profile = await profileResponse.json();
  if (!profileResponse.ok || typeof profile.id !== 'string' || typeof profile.name !== 'string') {
    throw new Error(profile.errorMessage || `Minecraft profile request failed with status ${profileResponse.status}`);
  }

  const skin = profile.skins?.[0];
  return {
    id: profile.id,
    type: 'microsoft',
    username: profile.name,
    uuid: profile.id,
    accessToken: minecraftData.access_token,
    refreshToken: microsoftRefreshToken,
    expiresAt: Date.now() + (typeof minecraftData.expires_in === 'number' ? minecraftData.expires_in : 86400) * 1000,
    ownsGame: true,
    skinProvider: 'mojang',
    skinUrl: skin?.url,
    model: skin?.variant === 'SLIM' ? 'slim' : skin?.variant === 'CLASSIC' ? 'classic' : undefined,
    createdAt: Date.now(),
    lastUsed: Date.now(),
  };
}
