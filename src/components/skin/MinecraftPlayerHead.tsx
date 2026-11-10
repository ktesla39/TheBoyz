import React, { useEffect, useRef, useState } from 'react';
import { LauncherAccount } from '../../types/auth';

interface MinecraftPlayerHeadProps {
  account?: LauncherAccount | null;
  skinUrl?: string;
  username?: string;
  size?: number;
  className?: string;
}

export const MinecraftPlayerHead: React.FC<MinecraftPlayerHeadProps> = ({
  account,
  skinUrl,
  username,
  size = 32,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const targetUsername = username ?? account?.username ?? '';
  const effectiveSkinUrl = skinUrl ?? account?.skinUrl;

  useEffect(() => {
    let active = true;
    setRenderedUrl(null);
    if (!effectiveSkinUrl) return () => { active = false; };

    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      console.error('Unable to render the Minecraft player head: 2D canvas is unavailable.');
      return () => { active = false; };
    }

    context.imageSmoothingEnabled = false;
    const image = new Image();
    if (!effectiveSkinUrl.startsWith('data:')) image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (!active) return;
      try {
        context.clearRect(0, 0, size, size);
        context.drawImage(image, 8, 8, 8, 8, 0, 0, size, size);

        const helmetCanvas = document.createElement('canvas');
        helmetCanvas.width = 8;
        helmetCanvas.height = 8;
        const helmetContext = helmetCanvas.getContext('2d');
        if (!helmetContext) {
          throw new Error('Unable to inspect the Minecraft skin helmet layer.');
        }
        helmetContext.imageSmoothingEnabled = false;
        helmetContext.drawImage(image, 40, 8, 8, 8, 0, 0, 8, 8);
        const helmetPixels = helmetContext.getImageData(0, 0, 8, 8).data;
        if (Array.from({ length: 64 }, (_, pixel) => helmetPixels[pixel * 4 + 3]).some((alpha) => alpha > 10)) {
          context.drawImage(image, 40, 8, 8, 8, 0, 0, size, size);
        }
        setRenderedUrl(canvas.toDataURL('image/png'));
      } catch (reason) {
        console.error('Unable to render the Minecraft player head:', reason);
      }
    };
    image.onerror = () => {
      if (active) console.error(`Unable to load skin texture for ${targetUsername}.`);
    };
    image.src = effectiveSkinUrl;

    return () => {
      active = false;
    };
  }, [effectiveSkinUrl, targetUsername, size]);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded bg-black/70 border border-white/10 shadow-sm ${className}`}
      style={{ width: `${size}px`, height: `${size}px`, imageRendering: 'pixelated' }}
    >
      <canvas ref={canvasRef} width={size} height={size} className="hidden" />
      {renderedUrl && (
        <img
          src={renderedUrl}
          alt={targetUsername}
          className="h-full w-full object-cover"
          style={{ imageRendering: 'pixelated' }}
        />
      )}
    </div>
  );
};
