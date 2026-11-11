import React from 'react';
import { Gamepad2, Hammer, Layers3, Puzzle, Zap } from 'lucide-react';
import type { ModLoaderType } from '../../types/instance';

const loaderGlyphs: Record<ModLoaderType, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  vanilla: { icon: Gamepad2, tone: 'text-amber-300' },
  fabric: { icon: Puzzle, tone: 'text-sky-300' },
  quilt: { icon: Layers3, tone: 'text-violet-300' },
  forge: { icon: Hammer, tone: 'text-orange-300' },
  neoforge: { icon: Zap, tone: 'text-cyan-300' },
};

interface LoaderGlyphProps {
  loader: ModLoaderType;
  className?: string;
}

export const LoaderGlyph: React.FC<LoaderGlyphProps> = ({ loader, className = '' }) => {
  const { icon: Icon, tone } = loaderGlyphs[loader] ?? loaderGlyphs.vanilla;
  return <Icon aria-hidden="true" className={`${tone} ${className}`} />;
};
