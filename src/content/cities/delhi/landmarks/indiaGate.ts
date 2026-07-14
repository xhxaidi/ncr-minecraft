import { BlockId, type BlockIdValue } from "../../../../engine/world/blocks";
import type { LandmarkDefinition } from "../../../types/landmark";

export const indiaGate: LandmarkDefinition = {
  id: "india-gate",
  name: "India Gate",
  description: "A mineable sandstone interpretation of New Delhi's ceremonial arch.",
  anchor: { lat: 28.6129, lon: 77.2295 },
  suppressRadiusMetres: 90,
  build: ({ world, originX, originZ, groundY }) => {
    const set = (x: number, y: number, z: number, block: BlockIdValue = BlockId.RED_SANDSTONE) => {
      world.setBlockRaw(originX + x, groundY + y, originZ + z, block);
    };

    for (let x = -10; x <= 10; x += 1) {
      for (let z = -5; z <= 5; z += 1) set(x, 1, z, BlockId.SAND);
    }
    for (let x = -8; x <= 8; x += 1) {
      for (let z = -3; z <= 3; z += 1) set(x, 2, z, BlockId.SAND);
    }

    for (let y = 0; y <= 17; y += 1) {
      for (let x = -7; x <= 7; x += 1) {
        const lowOpening = y <= 8 && Math.abs(x) <= 3;
        const archOpening = y >= 9 && y <= 13 &&
          (Math.abs(x) / 3.6) ** 2 + ((y - 9) / 4.7) ** 2 <= 1;
        if (lowOpening || archOpening) continue;
        for (let z = -2; z <= 2; z += 1) {
          set(x, y + 3, z, y % 5 === 0 ? BlockId.SAND : BlockId.RED_SANDSTONE);
        }
      }
    }

    for (const [level, halfWidth, depth, block] of [
      [17, 9, 3, BlockId.SAND],
      [20, 8, 3, BlockId.RED_SANDSTONE],
      [23, 9, 3, BlockId.SAND],
    ] as const) {
      for (let x = -halfWidth; x <= halfWidth; x += 1) {
        for (let z = -depth; z <= depth; z += 1) set(x, level, z, block);
      }
    }

    // Small ceremonial canopy on the approach.
    for (let x = -2; x <= 2; x += 1) {
      for (let z = 13; z <= 17; z += 1) set(x, 1, z, BlockId.BLACK_MARBLE);
    }
    for (const x of [-2, 2]) {
      for (const z of [13, 17]) {
        for (let y = 2; y <= 6; y += 1) set(x, y, z, BlockId.RED_SANDSTONE);
      }
    }
    for (let x = -3; x <= 3; x += 1) {
      for (let z = 12; z <= 18; z += 1) set(x, 7, z, BlockId.SAND);
    }
  },
};
