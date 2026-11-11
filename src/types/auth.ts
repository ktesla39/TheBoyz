export type AccountType = 'offline' | 'microsoft';

export type SkinProvider = 'ely.by' | 'mojang' | 'custom_url' | 'upload';
export type SkinModel = 'classic' | 'slim'; // classic = 4px Steve arms, slim = 3px Alex arms

export interface OfflineProfile {
  id: string;
  type: 'offline';
  username: string;
  uuid: string; // Offline UUID (deterministic v3 from OfflinePlayer:<username> or custom)
  skinType: 'steve' | 'alex' | 'custom';
  skinProvider?: SkinProvider;
  skinUrl?: string; // Raw 64x64/64x32 PNG URL or Base64 data URL
  capeUrl?: string; // Optional cape texture URL or Ely.by cloak URL
  capeName?: string;
  model?: SkinModel;
  createdAt: number;
  lastUsed: number;
  customDisplayName?: string;
}

export interface MicrosoftAccount {
  id: string;
  type: 'microsoft';
  username: string;
  customDisplayName?: string;
  uuid: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
  ownsGame: boolean;
  skinProvider?: SkinProvider;
  skinUrl?: string;
  capeUrl?: string;
  capeName?: string;
  model?: SkinModel;
  createdAt: number;
  lastUsed: number;
}

export type LauncherAccount = OfflineProfile | MicrosoftAccount;

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
}
