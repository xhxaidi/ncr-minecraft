import { BlockId, type BlockIdValue } from "./blocks";

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const GROUND_LEVEL = 10;

export type VoxelChunk = {
  blocks: Uint8Array;
  cx: number;
  cz: number;
};

const chunkKey = (cx: number, cz: number) => `${cx},${cz}`;
const blockIndex = (x: number, y: number, z: number) => x + (z << 4) + (y << 8);

export class VoxelWorld {
  readonly chunks = new Map<string, VoxelChunk>();
  readonly dirty = new Set<string>();

  getChunk(cx: number, cz: number, create = false): VoxelChunk | undefined {
    const key = chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk && create) {
      chunk = {
        blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
        cx,
        cz,
      };
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  getBlock(x: number, y: number, z: number): BlockIdValue {
    if (y < 0 || y >= CHUNK_HEIGHT) return BlockId.AIR;
    const chunk = this.chunks.get(chunkKey(x >> 4, z >> 4));
    return (chunk?.blocks[blockIndex(x & 15, y, z & 15)] ?? BlockId.AIR) as BlockIdValue;
  }

  setBlockRaw(x: number, y: number, z: number, block: BlockIdValue): void {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const chunk = this.getChunk(x >> 4, z >> 4, true);
    if (chunk) chunk.blocks[blockIndex(x & 15, y, z & 15)] = block;
  }

  setBlock(x: number, y: number, z: number, block: BlockIdValue): void {
    this.setBlockRaw(x, y, z, block);
    const cx = x >> 4;
    const cz = z >> 4;
    const lx = x & 15;
    const lz = z & 15;
    this.dirty.add(chunkKey(cx, cz));
    if (lx === 0) this.dirty.add(chunkKey(cx - 1, cz));
    if (lx === 15) this.dirty.add(chunkKey(cx + 1, cz));
    if (lz === 0) this.dirty.add(chunkKey(cx, cz - 1));
    if (lz === 15) this.dirty.add(chunkKey(cx, cz + 1));
  }

  clear(): void {
    this.chunks.clear();
    this.dirty.clear();
  }

  generateFlat(radiusChunks: number): void {
    this.clear();
    for (let cx = -radiusChunks; cx <= radiusChunks; cx += 1) {
      for (let cz = -radiusChunks; cz <= radiusChunks; cz += 1) {
        const chunk = this.getChunk(cx, cz, true);
        if (!chunk) continue;
        for (let y = 0; y <= GROUND_LEVEL; y += 1) {
          const block = y === GROUND_LEVEL
            ? BlockId.GRASS
            : y >= GROUND_LEVEL - 2
              ? BlockId.DIRT
              : BlockId.STONE;
          for (let z = 0; z < CHUNK_SIZE; z += 1) {
            for (let x = 0; x < CHUNK_SIZE; x += 1) {
              chunk.blocks[blockIndex(x, y, z)] = block;
            }
          }
        }
        this.dirty.add(chunkKey(cx, cz));
      }
    }
  }

  markAllDirty(): void {
    for (const chunk of this.chunks.values()) {
      this.dirty.add(chunkKey(chunk.cx, chunk.cz));
    }
  }
}
