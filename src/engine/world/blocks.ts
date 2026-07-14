export const BlockId = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  ROAD: 4,
  WATER: 5,
  WOOD: 6,
  LEAVES: 7,
  SAND: 8,
  RED_SANDSTONE: 9,
  WHITE_MARBLE: 10,
  BLACK_MARBLE: 11,
  CONCRETE: 12,
  GLASS: 13,
  BRICK: 14,
} as const;

export type BlockIdValue = (typeof BlockId)[keyof typeof BlockId];

export const BLOCK_NAMES = [
  "Air", "Grass", "Dirt", "Stone", "Road", "Water", "Wood", "Leaves",
  "Sandstone", "Red sandstone", "White marble", "Black marble", "Concrete",
  "Glass", "Brick",
] as const;

export const HOTBAR_BLOCKS: BlockIdValue[] = [
  BlockId.RED_SANDSTONE,
  BlockId.WHITE_MARBLE,
  BlockId.BLACK_MARBLE,
  BlockId.BRICK,
  BlockId.STONE,
  BlockId.ROAD,
  BlockId.WOOD,
  BlockId.LEAVES,
  BlockId.GLASS,
];

export function isSolid(block: BlockIdValue): boolean {
  return block !== BlockId.AIR && block !== BlockId.WATER;
}

export function cycleHotbar(current: number, direction: number, length: number): number {
  return ((current + direction) % length + length) % length;
}
