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

  if (!isOpen) return null;

  const instanceId = instance.id;
  const instanceName = instance.name.replace(/[^\w\s-]/g, '').trim();
  const javaPath = instance.javaConfig.path.trim();
  const instanceDirectory = instance.customGameDir?.trim() ?? '';
  const jvmArgs = instance.javaConfig.jvmArguments.join(' ');
  const canGenerateShortcut = Boolean(javaPath && instanceDirectory);

  // Windows Batch Launcher (.bat)
  const windowsBatContent = `@echo off
title The Boys Launcher - Starting ${instance.name}
echo ===================================================
echo   THE BOYS MINECRAFT LAUNCHER - INSTANT LAUNCHER
echo   Launching Instance: ${instance.name}
echo   Minecraft: ${instance.gameVersion} (${instance.loader.toUpperCase()})
echo ===================================================
echo Allocating ${instance.javaConfig.maxMemoryMb}MB RAM...

set JAVA_BIN="${javaPath}"
set MIN_RAM=${instance.javaConfig.minMemoryMb}M
set MAX_RAM=${instance.javaConfig.maxMemoryMb}M
set JVM_ARGS=${jvmArgs}

start "" %JAVA_BIN% -Xms%MIN_RAM% -Xmx%MAX_RAM% %JVM_ARGS% -Dminecraft.launcher.brand=TheBoys -Dminecraft.instance=${instanceId} -jar "${instanceDirectory}\\client.jar"

echo Java process started; this shortcut does not monitor its exit status.
timeout /t 3 >nul
exit
`;

  // Linux / Steam Deck Desktop Shortcut (.desktop)
  const linuxDesktopContent = `[Desktop Entry]
Name=${instance.name} (Minecraft ${instance.gameVersion})
Comment=Launch ${instance.name} using The Boys Next-Gen Minecraft Launcher
Exec=sh -c '"${javaPath}" -Xms${instance.javaConfig.minMemoryMb}M -Xmx${instance.javaConfig.maxMemoryMb}M ${jvmArgs} -jar "${instanceDirectory}/client.jar"'
Icon=minecraft
Terminal=false
Type=Application
Categories=Game;Simulation;
StartupNotify=true
`;

  // macOS / Unix Script (.command)
  const macosCommandContent = `#!/bin/bash
# The Boys Minecraft Launcher - Instant Game Launch Script
echo "Launching ${instance.name} (Minecraft ${instance.gameVersion})..."
cd "${instanceDirectory}" || exit 1
"${javaPath}" -Xms${instance.javaConfig.minMemoryMb}M -Xmx${instance.javaConfig.maxMemoryMb}M ${jvmArgs} -jar "${instanceDirectory}/client.jar"
`;

  const getActiveContent = () => {
    switch (platform) {
      case 'windows':
        return {
          filename: `Launch ${instanceName}.bat`,
          content: windowsBatContent,
          mime: 'text/plain',
          instructions: 'Save this .bat file directly on your Desktop. Double-click it anytime to launch this instance directly with your configured JVM flags without opening launcher settings.',
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
    URL.revokeObjectURL(url);
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

          {/* Setup Instructions */}
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-mono">
            <strong>How to use:</strong> {activeData.instructions}
          </div>
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
            onClick={handleDownload}
            disabled={!canGenerateShortcut}
            className="btn-mc btn-mc-green flex items-center gap-2 px-5 py-2 text-white font-black text-xs rounded cursor-pointer font-display disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            <span>Download Desktop Shortcut</span>
          </button>
        </div>
      </div>
    </div>
  );
};
