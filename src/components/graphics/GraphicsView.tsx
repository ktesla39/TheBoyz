import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  Info,
  Layers,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { detectSystemHardware, getGraphicsApiReport } from '../../services/hardwareService';
import { SystemHardwareInfo } from '../../types/launcher';
import { MinecraftInstance, GraphicsApiType } from '../../types/instance';
import {
  invokeDetectGraphicsApiVersions,
  isTauriEnvironment,
  TauriGraphicsApiVersions,
} from '../../services/tauriBridge';
import {
  OpenGlApiIcon,
  VulkanApiIcon,
  DirectXIcon,
  GpuCardIcon,
  RamChipIcon,
} from '../icons/MinecraftIcons';

interface GraphicsViewProps {
  activeInstance: MinecraftInstance | null;
  onUpdateGraphicsApi: (instanceId: string, api: GraphicsApiType) => void;
}

export const GraphicsView: React.FC<GraphicsViewProps> = ({
  activeInstance,
  onUpdateGraphicsApi,
}) => {
  const [hardware, setHardware] = useState<SystemHardwareInfo | null>(null);
  const [apiVersions, setApiVersions] = useState<TauriGraphicsApiVersions | null>(null);
  const [isScanningApis, setIsScanningApis] = useState(false);
  const [apiScanError, setApiScanError] = useState<string | null>(null);

  useEffect(() => {
    setHardware(detectSystemHardware());
  }, []);

  if (!hardware) return null;

  const currentApi = activeInstance?.graphicsApi || 'opengl';
  const report = getGraphicsApiReport(currentApi, hardware);
  const scanGraphicsApis = async () => {
    if (!isTauriEnvironment()) {
      setApiScanError('Graphics API version scanning is available in the desktop launcher.');
      return;
    }
    setIsScanningApis(true);
    setApiScanError(null);
    try {
      setApiVersions(await invokeDetectGraphicsApiVersions());
    } catch (reason) {
      setApiScanError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsScanningApis(false);
    }
  };

  const apis: Array<{
    id: GraphicsApiType;
    title: string;
    description: string;
    badge: string;
    isNative: boolean;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'opengl',
      title: 'OpenGL 4.6 (Native Java Pipeline)',
      description: 'Standard Minecraft rendering pipeline with LWJGL 3 bindings. 100% compatibility with vanilla, all mod loaders, and standard shader packs.',
      badge: 'STABLE / NATIVE',
      isNative: true,
      icon: OpenGlApiIcon,
    },
    {
      id: 'vulkan',
      title: 'Vulkan (High GPU Utilization)',
      description: 'Replaces OpenGL with modern Vulkan bytecode via VulkanMod. Drastically lowers CPU drawcall bottlenecks and improves frame pacing.',
      badge: 'REQUIRES VULKANMOD',
      isNative: false,
      icon: VulkanApiIcon,
    },
    {
      id: 'directx12',
      title: 'DirectX 12 (Translation Layer)',
      description: 'Transfers OpenGL commands through Microsoft D3D12/Zink translation layers on supported Windows WDDM 2.0+ drivers.',
      badge: 'EXPERIMENTAL',
      isNative: false,
      icon: DirectXIcon,
    },
    {
      id: 'auto',
      title: 'Automatic (Hardware Adaptive)',
      description: 'Smart profile selector: automatically optimizes JVM and OpenGL parameters based on detected GPU hardware.',
      badge: 'RECOMMENDED',
      isNative: true,
      icon: Sparkles,
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div className="border-b border-white/5 pb-6">
        <h2 className="text-xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
          <OpenGlApiIcon className="w-5 h-5" />
          Graphics API & GPU Hardware Architecture
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Inspect your GPU and configure graphics backends for: <strong className="text-white">{activeInstance?.name || 'Global'}</strong>.
        </p>
      </div>

      {/* GPU Hardware Detection Card */}
      <div className="card-obsidian p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-display flex items-center gap-2">
            <GpuCardIcon className="w-4 h-4 text-emerald-400" />
            Detected System Hardware
          </h3>
          <button
            type="button"
            onClick={() => void scanGraphicsApis()}
            disabled={isScanningApis}
            className="btn-mc flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 disabled:opacity-50"
          >
            {isScanningApis ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {isScanningApis ? 'Scanning...' : apiVersions ? 'Scan again' : 'Scan API versions'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-black/40 border border-white/5">
            <div className="text-[10px] text-slate-400 uppercase font-semibold font-display">Active Graphics Device</div>
            <div className="text-sm font-black text-white mt-1 break-words font-display">
              {hardware.gpuRenderer ?? 'Not reported by this environment'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 font-mono">{hardware.gpuVendor ?? 'Vendor unavailable'}</div>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/5">
            <div className="text-[10px] text-slate-400 uppercase font-semibold font-display">Operating System</div>
            <div className="text-sm font-black text-white mt-1 font-display">
              {hardware.os}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 font-mono">
              {hardware.cpuCores === null ? 'Thread count unavailable' : `${hardware.cpuCores} Threads Detected`}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/5">
            <div className="text-[10px] text-slate-400 uppercase font-semibold font-display">Driver API Support</div>
            <div className="flex items-center gap-3 mt-2 text-xs font-mono">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                {apiVersions?.opengl || hardware.supportedApis.opengl ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : (
                  <Info className="w-3.5 h-3.5" />
                )}
                {apiVersions?.opengl ?? (apiVersions ? apiVersions.opengl_error : hardware.supportedApis.opengl ? 'WebGL detected' : 'WebGL unavailable')}
              </span>
              <span className={`flex items-center gap-1 font-bold ${apiVersions?.vulkan || hardware.supportedApis.vulkan === true ? 'text-emerald-400' : 'text-slate-500'}`}>
                {apiVersions?.vulkan || hardware.supportedApis.vulkan ? <CheckCircle className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                {apiVersions?.vulkan ?? (apiVersions ? apiVersions.vulkan_error : 'Vulkan not queried')}
              </span>
              <span className={`flex items-center gap-1 font-bold ${apiVersions?.directx12 || hardware.supportedApis.directx12 === true ? 'text-cyan-400' : 'text-slate-500'}`}>
                {apiVersions?.directx12 || hardware.supportedApis.directx12 ? <CheckCircle className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                {apiVersions?.directx12 ?? (apiVersions ? apiVersions.directx12_error : 'DX12 not queried')}
              </span>
            </div>
            {apiScanError && <p role="alert" className="text-xs text-red-300">{apiScanError}</p>}
          </div>
        </div>
      </div>

      {/* API Selector Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-display">
          Select Preferred Rendering Backend
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {apis.map((item) => {
            const isSelected = currentApi === item.id;
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => {
                  if (activeInstance) {
                    onUpdateGraphicsApi(activeInstance.id, item.id);
                  }
                }}
                className={`card-obsidian p-5 rounded-xl transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/40'
                    : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-5 h-5" />
                      <h4 className="text-sm font-black text-white font-display tracking-tight">
                        {item.title}
                      </h4>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-black/40 text-slate-400 border-white/10'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-500 text-[10px]">
                    {item.isNative ? 'Native LWJGL Support' : 'Requires Wrapper / Mod'}
                  </span>
                  {isSelected ? (
                    <span className="font-black text-emerald-400 flex items-center gap-1 font-display">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Selected
                    </span>
                  ) : (
                    <span className="text-slate-500 hover:text-white font-mono text-[11px]">Click to activate</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Graphics Reality & Technical Guidance */}
      <div className="card-obsidian p-5 rounded-xl space-y-3">
        <h4 className="text-xs font-bold text-slate-200 font-display flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-400" />
          Technical Rendering Notes
        </h4>
        <div className="text-xs text-slate-400 leading-relaxed space-y-1.5 font-normal">
          <p>
            • <strong>OpenGL (Default):</strong> Standard Minecraft Java pipeline. Guarantees 100% compatibility across all Vanilla versions and modded profiles.
          </p>
          <p>
            • <strong>Vulkan (VulkanMod):</strong> Does not run natively in vanilla Minecraft Java. When selected, The Boys verifies that <code>VulkanMod</code> is present in your instance's mods directory and configures JVM swapchain flags.
          </p>
          <p>
            • <strong>DirectX 12:</strong> Utilizes Microsoft D3D12/Zink OpenGL translation layers available in modern Windows graphics drivers.
          </p>
        </div>
      </div>
    </div>
  );
};
