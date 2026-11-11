import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw, Shield } from 'lucide-react';
import { MinecraftSkin3D } from './MinecraftSkin3D';

interface MinecraftSkinCanvasProps {
  skinUrl?: string;
  capeUrl?: string;
  model?: 'classic' | 'slim';
  mode?: 'full' | 'bust' | 'head';
  height?: number;
  width?: number;
  showPedestal?: boolean;
  interactive?: boolean;
  className?: string;
  initialBackView?: boolean;
}

export const MinecraftSkinCanvas: React.FC<MinecraftSkinCanvasProps> = ({
  skinUrl,
  capeUrl,
  model,
  mode = 'full',
  height = 200,
  width = 140,
  showPedestal = false,
  interactive = true,
  className = '',
  initialBackView = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef(initialBackView ? 180 : 0);
  const dragRef = useRef<{ pointerId: number; x: number; angle: number } | null>(null);
  const [isBackView, setIsBackView] = useState(initialBackView);

  useEffect(() => {
    let active = true;
    if (mode === 'full') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    if (!skinUrl || !model) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return () => {
        active = false;
      };
    }

    const armWidth = model === 'slim' ? 3 : 4;

    const drawPipeline = (skinImage: HTMLImageElement, capeImage?: HTMLImageElement | null) => {
      if (!active) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const is64x32 = skinImage.height === 32 && skinImage.width === 64;

      if (mode === 'head') {
        renderHeadOnly(ctx, skinImage, canvas.width, canvas.height, isBackView);
        return;
      }

      renderBust(ctx, skinImage, canvas.width, canvas.height, isBackView, armWidth, is64x32);

      // Back view: render cape over back of torso
      if (isBackView && capeImage && mode === 'bust') {
        renderCapeBack(ctx, capeImage, canvas.width, canvas.height, mode, showPedestal);
      }
    };

    // Load skin and cape in parallel
    const skinImg = new Image();
    if (skinUrl.startsWith('http')) {
      skinImg.crossOrigin = 'anonymous';
    }

    let capeImg: HTMLImageElement | null = null;
    if (capeUrl) {
      capeImg = new Image();
      if (capeUrl.startsWith('http')) {
        capeImg.crossOrigin = 'anonymous';
      }
    }

    let skinLoaded = false;
    let capeLoaded = !capeUrl;
    let resourceFailed = false;

    const tryDraw = () => {
      if (skinLoaded && capeLoaded && !resourceFailed) {
        drawPipeline(skinImg, capeImg);
      }
    };

    skinImg.onload = () => {
      skinLoaded = true;
      tryDraw();
    };

    skinImg.onerror = () => {
      resourceFailed = true;
      console.error(`Unable to load skin texture: ${skinUrl}`);
    };

    if (capeImg && capeUrl) {
      capeImg.onload = () => {
        capeLoaded = true;
        tryDraw();
      };
      capeImg.onerror = () => {
        resourceFailed = true;
        console.error(`Unable to load cape texture: ${capeUrl}`);
      };
      capeImg.src = capeUrl;
    }

    skinImg.src = skinUrl;

    return () => {
      active = false;
    };
  }, [skinUrl, capeUrl, model, mode, height, width, isBackView, showPedestal]);

  const toggleView = (e: React.MouseEvent) => {
    if (!interactive) return;
    e.stopPropagation();
    rotationRef.current = (rotationRef.current + 180) % 360;
    if (modelRef.current) {
      modelRef.current.style.transform = `rotateY(${rotationRef.current}deg) scaleX(${rotationRef.current > 90 && rotationRef.current < 270 ? -1 : 1})`;
    }
    setIsBackView(rotationRef.current > 90 && rotationRef.current < 270);
  };

  const updateRotation = useCallback((angle: number) => {
    rotationRef.current = ((angle % 360) + 360) % 360;
    if (modelRef.current) {
      modelRef.current.style.transform = `rotateY(${rotationRef.current}deg) scaleX(${rotationRef.current > 90 && rotationRef.current < 270 ? -1 : 1})`;
    }
    const showBack = rotationRef.current > 90 && rotationRef.current < 270;
    setIsBackView((previous) => previous === showBack ? previous : showBack);
  }, []);

  useEffect(() => {
    if (capeUrl && initialBackView) {
      updateRotation(180);
    }
  }, [capeUrl, initialBackView, updateRotation]);

  useEffect(() => {
    if (!interactive || mode === 'full') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frameId = 0;
    let lastTime = 0;
    const animate = (time: number) => {
      if (!dragRef.current) {
        const delta = lastTime ? Math.min(time - lastTime, 50) : 0;
        updateRotation(rotationRef.current + delta * 0.012);
      }
      lastTime = time;
      frameId = window.requestAnimationFrame(animate);
    };
    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [interactive, mode, updateRotation]);

  if (mode === 'full' && skinUrl && model) {
    return (
      <MinecraftSkin3D
        skinUrl={skinUrl}
        capeUrl={capeUrl}
        model={model}
        width={width}
        height={height}
        className={className}
        initialBackView={initialBackView}
        interactive={interactive}
      />
    );
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      angle: rotationRef.current,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateRotation(drag.angle + (event.clientX - drag.x) * 1.2);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <div
      className={`relative inline-block select-none group ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      title={interactive ? 'Drag to rotate the player model' : undefined}
      style={{
        cursor: interactive ? 'grab' : 'default',
        perspective: '600px',
      }}
    >
      <div
        ref={modelRef}
        className="will-change-transform"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <canvas
          ref={canvasRef}
          width={width * 2} // 2x internal resolution for retina sharpness
          height={height * 2}
          style={{
            width: `${width}px`,
            height: `${height}px`,
            imageRendering: 'pixelated',
          }}
          className="block"
        />
      </div>

      {interactive && (
        <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
          <button
            type="button"
            onClick={toggleView}
            className="p-1 rounded bg-black/80 hover:bg-black text-slate-300 hover:text-emerald-400 border border-white/15 transition-all cursor-pointer shadow-lg"
            title="Rotate player model"
            aria-label="Rotate player model"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

/* --- Canvas Render Pipeline --- */

function renderHeadOnly(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  back: boolean
) {
  const scale = Math.min(w, h) / 10;
  const cx = (w - 8 * scale) / 2;
  const cy = (h - 8 * scale) / 2;

  // Base Head
  const hx = back ? 24 : 8;
  ctx.drawImage(img, hx, 8, 8, 8, cx, cy, 8 * scale, 8 * scale);

  // Helmet Layer with subtle transparency/overlay
  const helmx = back ? 56 : 40;
  ctx.drawImage(img, helmx, 8, 8, 8, cx - scale * 0.4, cy - scale * 0.4, 8.8 * scale, 8.8 * scale);
}

function renderBust(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  back: boolean,
  armW: number,
  is64x32: boolean
) {
  const scale = Math.min(w / 18, h / 22);
  const cx = w / 2;
  const topY = 2 * scale;

  // Head
  const headW = 8 * scale;
  const headH = 8 * scale;
  const headX = cx - headW / 2;
  const headY = topY;
  const hx = back ? 24 : 8;
  ctx.drawImage(img, hx, 8, 8, 8, headX, headY, headW, headH);

  // Helmet
  const helmx = back ? 56 : 40;
  ctx.drawImage(img, helmx, 8, 8, 8, headX - scale * 0.4, headY - scale * 0.4, 8.8 * scale, 8.8 * scale);

  // Torso
  const torsoW = 8 * scale;
  const torsoH = 12 * scale;
  const torsoX = cx - torsoW / 2;
  const torsoY = headY + headH;
  const tx = back ? 32 : 20;
  ctx.drawImage(img, tx, 20, 8, 12, torsoX, torsoY, torsoW, torsoH);

  if (!is64x32) {
    // Torso Jacket
    ctx.drawImage(img, tx, 36, 8, 12, torsoX - scale * 0.25, torsoY, 8.5 * scale, 12 * scale);
  }

  // Right Arm
  const armPixelW = armW * scale;
  const armH = 12 * scale;
  const rArmX = torsoX - armPixelW;
  const rArmY = torsoY;
  const raX = back ? 52 : 44;
  ctx.drawImage(img, raX, 20, armW, 12, rArmX, rArmY, armPixelW, armH);
  if (!is64x32) {
    ctx.drawImage(img, raX, 36, armW, 12, rArmX, rArmY, armPixelW, armH);
  }

  // Left Arm
  const lArmX = torsoX + torsoW;
  const lArmY = torsoY;
  if (!is64x32) {
    const laX = back ? (armW === 3 ? 43 : 44) : 36;
    ctx.drawImage(img, laX, 52, armW, 12, lArmX, lArmY, armPixelW, armH);
    ctx.drawImage(img, laX === 36 ? 52 : 44, 52, armW, 12, lArmX, lArmY, armPixelW, armH);
  } else {
    // Legacy mirrored arm
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(img, raX, 20, armW, 12, -(lArmX + armPixelW), lArmY, armPixelW, armH);
    ctx.restore();
  }
}

function getCapeSourceCoords(capeImg: HTMLImageElement): { sx: number; sy: number; sw: number; sh: number } {
  // If cape image is standard Minecraft 64x32
  if (capeImg.width === 64 && capeImg.height === 32) {
    return { sx: 1, sy: 1, sw: 10, sh: 16 };
  }
  // If 22x17 legacy
  if (capeImg.width === 22 && capeImg.height === 17) {
    return { sx: 1, sy: 1, sw: 10, sh: 16 };
  }
  // Otherwise it's a standalone cape graphic, draw full texture
  return { sx: 0, sy: 0, sw: capeImg.width, sh: capeImg.height };
}

function renderCapeBack(
  ctx: CanvasRenderingContext2D,
  capeImg: HTMLImageElement,
  w: number,
  h: number,
  mode: 'full' | 'bust',
  showPedestal: boolean
) {
  const verticalPadding = showPedestal ? 38 : 34;
  const scale = mode === 'bust' ? Math.min(w / 18, h / 22) : Math.min(w / 20, h / verticalPadding);
  const cx = w / 2;
  const topY = 2 * scale;
  const headH = 8 * scale;

  // Cape dimensions: 10 scale units wide, 16 scale units high
  const capeW = 10 * scale;
  const capeH = 16 * scale;
  const capeX = cx - capeW / 2;
  // Attached directly at neck behind torso
  const capeY = topY + headH;

  const { sx, sy, sw, sh } = getCapeSourceCoords(capeImg);

  ctx.save();
  // Realistic soft back shadow
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  ctx.drawImage(capeImg, sx, sy, sw, sh, capeX, capeY, capeW, capeH);
  ctx.restore();
}
