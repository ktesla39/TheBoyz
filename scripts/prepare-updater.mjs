import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repository = process.env.GITHUB_REPOSITORY;
const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();
const privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY?.trim();
const privateKeyPassword = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
const tag = process.env.GITHUB_REF_NAME;
const version = tag?.replace(/^v/, '');

if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
  throw new Error('GITHUB_REPOSITORY must be set to owner/repository.');
}
if (!publicKey) {
  throw new Error('Set the TAURI_UPDATER_PUBLIC_KEY GitHub Actions variable.');
}
if (!privateKey) {
  throw new Error('Set the TAURI_SIGNING_PRIVATE_KEY GitHub Actions secret.');
}
if (!privateKeyPassword) {
  throw new Error('Set the TAURI_SIGNING_PRIVATE_KEY_PASSWORD GitHub Actions secret.');
}
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Release tag "${tag ?? ''}" must be vMAJOR.MINOR.PATCH.`);
}

const configPath = process.env.TAURI_CONFIG_PATH
  ? path.resolve(process.env.TAURI_CONFIG_PATH)
  : fileURLToPath(new URL('../src-tauri/tauri.conf.json', import.meta.url));
const config = JSON.parse(await readFile(configPath, 'utf8'));
config.version = version;
config.plugins ??= {};
config.plugins.updater = {
  ...config.plugins.updater,
  endpoints: [`https://github.com/${repository}/releases/latest/download/latest.json`],
  pubkey: publicKey,
  requireSignedVersion: true,
};

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Prepared signed updater metadata for ${repository} ${version}.`);
