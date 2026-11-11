import { SystemHardwareInfo } from '../types/launcher';

export function detectSystemHardware(): SystemHardwareInfo {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  let gpuVendor: string | null = null;
  let gpuRenderer: string | null = null;
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    gpuVendor = gl.getParameter(debugInfo?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR) as string;
    gpuRenderer = gl.getParameter(debugInfo?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) as string;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const os = userAgent.includes('windows')
    ? 'Windows'
    : userAgent.includes('mac')
      ? 'macOS'
      : userAgent.includes('linux')
        ? 'Linux'
        : 'Unknown';

  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    os,
    cpuCores: navigator.hardwareConcurrency ?? null,
    totalRamGb: nav.deviceMemory ?? null,
    gpuVendor,
    gpuRenderer,
    supportedApis: {
      opengl: null,
      vulkan: null,
      directx12: null,
    },
    installedJavaVersions: null,
  };
}

export function getGraphicsApiReport(api: string, hardware: SystemHardwareInfo): {
  status: 'recommended' | 'compatible' | 'experimental' | 'unsupported';
  title: string;
  notes: string;
  requiresMod?: string;
} {
  switch (api) {
    case 'opengl':
      return hardware.supportedApis.opengl === null
        ? {
            status: 'experimental',
            title: 'OpenGL (Standard Native Pipeline)',
            notes: 'The launcher cannot reliably probe the native OpenGL driver from its browser context. Minecraft verifies OpenGL support when it starts.',
          }
        : {
            status: hardware.supportedApis.opengl ? 'recommended' : 'unsupported',
            title: 'OpenGL (Standard Native Pipeline)',
            notes: hardware.supportedApis.opengl
              ? 'The native graphics adapter reports OpenGL support.'
              : 'No native OpenGL support was reported.',
          };
    case 'vulkan':
      return hardware.supportedApis.vulkan
        ? {
            status: 'compatible',
            title: 'Vulkan (High GPU Utilization)',
            notes: 'The detected graphics adapter identifies as Vulkan-capable. Minecraft Java Edition requires VulkanMod.',
            requiresMod: 'VulkanMod (Fabric/Forge)',
          }
        : hardware.supportedApis.vulkan === null
          ? {
            status: 'experimental',
            title: 'Vulkan (Detection unavailable)',
            notes: 'The current browser environment cannot determine Vulkan driver support.',
          }
          : {
            status: 'unsupported',
            title: 'Vulkan (Not Detected)',
            notes: 'The current environment did not report a Vulkan-capable graphics adapter.',
          };
    case 'directx12':
      return hardware.supportedApis.directx12
        ? {
            status: 'experimental',
            title: 'DirectX 12 (Translation Layer)',
            notes: 'A compatible Windows GPU was detected. Minecraft Java Edition requires a DirectX translation layer.',
          }
        : hardware.supportedApis.directx12 === null
          ? {
            status: 'experimental',
            title: 'DirectX 12 (Detection unavailable)',
            notes: 'The current browser environment cannot determine DirectX 12 driver support.',
          }
          : {
            status: 'unsupported',
            title: 'DirectX 12 (Not Detected)',
            notes: 'A compatible Windows GPU was not detected in the current environment.',
          };
    case 'auto':
      return {
        status: 'recommended',
        title: 'Automatic (Smart System Selection)',
        notes: 'Automatic graphics selection uses the detected adapter information.',
      };
    default:
      throw new Error(`Unknown graphics API "${api}".`);
  }
}
