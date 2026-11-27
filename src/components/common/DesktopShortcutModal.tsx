import React, { useState } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Monitor,
  Terminal,
  Shield,
  ExternalLink,
  Sparkles,
  Layers,
} from 'lucide-react';
import { MinecraftInstance } from '../../types/instance';
import { playMinecraftClickSound, playMinecraftLevelUpSound } from '../../services/soundService';
import {
  invokeCreateDesktopShortcut,
  isTauriEnvironment,
} from '../../services/tauriBridge';

interface DesktopShortcutModalProps {
  isOpen: boolean;
  onClose: () => void;
  instance: MinecraftInstance;
}

export const DesktopShortcutModal: React.FC<DesktopShortcutModalProps> = ({
  isOpen,
  onClose,
  instance,
}) => {
  const [platform, setPlatform] = useState<'windows' | 'linux' | 'macos'>('windows');
  const [copied, setCopied] = useState(false);
  const [creatingShortcut, setCreatingShortcut] = useState(false);
  const [shortcutMessage, setShortcutMessage] = useState<string | null>(null);
  const [shortcutError, setShortcutError] = useState<string | null>(null);

  if (!isOpen) return null;

  const instanceId = instance.id;
  const instanceName = instance.name.replace(/[^\w\s-]/g, '').trim();
  const createsNativeWindowsShortcut = platform === 'windows' && isTauriEnvironment();
  // Generated scripts hand the instance to the launcher itself (it owns the classpath, auth and
  // natives, so `java -jar client.jar` can never start a modern Minecraft install).
  const canGenerateShortcut = true;
  const safeDisplayName = instance.name.replace(/[\r\n]+/g, ' ');

  // Windows Batch Launcher (.bat)
  const windowsBatContent = `@echo off
rem Point LAUNCHER at the installed launcher executable before using this file.
set "LAUNCHER=C:\\Program Files\\The Boys\\The Boys.exe"
if not exist "%LAUNCHER%" (
  echo Edit this file and set LAUNCHER to the full path of The Boys launcher.
  pause
  exit /b 1
)
start "" "%LAUNCHER%" --launch-instance ${instanceId}
`;

  // Linux / Steam Deck Desktop Shortcut (.desktop)
  const linuxDesktopContent = `[Desktop Entry]
Name=${safeDisplayName} (Minecraft ${instance.gameVersion})
Comment=Launch ${safeDisplayName} using The Boys launcher
# Replace /opt/the-boys/the-boys with the real path of the launcher executable.
Exec="/opt/the-boys/the-boys" --launch-instance ${instanceId}
Icon=minecraft
Terminal=false
Type=Application
Categories=Game;
StartupNotify=true
`;

  // macOS / Unix Script (.command)
  const macosCommandContent = `#!/bin/bash
# Replace this path with the real location of the launcher executable if it differs.
LAUNCHER="/Applications/The Boys.app/Contents/MacOS/The Boys"
if [ ! -x "$LAUNCHER" ]; then
  echo "Edit this script and set LAUNCHER to the launcher executable."
  exit 1
fi
"$LAUNCHER" --launch-instance ${instanceId} &
`;

  const getActiveContent = () => {
    switch (platform) {
      case 'windows':
        return {
          filename: createsNativeWindowsShortcut
            ? `Launch ${instanceName}.lnk`
            : `Launch ${instanceName}.bat`,
          content: createsNativeWindowsShortcut ? '' : windowsBatContent,
          mime: createsNativeWindowsShortcut ? 'application/octet-stream' : 'text/plain',
          instructions: createsNativeWindowsShortcut
            ? 'Create a real Windows shortcut that opens this launcher and immediately starts the selected instance.'
            : 'Save this .bat file on your Desktop and set LAUNCHER to your launcher executable. It opens the launcher and starts this instance.',
        };
      case 'linux':
        return {
          filename: `${instanceId}.desktop`,
          content: linuxDesktopContent,
          mime: 'application/x-desktop',
          instructions: 'Place this file on your Desktop or in ~/.local/share/applications/ and right-click -> "Allow Launching". Works natively on Linux, Ubuntu, Arch, and Steam Deck!',
        };
      case 'macos':
        return {
          filename: `Launch ${instanceName}.command`,
          content: macosCommandContent,
          mime: 'application/x-sh',
          instructions: 'Save this file to your Desktop. Run "chmod +x filename.command" in Terminal once, then double-click anytime to launch Minecraft!',
        };
    }
  };

  const activeData = getActiveContent();

  const handleDownload = () => {
    playMinecraftLevelUpSound();
    const blob = new Blob([activeData.content], { type: activeData.mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeData.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const createIconIcoBase64 = async (): Promise<string> => {
    const brand = document.querySelector<HTMLElement>('[data-launcher-brand-icon]');
    if (!brand) throw new Error('Could not find the selected launcher icon. Reopen the shortcut dialog and try again.');

    const svg = brand.querySelector('svg');
    const customImage = brand.querySelector('img');
    let source: string;
    let objectUrl: string | null = null;
    if (svg) {
      const icon = svg.cloneNode(true) as SVGSVGElement;
      icon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      icon.setAttribute('width', '256');
      icon.setAttribute('height', '256');
      icon.removeAttribute('class');
      objectUrl = URL.createObjectURL(new Blob(
        [new XMLSerializer().serializeToString(icon)],
        { type: 'image/svg+xml;charset=utf-8' },
      ));
      source = objectUrl;
    } else if (customImage) {
      source = customImage.currentSrc || customImage.src;
    } else {
      throw new Error('The selected launcher icon could not be rendered for the shortcut.');
    }

    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare the launcher icon image.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Could not encode the launcher icon image.'));
        }, 'image/png');
      });
      const pngBytes = new Uint8Array(await png.arrayBuffer());
      const ico = new Uint8Array(22 + pngBytes.length);
      const view = new DataView(ico.buffer);
      view.setUint16(0, 0, true);
      view.setUint16(2, 1, true);
      view.setUint16(4, 1, true);
      ico[6] = 0;
      ico[7] = 0;
      ico[8] = 0;
      ico[9] = 0;
      view.setUint16(10, 1, true);
      view.setUint16(12, 32, true);
      view.setUint32(14, pngBytes.length, true);
      view.setUint32(18, 22, true);
      ico.set(pngBytes, 22);
      let binary = '';
      for (let offset = 0; offset < ico.length; offset += 0x8000) {
        binary += String.fromCharCode(...ico.subarray(offset, offset + 0x8000));
      }
      return btoa(binary);
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  };

  const handleCreateShortcut = async () => {
    if (createsNativeWindowsShortcut) {
      setCreatingShortcut(true);
      setShortcutMessage(null);
      setShortcutError(null);
      try {
        const iconIcoBase64 = await createIconIcoBase64();
        const path = await invokeCreateDesktopShortcut(instance.name, instance.id, iconIcoBase64);
        setShortcutMessage(`Shortcut created: ${path}`);
      } catch (reason) {
        setShortcutError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setCreatingShortcut(false);
      }
      return;
    }
    handleDownload();
  };

  const handleCopy = () => {
    playMinecraftClickSound();
    navigator.clipboard.writeText(activeData.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="card-obsidian border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#0a0d14]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white font-display">
                Create Desktop Shortcut
              </h3>
              <p className="text-xs text-slate-400 font-mono truncate max-w-sm">
                Target Instance: <span className="text-emerald-400 font-bold">{instance.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              playMinecraftClickSound();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* OS Selector Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-300 font-display mb-2">
              Select Operating System
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-black/50 border border-white/5">
              {[
                { id: 'windows', label: 'Windows (.bat)' },
                { id: 'linux', label: 'Linux / Steam Deck (.desktop)' },
                { id: 'macos', label: 'macOS (.command)' },
              ].map((os) => (
                <button
                  key={os.id}
                  type="button"
                  onClick={() => {
                    playMinecraftClickSound();
                    setPlatform(os.id as any);
                  }}
                  className={`py-2 px-2 text-xs font-bold rounded-lg font-display transition-all cursor-pointer truncate ${
                    platform === os.id
                      ? 'btn-mc btn-mc-diamond text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {os.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Info Banner */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Shortcut Target:</span>
              <span className="text-white font-bold">{activeData.filename}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Included Memory:</span>
              <span className="text-emerald-400 font-bold">{instance.javaConfig.minMemoryMb}M - {instance.javaConfig.maxMemoryMb}M</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Mod Loader:</span>
              <span className="text-cyan-400 font-bold uppercase">{instance.loader} {instance.gameVersion}</span>
            </div>
          </div>

          {/* Code Preview Box */}
          {!createsNativeWindowsShortcut && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 font-mono flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Script Contents Preview</span>
                </label>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!canGenerateShortcut}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-[#080b11] border border-white/10 text-slate-300 font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto select-text break-anywhere">
                {activeData.content}
              </pre>
            </div>
          )}

          {/* Setup Instructions */}
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-mono">
            <strong>How to use:</strong> {activeData.instructions}
          </div>
          {createsNativeWindowsShortcut && (
            <p className="text-xs text-slate-400">
              This shortcut will use the launcher icon selected in Settings.
            </p>
          )}
          {shortcutMessage && (
            <p className="break-all rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-300">
              {shortcutMessage}
            </p>
          )}
          {shortcutError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
              {shortcutError}
            </p>
          )}
          {!canGenerateShortcut && (
            <p className="text-xs text-amber-300">
              Configure a Java executable and instance directory before generating a shortcut.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-[#0a0d14] shrink-0">
          <button
            type="button"
            onClick={() => {
              playMinecraftClickSound();
              onClose();
            }}
            className="btn-mc px-4 py-2 text-xs font-bold text-slate-300 rounded cursor-pointer font-display"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => void handleCreateShortcut()}
            disabled={!canGenerateShortcut || creatingShortcut}
            className="btn-mc btn-mc-green flex items-center gap-2 px-5 py-2 text-white font-black text-xs rounded cursor-pointer font-display disabled:opacity-40"
          >
            {createsNativeWindowsShortcut ? <Monitor className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            <span>{creatingShortcut
              ? 'Creating…'
              : createsNativeWindowsShortcut
                ? 'Create Desktop Shortcut'
                : 'Download Desktop Shortcut'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
