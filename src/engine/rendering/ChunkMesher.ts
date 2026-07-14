import * as THREE from "three";
import { BlockId, type BlockIdValue } from "../world/blocks";
import { CHUNK_HEIGHT, CHUNK_SIZE, type VoxelChunk, VoxelWorld } from "../world/VoxelWorld";
import { ATLAS_TILES_PER_ROW, type TextureAtlas } from "./textureAtlas";

type Face = {
  normal: [number, number, number];
  corners: Array<[number, number, number]>;
  shade: number;
};

const FACES: Face[] = [
  { normal: [1, 0, 0], corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], shade: 0.72 },
  { normal: [-1, 0, 0], corners: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], shade: 0.72 },
  { normal: [0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], shade: 1 },
  { normal: [0, -1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], shade: 0.52 },
  { normal: [0, 0, 1], corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], shade: 0.85 },
  { normal: [0, 0, -1], corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], shade: 0.85 },
];

const UV = [[0,0],[1,0],[1,1],[0,1]] as const;
const EPSILON = 0.004;
const blockIndex = (x: number, y: number, z: number) => x + (z << 4) + (y << 8);

function faceVisible(block: BlockIdValue, neighbour: BlockIdValue): boolean {
  if (neighbour === BlockId.AIR) return true;
  if (neighbour === block) return false;
  return neighbour === BlockId.WATER || neighbour === BlockId.GLASS;
}

export class ChunkMesher {
  readonly material: THREE.MeshBasicMaterial;
  private readonly meshes = new Map<string, THREE.Mesh>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: VoxelWorld,
    private readonly atlas: TextureAtlas,
  ) {
    this.material = new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true });
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

  private rebuild(key: string, chunk: VoxelChunk): void {
    const positions: number[] = [];
    const uvs: number[] = [];
    const colours: number[] = [];
    const indices: number[] = [];
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
      for (let z = 0; z < CHUNK_SIZE; z += 1) {
        for (let x = 0; x < CHUNK_SIZE; x += 1) {
          const block = chunk.blocks[blockIndex(x, y, z)] as BlockIdValue;
          if (block === BlockId.AIR) continue;
          for (const face of FACES) {
            const [nx, ny, nz] = face.normal;
            const neighbour = this.world.getBlock(baseX + x + nx, y + ny, baseZ + z + nz);
            if (!faceVisible(block, neighbour)) continue;
            const tile = this.atlas.tileForBlock(block, ny);
            const span = 1 / ATLAS_TILES_PER_ROW;
            const u0 = (tile % ATLAS_TILES_PER_ROW) * span + EPSILON;
            const v1 = 1 - Math.floor(tile / ATLAS_TILES_PER_ROW) * span - EPSILON;
            const u1 = u0 + span - EPSILON * 2;
            const v0 = v1 - span + EPSILON * 2;
            const base = positions.length / 3;
            face.corners.forEach((corner, index) => {
              positions.push(baseX + x + corner[0], y + corner[1], baseZ + z + corner[2]);
              const uv = UV[index];
              if (uv) uvs.push(uv[0] ? u1 : u0, uv[1] ? v1 : v0);
              colours.push(face.shade, face.shade, face.shade);
            });
            indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
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
    if (!indices.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, this.material);
    this.meshes.set(key, mesh);
    this.scene.add(mesh);
  }
}
