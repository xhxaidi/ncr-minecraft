import * as THREE from "three";
import { BlockId, type BlockIdValue } from "../world/blocks";

const TILE_SIZE = 16;
export const ATLAS_TILES_PER_ROW = 8;
const TILES_PER_ROW = ATLAS_TILES_PER_ROW;

export type TextureAtlas = {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  tileForBlock: (block: BlockIdValue, faceY: number) => number;
};

function random(seed: number) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
  };
}

export function createTextureAtlas(): TextureAtlas {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TILE_SIZE * TILES_PER_ROW;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");

  const paint = (
    tile: number,
    base: [number, number, number],
    options: { noise?: number; courses?: boolean; brick?: boolean; grain?: boolean; frame?: boolean; band?: [number, number, number] } = {},
  ) => {
    const rnd = random(tile * 7_919 + 1);
    const ox = (tile % TILES_PER_ROW) * TILE_SIZE;
    const oy = Math.floor(tile / TILES_PER_ROW) * TILE_SIZE;
    for (let y = 0; y < TILE_SIZE; y += 1) {
      for (let x = 0; x < TILE_SIZE; x += 1) {
        let factor = 1 + (rnd() - 0.5) * (options.noise ?? 0.14);
        if (options.grain && x % 4 === 0) factor *= 0.84;
        if (options.courses && y % 4 === 3) factor *= 0.78;
        if (options.brick && (y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 7)) factor = 0.54;
        context.fillStyle = `rgb(${Math.round(base[0] * factor)},${Math.round(base[1] * factor)},${Math.round(base[2] * factor)})`;
        context.fillRect(ox + x, oy + y, 1, 1);
      }
    }
    if (options.frame) {
      context.fillStyle = "rgba(255,255,255,.55)";
      context.fillRect(ox, oy, 16, 1);
      context.fillRect(ox, oy + 15, 16, 1);
      context.fillRect(ox, oy, 1, 16);
      context.fillRect(ox + 15, oy, 1, 16);
    }
    if (options.band) {
      context.fillStyle = `rgb(${options.band[0]},${options.band[1]},${options.band[2]})`;
      context.fillRect(ox, oy + 6, 16, 4);
    }
  };

  paint(0, [92, 171, 72]);
  paint(1, [119, 91, 58]);
  paint(2, [138, 98, 68]);
  paint(3, [143, 143, 143]);
  paint(4, [68, 72, 77], { noise: 0.08 });
  paint(5, [54, 107, 198]);
  paint(6, [122, 90, 51], { grain: true });
  paint(7, [62, 125, 44], { noise: 0.34 });
  paint(8, [216, 199, 142]);
  paint(9, [181, 83, 60], { courses: true, noise: 0.1 });
  paint(10, [242, 239, 232], { noise: 0.04 });
  paint(11, [35, 37, 43], { noise: 0.1 });
  paint(12, [154, 160, 164], { noise: 0.08 });
  paint(13, [127, 182, 230], { noise: 0.05, frame: true });
  paint(14, [156, 70, 51], { brick: true, noise: 0.1 });
  paint(15, [204, 198, 186], { grain: true, noise: 0.07 });
  paint(16, [238, 232, 216], { noise: 0.05, courses: true });
  paint(17, [244, 122, 32], { noise: 0.05 });
  paint(18, [22, 134, 24], { noise: 0.06 });
  paint(19, [70, 74, 79], { noise: 0.08, band: [225, 225, 220] });
  paint(20, [43, 94, 36], { noise: 0.32 });
  paint(21, [124, 130, 138], { noise: 0.06, grain: true });
  paint(22, [255, 241, 194], { noise: 0.03 });
  paint(23, [124, 118, 108], { noise: 0.1, courses: true });
  paint(24, [16, 52, 143], { noise: 0.06 });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  return {
    canvas,
    texture,
    // grass: green top (tile 0), earthy sides (tile 1), dirt underside
    tileForBlock: (block, faceY) => block === BlockId.GRASS
      ? faceY === 1 ? 0 : faceY === -1 ? BlockId.DIRT : 1
      : block,
  };
}
