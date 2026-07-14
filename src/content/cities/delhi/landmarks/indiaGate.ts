import { BlockId, type BlockIdValue } from "../../../../engine/world/blocks";
import type { LandmarkDefinition } from "../../../types/landmark";
import { INDIA_GATE_BOUNDS, INDIA_GATE_VOXELS } from "./data/indiaGateVoxels.generated";

const INDIA = [
  ["111", "010", "010", "010", "111"],
  ["1001", "1101", "1011", "1001", "1001"],
  ["1110", "1001", "1001", "1001", "1110"],
  ["111", "010", "010", "010", "111"],
  ["0110", "1001", "1111", "1001", "1001"],
] as const;

export const indiaGate: LandmarkDefinition = {
  id: "india-gate",
  name: "India Gate",
  description: "A mineable, source-modelled memorial with real-world proportions and a clear ceremonial approach.",
  anchor: { lat: 28.6129, lon: 77.2295 },
  suppressRadiusMetres: 150,
  build: ({ world, originX, originZ, groundY }) => {
    const set = (x: number, y: number, z: number, block: BlockIdValue) => {
      world.setBlockRaw(originX + x, groundY + y, originZ + z, block);
    };

    // OSM parks can generate trees before landmarks are inserted. Clear the full
    // sightline so the player sees the monument instead of trunks and leaf walls.
    for (let x = -28; x <= 28; x += 1) {
      for (let z = -38; z <= 38; z += 1) {
        for (let y = 1; y <= 52; y += 1) set(x, y, z, BlockId.AIR);
      }
    }

    // Low, uncluttered hexagon-inspired plaza with a strong Kartavya Path axis.
    for (let x = -28; x <= 28; x += 1) {
      for (let z = -38; z <= 38; z += 1) {
        const ellipse = Math.hypot(x / 28, z / 38);
        if (ellipse > 1) continue;
        const border = ellipse > 0.92;
        const processionalAxis = Math.abs(x) <= 3;
        set(x, 0, z, border ? BlockId.RED_SANDSTONE : processionalAxis ? BlockId.SAND : BlockId.STONE);
      }
    }

    // This is generated from a CC BY-SA OBJ rather than a guessed front elevation.
    // Each span is a compact run of normal mineable blocks.
    for (const [y, z, minX, maxX] of INDIA_GATE_VOXELS) {
      const material = y <= 2 ? BlockId.RED_SANDSTONE : BlockId.SAND;
      for (let x = minX; x <= maxX; x += 1) set(x, y + 1, z, material);
    }

    // Keep the inscription restrained and attached to the model's real facade.
    const depthAtHeight = new Map<number, number>();
    for (const [y, z] of INDIA_GATE_VOXELS) {
      depthAtHeight.set(y, Math.max(depthAtHeight.get(y) ?? 0, Math.abs(z)));
    }
    const inscriptionWidth = INDIA.reduce((total, letter) => total + (letter[0]?.length ?? 0), 0) + INDIA.length - 1;
    let cursorX = -Math.floor(inscriptionWidth / 2);
    for (const letter of INDIA) {
      for (let row = 0; row < letter.length; row += 1) {
        for (let column = 0; column < (letter[row]?.length ?? 0); column += 1) {
          if (letter[row]?.[column] !== "1") continue;
          const y = 37 - row;
          const depth = (depthAtHeight.get(y - 1) ?? INDIA_GATE_BOUNDS.maxZ) + 1;
          set(cursorX + column, y, depth, BlockId.RED_SANDSTONE);
          set(cursorX + column, y, -depth, BlockId.RED_SANDSTONE);
        }
      }
      cursorX += (letter[0]?.length ?? 0) + 1;
    }

    // Amar Jawan Jyoti-inspired memorial beneath the main arch, kept narrow
    // enough that players can still walk through on either side.
    for (let x = -2; x <= 2; x += 1) {
      for (let z = -2; z <= 2; z += 1) set(x, 1, z, BlockId.BLACK_MARBLE);
    }
    for (let y = 2; y <= 4; y += 1) set(0, y, 0, BlockId.BLACK_MARBLE);
    set(0, 5, 0, BlockId.RED_SANDSTONE);

    // Sparse edge lighting preserves depth without blocking the arrival view.
    for (let z = -24; z <= 24; z += 8) {
      for (const x of [-24, 24]) {
        set(x, 1, z, BlockId.BLACK_MARBLE);
        set(x, 2, z, BlockId.BLACK_MARBLE);
        set(x, 3, z, BlockId.WHITE_MARBLE);
      }
    }
  },
};
