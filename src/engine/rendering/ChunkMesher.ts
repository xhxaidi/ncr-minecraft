import * as THREE from "three";
import { BLOCK_COLORS, BlockId, type BlockIdValue, isSolid } from "../world/blocks";
import { CHUNK_HEIGHT, CHUNK_SIZE, type VoxelChunk, VoxelWorld } from "../world/VoxelWorld";

type Face = {
  normal: [number, number, number];
  corners: Array<[number, number, number]>;
  shade: number;
};

// Gentle directional face shading (voxel-art look): top 1.0, N/S 0.87,
// E/W 0.78, bottom 0.6.
const FACES: Face[] = [
  { normal: [1, 0, 0], corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], shade: 0.78 },
  { normal: [-1, 0, 0], corners: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], shade: 0.78 },
  { normal: [0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], shade: 1 },
  { normal: [0, -1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], shade: 0.6 },
  { normal: [0, 0, 1], corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], shade: 0.87 },
  { normal: [0, 0, -1], corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], shade: 0.87 },
];

const AO_LEVELS = [1, 0.88, 0.78, 0.66] as const;
const NEON_HUES: Array<[number, number, number]> = [
  [1, 0.28, 0.75], [0.25, 0.85, 1], [1, 0.55, 0.16], [0.55, 1, 0.3],
];
// Prop hues drawn from the master palette's three families, desaturated to
// sit inside the diorama rather than pop out of it.
const CLOTH_HUES: Array<[number, number, number]> = [
  [0.79, 0.33, 0.25], [0.25, 0.37, 0.62], [0.88, 0.66, 0.2],
  [0.18, 0.52, 0.47], [0.93, 0.89, 0.83], [0.69, 0.29, 0.47],
];
const SKIN_TONES: Array<[number, number, number]> = [
  [0.85, 0.62, 0.45], [0.72, 0.5, 0.35], [0.6, 0.4, 0.28],
];
const AWNING_HUES: Array<[number, number, number]> = [
  [0.71, 0.25, 0.18], [0.18, 0.37, 0.59], [0.85, 0.57, 0.16], [0.18, 0.48, 0.32],
];

const GROUP_SOLID = 0;
const GROUP_WINDOW = 1;
const GROUP_NEON = 2;

const blockIndex = (x: number, y: number, z: number) => x + (z << 4) + (y << 8);

const hash3 = (x: number, y: number, z: number) =>
  Math.abs((x * 73856093) ^ (y * 19349663) ^ (z * 83492791));

function faceVisible(block: BlockIdValue, neighbour: BlockIdValue): boolean {
  if (neighbour === BlockId.AIR) return true;
  if (neighbour === block) return false;
  return neighbour === BlockId.WATER || neighbour === BlockId.GLASS;
}

function groupFor(block: BlockIdValue): number {
  if (block === BlockId.WINDOW) return GROUP_WINDOW;
  if (block === BlockId.NEON) return GROUP_NEON;
  return GROUP_SOLID;
}

const pick = (hues: Array<[number, number, number]>, seed: number) => hues[seed % hues.length] as [number, number, number];

function baseColor(block: BlockIdValue, faceY: number, x: number, y: number, z: number): [number, number, number] {
  if (block === BlockId.WINDOW) return [1, 1, 1];
  if (block === BlockId.NEON) return pick(NEON_HUES, hash3(x, y, z));
  // Hash on x/z only so a multi-block figure/awning keeps one colour per column.
  if (block === BlockId.FIGURE_BODY) return pick(CLOTH_HUES, hash3(x, 0, z));
  if (block === BlockId.FIGURE_HEAD) return pick(SKIN_TONES, hash3(x, 0, z));
  if (block === BlockId.AWNING) {
    // Alternate white/accent per block for a striped canopy; accent is
    // consistent across each 4-block cell so a stall reads as one colour.
    if ((x + z) & 1) return [0.97, 0.96, 0.94];
    return pick(AWNING_HUES, hash3(x >> 2, 0, z >> 2));
  }
  const source = block === BlockId.GRASS && faceY !== 1
    ? faceY === -1 ? BlockId.DIRT : BlockId.GRASS
    : block;
  const rgb = BLOCK_COLORS[source] ?? [255, 0, 255];
  if (source === BlockId.GRASS && faceY !== 1) return [150 / 255, 126 / 255, 82 / 255];
  return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
}

export class ChunkMesher {
  // Shared array instance so swapping an entry restyles every chunk at once.
  readonly materials: THREE.Material[];
  readonly solidMaterial: THREE.MeshLambertMaterial;
  private readonly windowDay = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x9fc4e8 });
  private readonly windowNight = new THREE.MeshBasicMaterial({ vertexColors: true });
  private readonly neonDay = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x23262e });
  private readonly neonNight = new THREE.MeshBasicMaterial({ vertexColors: true });
  private readonly meshes = new Map<string, THREE.Mesh>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: VoxelWorld,
  ) {
    this.solidMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.windowNight.color.setRGB(2.4, 1.9, 1.1); // window_warm, above bloom threshold
    this.neonNight.color.setRGB(2.6, 2.6, 2.6);
    this.materials = [this.solidMaterial, this.windowDay, this.neonDay];
  }

  setNight(night: boolean): void {
    this.solidMaterial.color.set(night ? 0x8fa3cd : 0xffffff);
    this.materials[GROUP_WINDOW] = night ? this.windowNight : this.windowDay;
    this.materials[GROUP_NEON] = night ? this.neonNight : this.neonDay;
  }

  clear(): void {
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshes.clear();
  }

  rebuildBudget(limit = 8): number {
    let rebuilt = 0;
    for (const key of [...this.world.dirty]) {
      if (rebuilt >= limit) break;
      this.world.dirty.delete(key);
      const [cxText, czText] = key.split(",");
      const cx = Number(cxText);
      const cz = Number(czText);
      const chunk = this.world.getChunk(cx, cz);
      if (chunk) this.rebuild(key, chunk);
      rebuilt += 1;
    }
    return rebuilt;
  }

  private vertexAO(x: number, y: number, z: number, normal: [number, number, number], corner: [number, number, number]): number {
    const axis = normal[0] !== 0 ? 0 : normal[1] !== 0 ? 1 : 2;
    const t1 = axis === 0 ? 1 : 0;
    const t2 = axis === 2 ? 1 : 2;
    const base = [x + normal[0], y + normal[1], z + normal[2]];
    const d1 = corner[t1] === 1 ? 1 : -1;
    const d2 = corner[t2] === 1 ? 1 : -1;
    const occupied = (offset1: number, offset2: number) => {
      const p = [...base];
      p[t1]! += offset1;
      p[t2]! += offset2;
      return isSolid(this.world.getBlock(p[0]!, p[1]!, p[2]!)) ? 1 : 0;
    };
    const side1 = occupied(d1, 0);
    const side2 = occupied(0, d2);
    const level = side1 && side2 ? 3 : side1 + side2 + occupied(d1, d2);
    return AO_LEVELS[level] ?? 1;
  }

  private rebuild(key: string, chunk: VoxelChunk): void {
    const positions: number[] = [];
    const normals: number[] = [];
    const colours: number[] = [];
    const groupIndices: number[][] = [[], [], []];
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
      for (let z = 0; z < CHUNK_SIZE; z += 1) {
        for (let x = 0; x < CHUNK_SIZE; x += 1) {
          const block = chunk.blocks[blockIndex(x, y, z)] as BlockIdValue;
          if (block === BlockId.AIR) continue;
          const wx = baseX + x;
          const wz = baseZ + z;
          // Only foliage gets per-block tone jitter; flat colour everywhere
          // else keeps the clean voxel-art look (noise reads as Minecraft).
          const jitter = block === BlockId.GRASS || block === BlockId.LEAVES
            ? 0.96 + (hash3(wx, y, wz) % 9) / 100
            : 1;
          for (const face of FACES) {
            const [nx, ny, nz] = face.normal;
            const neighbour = this.world.getBlock(wx + nx, y + ny, wz + nz);
            if (!faceVisible(block, neighbour)) continue;
            const rgb = baseColor(block, ny, wx, y, wz);
            const base = positions.length / 3;
            const ao: number[] = [];
            face.corners.forEach((corner) => {
              positions.push(wx + corner[0], y + corner[1], baseZ + z + corner[2]);
              normals.push(nx, ny, nz);
              const occlusion = this.vertexAO(wx, y, wz, face.normal, corner);
              ao.push(occlusion);
              const light = face.shade * occlusion * jitter;
              colours.push(rgb[0] * light, rgb[1] * light, rgb[2] * light);
            });
            const indices = groupIndices[groupFor(block)]!;
            // Flip the quad diagonal when AO is anisotropic to avoid seams.
            if ((ao[0]! + ao[2]!) < (ao[1]! + ao[3]!)) {
              indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
            } else {
              indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
            }
          }
        }
      }
    }

    const previous = this.meshes.get(key);
    if (previous) {
      this.scene.remove(previous);
      previous.geometry.dispose();
      this.meshes.delete(key);
    }
    const allIndices = groupIndices.flat();
    if (!allIndices.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
    geometry.setIndex(allIndices);
    let start = 0;
    groupIndices.forEach((indices, materialIndex) => {
      if (indices.length) geometry.addGroup(start, indices.length, materialIndex);
      start += indices.length;
    });
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, this.materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.meshes.set(key, mesh);
    this.scene.add(mesh);
  }
}
