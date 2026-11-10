export interface CapePreset {
  id: string;
  name: string;
  colors: readonly [string, string, string, string];
  pattern: 'stripe' | 'diamond' | 'cross' | 'check' | 'wave' | 'star';
}

export const CAPE_PRESETS: readonly CapePreset[] = [
  { id: 'emerald', name: 'Emerald Trail', colors: ['#14532d', '#22c55e', '#86efac', '#052e16'], pattern: 'stripe' },
  { id: 'redstone', name: 'Redstone Pulse', colors: ['#7f1d1d', '#dc2626', '#fca5a5', '#450a0a'], pattern: 'cross' },
  { id: 'lapis', name: 'Lapis Drift', colors: ['#1e3a8a', '#2563eb', '#93c5fd', '#172554'], pattern: 'diamond' },
  { id: 'amethyst', name: 'Amethyst Shard', colors: ['#581c87', '#9333ea', '#d8b4fe', '#3b0764'], pattern: 'diamond' },
  { id: 'copper', name: 'Copper Patina', colors: ['#7c2d12', '#c2410c', '#fdba74', '#431407'], pattern: 'wave' },
  { id: 'prismarine', name: 'Prismarine Tide', colors: ['#134e4a', '#0d9488', '#99f6e4', '#042f2e'], pattern: 'wave' },
  { id: 'sunset', name: 'Sunset Blocks', colors: ['#9a3412', '#f97316', '#fde047', '#7c2d12'], pattern: 'stripe' },
  { id: 'frost', name: 'Frostbound', colors: ['#334155', '#38bdf8', '#e0f2fe', '#0f172a'], pattern: 'star' },
  { id: 'void', name: 'Void Signal', colors: ['#312e81', '#6366f1', '#c4b5fd', '#1e1b4b'], pattern: 'cross' },
  { id: 'gold', name: 'Gilded Grid', colors: ['#78350f', '#d97706', '#fde68a', '#451a03'], pattern: 'check' },
  { id: 'rose', name: 'Rose Garden', colors: ['#831843', '#db2777', '#fbcfe8', '#500724'], pattern: 'diamond' },
  { id: 'slime', name: 'Slime Circuit', colors: ['#365314', '#65a30d', '#d9f99d', '#1a2e05'], pattern: 'check' },
  { id: 'ocean', name: 'Deep Current', colors: ['#164e63', '#0891b2', '#a5f3fc', '#083344'], pattern: 'wave' },
  { id: 'ember', name: 'Emberfall', colors: ['#7f1d1d', '#ea580c', '#fcd34d', '#431407'], pattern: 'star' },
  { id: 'cloud', name: 'Cloud Runner', colors: ['#475569', '#94a3b8', '#f8fafc', '#1e293b'], pattern: 'stripe' },
  { id: 'orchid', name: 'Orchid Pixel', colors: ['#701a75', '#c026d3', '#f0abfc', '#4a044e'], pattern: 'check' },
];

function drawCapePanel(context: CanvasRenderingContext2D, x: number, preset: CapePreset, mirrored: boolean) {
  const [base, primary, highlight, shadow] = preset.colors;
  for (let py = 0; py < 16; py += 1) {
    for (let px = 0; px < 10; px += 1) {
      let color = base;
      if (preset.pattern === 'stripe') {
        color = px % 4 === 1 ? primary : px % 4 === 2 ? highlight : base;
      } else if (preset.pattern === 'diamond') {
        const distance = Math.abs(px - 4.5) + Math.abs(py - 7.5);
        color = distance < 3 ? highlight : distance < 6 ? primary : base;
      } else if (preset.pattern === 'cross') {
        color = px === 4 || px === 5 || py === 7 || py === 8 ? highlight : base;
        if ((px + py) % 5 === 0) color = primary;
      } else if (preset.pattern === 'check') {
        color = (Math.floor(px / 2) + Math.floor(py / 2)) % 2 === 0 ? primary : base;
      } else if (preset.pattern === 'wave') {
        const wave = Math.floor(4 + Math.sin((px + (mirrored ? 2 : 0)) * 0.8) * 2);
        color = py >= wave && py <= wave + 2 ? highlight : py > wave + 2 ? primary : base;
      } else {
        const star = (px === 4 || px === 5) && py >= 3 && py <= 12
          || (py === 6 || py === 9) && px >= 2 && px <= 7
          || px === 3 && py === 5
          || px === 6 && py === 10;
        color = star ? highlight : (px + py) % 7 === 0 ? primary : base;
      }
      if (px === 0 || px === 9 || py === 0 || py === 15) {
        color = (px + py) % 2 === 0 ? shadow : primary;
      }
      context.fillStyle = color;
      context.fillRect(x + px, 1 + py, 1, 1);
    }
  }
}

export function createCapeTexture(preset: CapePreset): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create cape texture canvas.');
  context.imageSmoothingEnabled = false;
  const [base, primary, highlight] = preset.colors;
  context.fillStyle = primary;
  context.fillRect(1, 0, 10, 1);
  context.fillRect(11, 0, 10, 1);
  context.fillStyle = base;
  context.fillRect(0, 1, 1, 16);
  context.fillRect(11, 1, 1, 16);
  context.fillStyle = highlight;
  context.fillRect(1, 17, 10, 1);
  context.fillRect(12, 1, 10, 16);
  context.fillStyle = base;
  context.fillRect(22, 1, 1, 16);
  drawCapePanel(context, 1, preset, false);
  drawCapePanel(context, 12, preset, true);
  return canvas.toDataURL('image/png');
}

export function normalizeCapeTexture(image: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create cape texture canvas.');
  context.imageSmoothingEnabled = false;
  if (width === 64 && height === 32) {
    context.drawImage(image, 0, 0);
    return canvas;
  }
  if (width === 22 && height === 17) {
    context.drawImage(image, 0, 0, 22, 17, 1, 1, 10, 16);
    context.drawImage(image, 0, 0, 22, 17, 12, 1, 10, 16);
    context.drawImage(image, 0, 0, 22, 1, 1, 0, 10, 1);
    context.drawImage(image, 0, 16, 22, 1, 1, 17, 10, 1);
    return canvas;
  }
  throw new Error(`Unsupported cape dimensions (${width}x${height}). Use 64x32 or 22x17 PNG.`);
}
