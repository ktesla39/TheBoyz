import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { RotateCw } from 'lucide-react';
import type * as THREE from 'three';
import { normalizeCapeTexture } from '../../services/capePresets';

interface MinecraftSkin3DProps {
  skinUrl: string;
  capeUrl?: string;
  model: 'classic' | 'slim';
  width: number;
  height: number;
  className: string;
  initialBackView: boolean;
  interactive: boolean;
}

type FaceRect = readonly [number, number, number, number];
type BoxFaces = readonly [FaceRect, FaceRect, FaceRect, FaceRect, FaceRect, FaceRect];

export function MinecraftSkin3D({
  skinUrl,
  capeUrl,
  model,
  width,
  height,
  className,
  initialBackView,
  interactive,
}: MinecraftSkin3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; rotation: number } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPreviewError(null);

    let active = true;
    let frameId = 0;
    let visible = true;
    let renderFrame: ((time: number) => void) | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    const visibilityObserver = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && active && frameId === 0 && renderFrame) frameId = window.requestAnimationFrame(renderFrame);
      if (!visible && frameId !== 0) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
    });
    visibilityObserver?.observe(canvas);
    const ownedGeometries: THREE.BufferGeometry[] = [];
    const ownedMaterials: THREE.Material[] = [];
    const ownedTextures: THREE.Texture[] = [];

    const initialize = async () => {
    const THREE = await import('three');
    if (!active) return;

    const scene = new THREE.Scene();
    const aspect = width / height;
    const camera = new THREE.OrthographicCamera(-20 * aspect, 20 * aspect, 20, -20, 0.1, 200);
    camera.position.set(0, 0, 52);
    camera.lookAt(0, 0, 0);

    let webglRenderer: THREE.WebGLRenderer;
    try {
      webglRenderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: 'low-power',
      });
    } catch (reason) {
      console.error('Could not initialize WebGL for the 3D skin preview.', reason);
      setPreviewError('3D skin preview is unavailable because WebGL could not be initialized.');
      return;
    }
    renderer = webglRenderer;
    webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    webglRenderer.setSize(width, height, true);
    webglRenderer.outputColorSpace = THREE.SRGBColorSpace;

    scene.add(new THREE.AmbientLight(0xffffff, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(-12, 20, 32);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x9fe5b0, 1.15);
    rimLight.position.set(16, 8, -18);
    scene.add(rimLight);

    const modelGroup = new THREE.Group();
    modelGroup.rotation.y = initialBackView ? Math.PI : 0;
    modelGroupRef.current = modelGroup;
    scene.add(modelGroup);
    let capePivot: THREE.Group | null = null;

    const makeFaces = (image: CanvasImageSource, rects: BoxFaces, outer = false) => {
      return rects.map(([x, y, w, h]) => {
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = w;
        faceCanvas.height = h;
        const context = faceCanvas.getContext('2d');
        if (!context) throw new Error('Could not create Minecraft skin texture canvas.');
        context.imageSmoothingEnabled = false;
        context.drawImage(image, x, y, w, h, 0, 0, w, h);
        const texture = new THREE.CanvasTexture(faceCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        ownedTextures.push(texture);
        const material = new THREE.MeshLambertMaterial({
          map: texture,
          transparent: outer,
          alphaTest: outer ? 0.015 : 0,
          side: THREE.DoubleSide,
        });
        ownedMaterials.push(material);
        return material;
      });
    };

    const addCuboid = (
      image: HTMLImageElement,
      faces: BoxFaces,
      size: readonly [number, number, number],
      position: readonly [number, number, number],
      outer = false,
      padding = 0,
    ) => {
      const [x, y, z] = size;
      const geometry = new THREE.BoxGeometry(x + padding, y + padding, z + padding);
      ownedGeometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, makeFaces(image, faces, outer));
      mesh.position.set(...position);
      modelGroup.add(mesh);
      return mesh;
    };

    let lastFrameTime = 0;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const skinLoader = new THREE.TextureLoader();
    skinLoader.setCrossOrigin('anonymous');
    skinLoader.load(
      skinUrl,
      (texture) => {
        if (!active) {
          texture.dispose();
          return;
        }
        texture.dispose();
        const image = texture.image as HTMLImageElement;
        if (!image.complete || image.naturalWidth < 64 || (image.naturalHeight !== 64 && image.naturalHeight !== 32)) {
          console.error('The selected skin is not a supported 64×64 or 64×32 Minecraft skin.');
          setPreviewError('This skin texture is not a supported 64×64 or 64×32 image.');
          return;
        }

        const legacy = image.naturalHeight === 32;
        const armWidth = model === 'slim' ? 3 : 4;
        const headBase: BoxFaces = [
          [16, 8, 8, 8], [0, 8, 8, 8], [8, 0, 8, 8],
          [16, 0, 8, 8], [8, 8, 8, 8], [24, 8, 8, 8],
        ];
        const headOuter: BoxFaces = [
          [48, 8, 8, 8], [32, 8, 8, 8], [40, 0, 8, 8],
          [48, 0, 8, 8], [40, 8, 8, 8], [56, 8, 8, 8],
        ];
        const torsoBase: BoxFaces = [
          [28, 20, 4, 12], [16, 20, 4, 12], [20, 16, 8, 4],
          [28, 16, 8, 4], [20, 20, 8, 12], [32, 20, 8, 12],
        ];
        const torsoOuter: BoxFaces = [
          [28, 36, 4, 12], [16, 36, 4, 12], [20, 32, 8, 4],
          [28, 32, 8, 4], [20, 36, 8, 12], [32, 36, 8, 12],
        ];
        const rightArmBase: BoxFaces = [
          [48, 20, 4, 12], [40, 20, 4, 12], [44, 16, armWidth, 4],
          [48, 16, armWidth, 4], [44, 20, armWidth, 12], [52, 20, armWidth, 12],
        ];
        const leftArmBase: BoxFaces = legacy
          ? rightArmBase
          : [
              [40, 52, 4, 12], [32, 52, 4, 12], [36, 48, armWidth, 4],
              [40, 48, armWidth, 4], [36, 52, armWidth, 12], [44, 52, armWidth, 12],
            ];
        const rightLegBase: BoxFaces = [
          [8, 20, 4, 12], [0, 20, 4, 12], [4, 16, 4, 4],
          [8, 16, 4, 4], [4, 20, 4, 12], [12, 20, 4, 12],
        ];
        const leftLegBase: BoxFaces = legacy
          ? rightLegBase
          : [
              [24, 52, 4, 12], [16, 52, 4, 12], [20, 48, 4, 4],
              [24, 48, 4, 4], [20, 52, 4, 12], [28, 52, 4, 12],
            ];
        const rightArmOuter: BoxFaces = [
          [48, 36, 4, 12], [40, 36, 4, 12], [44, 32, armWidth, 4],
          [48, 32, armWidth, 4], [44, 36, armWidth, 12], [52, 36, armWidth, 12],
        ];
        const leftArmOuter: BoxFaces = [
          [56, 52, 4, 12], [48, 52, 4, 12], [52, 48, armWidth, 4],
          [56, 48, armWidth, 4], [52, 52, armWidth, 12], [60, 52, armWidth, 12],
        ];
        const rightLegOuter: BoxFaces = [
          [8, 36, 4, 12], [0, 36, 4, 12], [4, 32, 4, 4],
          [8, 32, 4, 4], [4, 36, 4, 12], [12, 36, 4, 12],
        ];
        const leftLegOuter: BoxFaces = [
          [8, 52, 4, 12], [0, 52, 4, 12], [4, 48, 4, 4],
          [8, 48, 4, 4], [4, 52, 4, 12], [12, 52, 4, 12],
        ];

        addCuboid(image, headBase, [8, 8, 8], [0, 12, 0]);
        if (!legacy) addCuboid(image, headOuter, [8, 8, 8], [0, 12, 0], true, 0.65);

        addCuboid(image, torsoBase, [8, 12, 4], [0, 2, 0]);
        if (!legacy) addCuboid(image, torsoOuter, [8, 12, 4], [0, 2, 0], true, 0.38);

        const armOffset = 4 + armWidth / 2;
        addCuboid(image, rightArmBase, [armWidth, 12, 4], [-armOffset, 2, 0]);
        addCuboid(image, leftArmBase, [armWidth, 12, 4], [armOffset, 2, 0]);
        addCuboid(image, rightLegBase, [4, 12, 4], [-2, -10, 0]);
        addCuboid(image, leftLegBase, [4, 12, 4], [2, -10, 0]);
        if (!legacy) {
          addCuboid(image, rightArmOuter, [armWidth, 12, 4], [-armOffset, 2, 0], true, 0.28);
          addCuboid(image, leftArmOuter, [armWidth, 12, 4], [armOffset, 2, 0], true, 0.28);
          addCuboid(image, rightLegOuter, [4, 12, 4], [-2, -10, 0], true, 0.28);
          addCuboid(image, leftLegOuter, [4, 12, 4], [2, -10, 0], true, 0.28);
        }

        if (capeUrl) {
          skinLoader.load(
            capeUrl,
            (capeTexture) => {
              if (!active) {
                capeTexture.dispose();
                return;
              }
              try {
                const source = capeTexture.image as HTMLImageElement;
                const capeCanvas = normalizeCapeTexture(
                  source,
                  source.naturalWidth || source.width,
                  source.naturalHeight || source.height,
                );
                capeTexture.dispose();
                capePivot = new THREE.Group();
                capePivot.position.set(0, 7.5, -2.45);
                const capeGeometry = new THREE.BoxGeometry(10, 16, 0.6);
                ownedGeometries.push(capeGeometry);
                const capeFaces: BoxFaces = [
                  [11, 1, 1, 16], [0, 1, 1, 16], [1, 0, 10, 1],
                  [11, 0, 10, 1], [1, 1, 10, 16], [12, 1, 10, 16],
                ];
                const cape = new THREE.Mesh(capeGeometry, makeFaces(capeCanvas, capeFaces));
                cape.position.y = -8;
                capePivot.add(cape);
                modelGroup.add(capePivot);
              } catch (reason) {
                console.error('Unable to build the textured 3D cape.', reason);
                setPreviewError(reason instanceof Error ? reason.message : 'The selected cape texture is invalid.');
              }
            },
            undefined,
            (error) => console.error('Unable to load cape texture for the 3D skin preview.', error),
          );
        }
      },
      undefined,
      (error) => console.error('Unable to load skin texture for the 3D skin preview.', error),
    );

    const render = (time: number) => {
      if (!active || !visible) {
        frameId = 0;
        return;
      }
      if (lastFrameTime && time - lastFrameTime < 1000 / 30) {
        frameId = window.requestAnimationFrame(render);
        return;
      }
      const deltaSeconds = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0;
      lastFrameTime = time;
      if (interactive && !dragRef.current && !prefersReducedMotion) {
        modelGroup.rotation.y += deltaSeconds * 0.34;
      }
      if (capePivot && !prefersReducedMotion) {
        capePivot.rotation.x = 0.08 + Math.sin(time / 700) * 0.035;
        capePivot.rotation.z = Math.sin(time / 1100) * 0.018;
      }
      webglRenderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };
    renderFrame = render;
    if (visible) frameId = window.requestAnimationFrame(render);

    };

    void initialize().catch((reason: unknown) => {
      if (!active) return;
      console.error('Could not construct the 3D Minecraft skin preview.', reason);
      setPreviewError('Could not build the 3D skin model. Check that the selected skin is valid.');
    });

    return () => {
      active = false;
      visibilityObserver?.disconnect();
      window.cancelAnimationFrame(frameId);
      modelGroupRef.current = null;
      ownedGeometries.forEach((geometry) => geometry.dispose());
      ownedMaterials.forEach((material) => material.dispose());
      ownedTextures.forEach((texture) => texture.dispose());
      renderer?.dispose();
    };
  }, [capeUrl, height, initialBackView, interactive, model, skinUrl, width]);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const group = modelGroupRef.current;
    if (!group) return;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      rotation: group.rotation.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const drag = dragRef.current;
    const group = modelGroupRef.current;
    if (!drag || !group || drag.pointerId !== event.pointerId) return;
    group.rotation.y = drag.rotation + (event.clientX - drag.x) * 0.012;
  };

  const handlePointerEnd = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const rotateHalfTurn = () => {
    if (!interactive) return;
    if (modelGroupRef.current) modelGroupRef.current.rotation.y += Math.PI;
  };

  return (
    <div className={`relative inline-block select-none ${className}`} style={{ width, height }}>
      <canvas
        ref={canvasRef}
        aria-label="Interactive three-dimensional Minecraft player skin. Drag to rotate."
        className="block touch-none"
        height={height}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        role="img"
        style={{ cursor: interactive ? 'grab' : 'default', imageRendering: 'pixelated' }}
        width={width}
      />
      {previewError && (
        <p className="absolute inset-x-1 bottom-1 m-0 bg-black/80 p-1 text-center text-xs text-amber-200">
          {previewError}
        </p>
      )}
      {interactive && (
        <button
          type="button"
          aria-label="Turn player model around"
          className="absolute bottom-1.5 right-1.5 rounded border border-white/15 bg-black/80 p-1.5 text-slate-200 shadow-lg transition-colors hover:bg-black hover:text-emerald-300"
          onClick={rotateHalfTurn}
          title="Turn player model around"
        >
          <RotateCw size={16} />
        </button>
      )}
    </div>
  );
}
