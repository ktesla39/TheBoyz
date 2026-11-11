import React from 'react';
import { LoaderGlyph } from '../icons/LoaderGlyph';
import { ModLoaderType } from '../../types/instance';
import {
  GrassBlockIcon,
  CraftingTableIcon,
  DiamondSwordIcon,
  PickaxeIcon,
  EnderEyeIcon,
  NetheriteIngotIcon,
  CreeperFaceIcon,
  RedstoneDustIcon,
  GoldenAppleIcon,
  EnchantedBookIcon,
  BeaconIcon,
  TotemIcon,
  PotionBottleIcon,
  DragonEggIcon,
  TridentIcon,
  TheBoysEmblemIcon,
} from '../icons/MinecraftIcons';

interface InstanceCircleLogoProps {
  icon?: string;
  loader: ModLoaderType;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const INSTANCE_ICON_PRESETS = [
  { id: 'loader', name: 'Loader Badge', component: null },
  { id: 'grass_block', name: 'Grass Block', component: GrassBlockIcon },
  { id: 'diamond_sword', name: 'Diamond Sword', component: DiamondSwordIcon },
  { id: 'crafting_table', name: 'Crafting Table', component: CraftingTableIcon },
  { id: 'pickaxe', name: 'Pickaxe', component: PickaxeIcon },
  { id: 'ender_eye', name: 'Eye of Ender', component: EnderEyeIcon },
  { id: 'netherite_ingot', name: 'Netherite Ingot', component: NetheriteIngotIcon },
  { id: 'creeper_face', name: 'Creeper', component: CreeperFaceIcon },
  { id: 'redstone_dust', name: 'Redstone', component: RedstoneDustIcon },
  { id: 'golden_apple', name: 'Golden Apple', component: GoldenAppleIcon },
  { id: 'enchanted_book', name: 'Enchanted Book', component: EnchantedBookIcon },
  { id: 'beacon', name: 'Beacon', component: BeaconIcon },
  { id: 'totem', name: 'Totem of Undying', component: TotemIcon },
  { id: 'potion_bottle', name: 'Potion', component: PotionBottleIcon },
  { id: 'dragon_egg', name: 'Dragon Egg', component: DragonEggIcon },
  { id: 'trident', name: 'Trident', component: TridentIcon },
  { id: 'the_boys', name: 'The Boys Crest', component: TheBoysEmblemIcon },
];

export const InstanceCircleLogo: React.FC<InstanceCircleLogoProps> = ({
  icon,
  loader,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
    xl: 'w-14 h-14 text-xl',
  }[size];

  const glyphSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4.5 h-4.5',
    lg: 'w-5.5 h-5.5',
    xl: 'w-7 h-7',
  }[size];

  // Specific color tones for mod loaders in Bedrock circular badge style
  const toneBg = {
    fabric: 'bg-gradient-to-br from-sky-500/25 via-blue-600/20 to-sky-950/60 border-sky-400/40 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.2)]',
    forge: 'bg-gradient-to-br from-amber-500/25 via-orange-600/20 to-amber-950/60 border-amber-400/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]',
    neoforge: 'bg-gradient-to-br from-orange-500/25 via-red-600/20 to-orange-950/60 border-orange-400/40 text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.2)]',
    quilt: 'bg-gradient-to-br from-purple-500/25 via-fuchsia-600/20 to-purple-950/60 border-purple-400/40 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.2)]',
    vanilla: 'bg-gradient-to-br from-emerald-500/25 via-green-600/20 to-emerald-950/60 border-emerald-400/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]',
  }[loader] || 'bg-black/50 border-white/20 text-white';

  if (icon && (icon.startsWith('data:') || icon.startsWith('http:') || icon.startsWith('https:') || icon.startsWith('/'))) {
    return (
      <div
        className={`rounded-full overflow-hidden border-2 border-white/30 shadow-md shrink-0 flex items-center justify-center bg-black/60 ${sizeClasses} ${className}`}
      >
        <img src={icon} alt="instance logo" className="w-full h-full object-cover" />
      </div>
    );
  }

  const preset = INSTANCE_ICON_PRESETS.find((p) => p.id === icon && p.component);
  if (preset && preset.component) {
    const Component = preset.component;
    return (
      <div
        className={`rounded-full border-2 flex items-center justify-center shrink-0 backdrop-blur-sm transition-transform duration-200 ${sizeClasses} ${toneBg} ${className}`}
      >
        <Component className={glyphSizes} />
      </div>
    );
  }

  return (
    <div
      className={`rounded-full border-2 flex items-center justify-center shrink-0 backdrop-blur-sm transition-transform duration-200 ${sizeClasses} ${toneBg} ${className}`}
    >
      <LoaderGlyph loader={loader} className={glyphSizes} />
    </div>
  );
};
