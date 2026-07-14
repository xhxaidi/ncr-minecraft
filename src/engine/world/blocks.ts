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
  WINDOW: 15,
  NEON: 16,
  FIGURE_BODY: 17,
  FIGURE_HEAD: 18,
  AWNING: 19,
  AUTO_GREEN: 20,
  AUTO_YELLOW: 21,
} as const;

export type BlockIdValue = (typeof BlockId)[keyof typeof BlockId];

export const BLOCK_NAMES = [
  "Air", "Grass", "Dirt", "Stone", "Road", "Water", "Wood", "Leaves",
  "Sandstone", "Red sandstone", "White marble", "Black marble", "Concrete",
  "Glass", "Brick", "Window", "Neon sign", "Person", "Person", "Awning",
  "Auto body", "Auto roof",
] as const;

// Master diorama palette (0-255 RGB), indexed by BlockId. Three hue families
// only — warm sandstone/terracotta, cool blue-gray, vegetation green — with a
// consistent mid saturation. No pure white, no pure black: the value range
// runs warm off-white (marble) to blue-slate (dark marble). WINDOW/NEON are
// tinted by their material (day glass / night glow), so they bake white.
// FIGURE_* and AWNING get position-hashed hues in the mesher.
export const BLOCK_COLORS: Array<[number, number, number]> = [
  [0, 0, 0],        // AIR (never drawn)
  [125, 168, 90],   // GRASS      green family, desaturated warm
  [176, 138, 94],   // DIRT       warm tan
  [154, 160, 172],  // STONE      cool mid gray
  [104, 110, 122],  // ROAD       cool dark blue-gray
  [86, 132, 190],   // WATER      cool desat blue
  [154, 107, 66],   // WOOD       warm
  [94, 148, 72],    // LEAVES     green family
  [232, 213, 174],  // SAND       warm plaster light
  [194, 106, 74],   // RED_SANDSTONE  terracotta
  [239, 231, 214],  // WHITE_MARBLE   warm off-white (palette max value)
  [58, 66, 82],     // BLACK_MARBLE   blue-slate (palette min value)
  [186, 190, 198],  // CONCRETE   cool light blue-gray
  [167, 200, 224],  // GLASS      cool pale blue
  [176, 92, 66],    // BRICK      terracotta deep
  [170, 206, 242],  // WINDOW     (hotbar swatch only)
  [214, 96, 160],   // NEON       (hotbar swatch only)
  [255, 255, 255],  // FIGURE_BODY (hashed in mesher)
  [255, 255, 255],  // FIGURE_HEAD (hashed in mesher)
  [255, 255, 255],  // AWNING      (hashed in mesher)
  [63, 127, 92],    // AUTO_GREEN  green family, desat
  [224, 181, 62],   // AUTO_YELLOW warm marigold accent
];

export const HOTBAR_BLOCKS: BlockIdValue[] = [
  BlockId.RED_SANDSTONE,
  BlockId.WHITE_MARBLE,
  BlockId.BLACK_MARBLE,
  BlockId.BRICK,
  BlockId.STONE,
  BlockId.ROAD,
  BlockId.WOOD,
  BlockId.NEON,
  BlockId.GLASS,
];

export function isSolid(block: BlockIdValue): boolean {
  return block !== BlockId.AIR && block !== BlockId.WATER;
}
