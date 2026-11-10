import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

/** The Boys Master Launcher Crest */
export const TheBoysEmblemIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M12 2L3 6.5V13C3 18.5 6.8 21.6 12 23C17.2 21.6 21 18.5 21 13V6.5L12 2Z"
      fill="#141824"
      stroke="#388e3c"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M7.5 9.5H16.5M12 9.5V18M9.5 13H14.5"
      stroke="#4caf50"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="6" r="1.5" fill="#81c784" />
  </svg>
);

/** Authentic Pixel Minecraft Grass Block (Isometric 3D) */
export const GrassBlockIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    {/* Top Face - Green Grass with subtle pixel shades */}
    <path d="M12 2L21 7V8L12 13L3 8V7L12 2Z" fill="#588d2b" />
    <path d="M12 3.5L18 7L12 10.5L6 7L12 3.5Z" fill="#71a938" />
    <rect x="11" y="5" width="2" height="2" fill="#82be42" />
    <rect x="8" y="7" width="2" height="1.5" fill="#477322" />
    <rect x="14" y="6" width="2" height="1.5" fill="#82be42" />
    
    {/* Left Face - Dirt with Grass Overhang */}
    <path d="M3 8L12 13V22L3 17V8Z" fill="#855f41" />
    <path d="M3 8L12 13V15.5L9.5 14L8 15L5.5 13.5L3 14V8Z" fill="#4d7924" />
    <rect x="5" y="15" width="2" height="2" fill="#5c3f2b" />
    <rect x="8" y="17" width="2" height="2" fill="#5c3f2b" />
    <rect x="4" y="11" width="1.5" height="2" fill="#9d7350" />
    
    {/* Right Face - Dirt with Grass Overhang (Darker side) */}
    <path d="M12 13L21 8V17L12 22V13Z" fill="#6c4c34" />
    <path d="M12 13L21 8V11.5L18.5 13L16 12L13.5 13.5L12 13Z" fill="#3c601c" />
    <rect x="15" y="14" width="2" height="2" fill="#4a3323" />
    <rect x="17" y="17" width="2" height="2" fill="#4a3323" />
    <rect x="13.5" y="16" width="2" height="2" fill="#855f41" />
    
    {/* Block Outline */}
    <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" stroke="#251a12" strokeWidth="0.8" fill="none" />
    <path d="M12 13L12 22M12 13L3 8M12 13L21 8" stroke="#251a12" strokeWidth="0.8" />
  </svg>
);

/** Authentic 16x16 Pixel Art Crafting Table */
export const CraftingTableIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    {/* Top Grid Face */}
    <path d="M12 2L21 7L12 12L3 7L12 2Z" fill="#b98555" />
    <path d="M6 7L12 4L18 7L12 10L6 7Z" fill="#9c6d42" />
    {/* 3x3 Grid pattern on top */}
    <path d="M9 5.5L15 8.5M10.5 4.75L13.5 10.25" stroke="#4a331f" strokeWidth="0.8" />
    {/* Left Face with Tools */}
    <path d="M3 7L12 12V22L3 17V7Z" fill="#885e3a" />
    <rect x="5" y="11" width="3" height="1.5" fill="#4a331f" />
    <rect x="6" y="14" width="4" height="2" fill="#3a5266" />
    {/* Right Face with Saw */}
    <path d="M12 12L21 7V17L12 22V12Z" fill="#6f4b2e" />
    <rect x="14" y="12" width="4" height="2" fill="#8c9aa6" />
    <rect x="16" y="15" width="2" height="3" fill="#4a331f" />
    {/* Outline */}
    <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" stroke="#302014" strokeWidth="0.8" />
    <path d="M12 12V22M12 12L3 7M12 12L21 7" stroke="#302014" strokeWidth="0.8" />
  </svg>
);

/** Authentic 16x16 Pixel Art Diamond Sword */
export const DiamondSwordIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    {/* Blade Tip */}
    <rect x="13" y="1" width="2" height="2" fill="#55ffff" stroke="#00aaaa" strokeWidth="0.2" />
    <rect x="12" y="2" width="2" height="2" fill="#55ffff" />
    {/* Blade Body */}
    <rect x="11" y="3" width="2" height="2" fill="#55ffff" />
    <rect x="10" y="4" width="2" height="2" fill="#55ffff" />
    <rect x="9" y="5" width="2" height="2" fill="#55ffff" />
    <rect x="8" y="6" width="2" height="2" fill="#55ffff" />
    <rect x="7" y="7" width="2" height="2" fill="#55ffff" />
    {/* Highlights and Inner Shading */}
    <rect x="13" y="2" width="1" height="1" fill="#ffffff" />
    <rect x="11" y="4" width="1" height="1" fill="#ffffff" />
    <rect x="9" y="6" width="1" height="1" fill="#ffffff" />
    <rect x="7" y="8" width="1" height="1" fill="#00aaaa" />
    {/* Guard */}
    <rect x="5" y="8" width="2" height="2" fill="#2b4b9b" />
    <rect x="7" y="6" width="2" height="2" fill="#2b4b9b" />
    <rect x="6" y="7" width="3" height="3" fill="#222222" />
    <rect x="7" y="8" width="1" height="1" fill="#55ffff" />
    {/* Hilt / Stick */}
    <rect x="4" y="9" width="2" height="2" fill="#855f41" />
    <rect x="3" y="10" width="2" height="2" fill="#5c3f2b" />
    <rect x="2" y="11" width="2" height="2" fill="#5c3f2b" />
    {/* Pommel */}
    <rect x="1" y="13" width="2" height="2" fill="#2b4b9b" />
    <rect x="1" y="12" width="1" height="1" fill="#55ffff" />
    <rect x="2" y="13" width="1" height="1" fill="#00aaaa" />
  </svg>
);

/** Authentic 16x16 Pixel Art Diamond Pickaxe */
export const PickaxeIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    {/* Pickaxe Diamond Head Arc */}
    <rect x="9" y="1" width="5" height="2" fill="#55ffff" />
    <rect x="13" y="2" width="2" height="3" fill="#55ffff" />
    <rect x="7" y="2" width="3" height="2" fill="#55ffff" />
    <rect x="5" y="4" width="2" height="3" fill="#55ffff" />
    <rect x="4" y="6" width="2" height="2" fill="#55ffff" />
    {/* Diamond Highlights */}
    <rect x="11" y="1" width="2" height="1" fill="#ffffff" />
    <rect x="13" y="2" width="1" height="2" fill="#ffffff" />
    <rect x="5" y="5" width="1" height="1" fill="#00aaaa" />
    <rect x="10" y="3" width="2" height="2" fill="#00aaaa" />
    {/* Handle / Stick */}
    <rect x="8" y="5" width="2" height="2" fill="#855f41" />
    <rect x="6" y="7" width="2" height="2" fill="#855f41" />
    <rect x="4" y="9" width="2" height="2" fill="#855f41" />
    <rect x="2" y="11" width="2" height="2" fill="#5c3f2b" />
    <rect x="1" y="12" width="2" height="2" fill="#5c3f2b" />
  </svg>
);

/** Authentic 16x16 Pixel Art Netherite Ingot */
export const NetheriteIngotIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    <rect x="3" y="9" width="8" height="4" fill="#312c36" />
    <rect x="5" y="4" width="8" height="5" fill="#4d4955" />
    <rect x="6" y="5" width="6" height="3" fill="#65606d" />
    <rect x="7" y="6" width="4" height="1" fill="#827c8a" />
    <rect x="3" y="10" width="8" height="2" fill="#1b181e" />
    <rect x="11" y="6" width="2" height="6" fill="#242128" />
  </svg>
);

/** Authentic 16x16 Pixel Art Eye of Ender */
export const EnderEyeIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    <circle cx="8" cy="8" r="6" fill="#167364" />
    <circle cx="8" cy="8" r="4.5" fill="#2ce0ba" />
    <ellipse cx="8" cy="8" rx="1.5" ry="3.5" fill="#0b3831" />
    <rect x="7" y="7" width="1" height="1" fill="#ffffff" />
  </svg>
);

/** Authentic 8x8 Pixel Art Creeper Face */
export const CreeperFaceIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    {/* Base Green */}
    <rect width="8" height="8" fill="#459d36" />
    {/* Texture Specks */}
    <rect x="0" y="0" width="2" height="1" fill="#58b348" />
    <rect x="6" y="0" width="2" height="1" fill="#367d2a" />
    <rect x="0" y="7" width="2" height="1" fill="#367d2a" />
    <rect x="6" y="7" width="2" height="1" fill="#58b348" />
    {/* Eyes */}
    <rect x="1" y="1" width="2" height="2" fill="#1c3e16" />
    <rect x="5" y="1" width="2" height="2" fill="#1c3e16" />
    {/* Nose & Mouth */}
    <rect x="3" y="3" width="2" height="3" fill="#1c3e16" />
    <rect x="2" y="4" width="4" height="2" fill="#1c3e16" />
    <rect x="2" y="6" width="1" height="2" fill="#1c3e16" />
    <rect x="5" y="6" width="1" height="2" fill="#1c3e16" />
  </svg>
);

/** Genuine Microsoft 4-Square Logo */
export const MicrosoftBrandIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="2" width="9.5" height="9.5" fill="#f25022" />
    <rect x="12.5" y="2" width="9.5" height="9.5" fill="#7fba00" />
    <rect x="2" y="12.5" width="9.5" height="9.5" fill="#00a4ef" />
    <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#ffb900" />
  </svg>
);

/** Offline Security Shield */
export const OfflineShieldIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M12 2L4 5V11.5C4 16.5 7.4 21 12 22C16.6 21 20 16.5 20 11.5V5L12 2Z"
      fill="#3d2817"
      stroke="#d97706"
      strokeWidth="1.5"
    />
    <circle cx="12" cy="10" r="3" fill="#f59e0b" />
    <path d="M7.5 17C8.5 14.5 10.2 13.5 12 13.5C13.8 13.5 15.5 14.5 16.5 17" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/** Vulkan Logo */
export const VulkanApiIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 3L2 21H6.5L12 11.5L17.5 21H22L12 3Z" fill="url(#vulkan_grad)" />
    <path d="M12 7L6 18H9.5L12 13L14.5 18H18L12 7Z" fill="#ffedd5" />
    <defs>
      <linearGradient id="vulkan_grad" x1="2" y1="3" x2="22" y2="21" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ea580c" />
        <stop offset="0.6" stopColor="#dc2626" />
        <stop offset="1" stopColor="#991b1b" />
      </linearGradient>
    </defs>
  </svg>
);

/** OpenGL Logo */
export const OpenGlApiIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" fill="#1e3a5f" stroke="#38bdf8" strokeWidth="1.2" />
    <path d="M12 6L18 9.5V14.5L12 18L6 14.5V9.5L12 6Z" fill="#0284c7" />
    <circle cx="12" cy="12" r="2.5" fill="#f8fafc" />
  </svg>
);

/** DirectX 12 Logo */
export const DirectXIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="12" cy="12" r="9.5" fill="#0f172a" stroke="#22d3ee" strokeWidth="1.2" />
    <path d="M7 7L17 17M17 7L7 17" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M12 4V20" stroke="#06b6d4" strokeWidth="1" strokeDasharray="2 2" />
  </svg>
);

/** RAM Chip Icon */
export const RamChipIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="6" width="18" height="12" rx="1.5" fill="#0f172a" stroke="#10b981" strokeWidth="1.4" />
    <rect x="6" y="9" width="3" height="6" fill="#10b981" />
    <rect x="10.5" y="9" width="3" height="6" fill="#10b981" />
    <rect x="15" y="9" width="3" height="6" fill="#10b981" />
    <path d="M5 18V21M9 18V21M13 18V21M17 18V21M19 18V21" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M5 3V6M9 3V6M13 3V6M17 3V6M19 3V6" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

/** GPU PCIe Card Icon */
export const GpuCardIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M2 5H22V15H2V5Z" fill="#111827" stroke="#6366f1" strokeWidth="1.2" rx="1" />
    <circle cx="8" cy="10" r="3" stroke="#818cf8" strokeWidth="1" />
    <circle cx="16" cy="10" r="3" stroke="#818cf8" strokeWidth="1" />
    <path d="M4 15V19H12V15" stroke="#a5b4fc" strokeWidth="1.2" />
  </svg>
);

/** Tauri + Rust Desktop Ready Icon */
export const TauriRustIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="12" cy="12" r="9" stroke="#f97316" strokeWidth="1.2" strokeDasharray="3 2" />
    <ellipse cx="12" cy="12" rx="7" ry="3" stroke="#22d3ee" strokeWidth="1" transform="rotate(-30 12 12)" />
    <ellipse cx="12" cy="12" rx="7" ry="3" stroke="#22d3ee" strokeWidth="1" transform="rotate(30 12 12)" />
    <circle cx="12" cy="12" r="2" fill="#fb923c" />
  </svg>
);

/** Authentic 16x16 Pixel Art Redstone Dust */
export const RedstoneDustIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    <rect x="7" y="3" width="2" height="2" fill="#ff2222" />
    <rect x="5" y="5" width="2" height="2" fill="#ff4444" />
    <rect x="9" y="5" width="2" height="2" fill="#cc1111" />
    <rect x="6" y="7" width="4" height="3" fill="#ff1111" />
    <rect x="4" y="9" width="3" height="2" fill="#aa0000" />
    <rect x="9" y="9" width="3" height="2" fill="#ff3333" />
    <rect x="7" y="8" width="2" height="1" fill="#ffffff" />
    <rect x="6" y="11" width="4" height="2" fill="#880000" />
  </svg>
);

/** Authentic 16x16 Pixel Art Golden Apple */
export const GoldenAppleIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    <rect x="7" y="1" width="2" height="2" fill="#6c4c34" />
    <rect x="8" y="2" width="2" height="1" fill="#4d7924" />
    <rect x="5" y="4" width="6" height="8" fill="#ffd700" />
    <rect x="4" y="5" width="8" height="6" fill="#ffd700" />
    <rect x="5" y="5" width="2" height="2" fill="#ffffff" />
    <rect x="9" y="8" width="3" height="3" fill="#e6a100" />
    <rect x="5" y="11" width="6" height="2" fill="#b37400" />
  </svg>
);

/** Authentic 16x16 Pixel Art Enchanted Book */
export const EnchantedBookIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    <rect x="3" y="3" width="10" height="10" fill="#9333ea" />
    <rect x="4" y="4" width="8" height="8" fill="#c084fc" />
    <rect x="7" y="2" width="2" height="12" fill="#dc2626" />
    <rect x="6" y="7" width="4" height="2" fill="#fbbf24" />
    <rect x="4" y="5" width="2" height="1" fill="#ffffff" />
    <rect x="10" y="9" width="2" height="2" fill="#6b21a8" />
  </svg>
);

/** Authentic 16x16 Pixel Art Beacon */
export const BeaconIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    <rect x="2" y="12" width="12" height="3" fill="#1e293b" />
    <rect x="3" y="13" width="10" height="1" fill="#475569" />
    <rect x="3" y="4" width="10" height="8" fill="#38bdf8" fillOpacity="0.4" stroke="#7dd3fc" strokeWidth="0.5" />
    <circle cx="8" cy="8" r="2.5" fill="#00ffff" />
    <rect x="7" y="7" width="2" height="2" fill="#ffffff" />
  </svg>
);

/** Authentic 16x16 Pixel Art Totem of Undying */
export const TotemIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    <rect x="6" y="2" width="4" height="3" fill="#fbbf24" />
    <rect x="4" y="4" width="8" height="4" fill="#f59e0b" />
    <rect x="5" y="5" width="2" height="1" fill="#10b981" />
    <rect x="9" y="5" width="2" height="1" fill="#10b981" />
    <rect x="7" y="7" width="2" height="2" fill="#b45309" />
    <rect x="3" y="7" width="10" height="2" fill="#fbbf24" />
    <rect x="5" y="9" width="6" height="4" fill="#f59e0b" />
    <rect x="6" y="13" width="4" height="2" fill="#b45309" />
  </svg>
);

/** Authentic 16x16 Pixel Art Potion Bottle */
export const PotionBottleIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    <rect x="7" y="1" width="2" height="2" fill="#64748b" />
    <rect x="6" y="3" width="4" height="2" fill="#94a3b8" />
    <rect x="4" y="5" width="8" height="8" fill="#a855f7" />
    <rect x="5" y="6" width="2" height="3" fill="#ffffff" />
    <rect x="5" y="10" width="6" height="3" fill="#7e22ce" />
    <rect x="4" y="12" width="8" height="2" fill="#581c87" />
  </svg>
);

/** Authentic 16x16 Pixel Art Dragon Egg */
export const DragonEggIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    <rect x="6" y="1" width="4" height="2" fill="#18181b" />
    <rect x="5" y="3" width="6" height="3" fill="#27272a" />
    <rect x="4" y="6" width="8" height="6" fill="#18181b" />
    <rect x="5" y="12" width="6" height="2" fill="#09090b" />
    <rect x="6" y="14" width="4" height="1" fill="#09090b" />
    <rect x="6" y="4" width="1" height="2" fill="#c084fc" />
    <rect x="8" y="7" width="2" height="2" fill="#9333ea" />
    <rect x="9" y="8" width="1" height="1" fill="#e9d5ff" />
  </svg>
);

/** Authentic 16x16 Pixel Art Trident */
export const TridentIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    <rect x="3" y="1" width="2" height="5" fill="#2dd4bf" />
    <rect x="7" y="0" width="2" height="6" fill="#5eead4" />
    <rect x="11" y="1" width="2" height="5" fill="#2dd4bf" />
    <rect x="4" y="5" width="8" height="2" fill="#0f766e" />
    <rect x="7" y="7" width="2" height="8" fill="#134e4a" />
    <rect x="8" y="1" width="1" height="3" fill="#ffffff" />
  </svg>
);

/** Authentic 16x16 Pixel Art Shield */
export const MinecraftShieldIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} shapeRendering="crispEdges">
    <rect x="3" y="2" width="10" height="8" fill="#78350f" stroke="#94a3b8" strokeWidth="0.8" />
    <rect x="4" y="10" width="8" height="3" fill="#78350f" />
    <rect x="6" y="13" width="4" height="2" fill="#78350f" />
    <rect x="7" y="3" width="2" height="10" fill="#94a3b8" />
    <rect x="4" y="6" width="8" height="2" fill="#94a3b8" />
  </svg>
);

