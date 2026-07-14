import { BlockId, type BlockIdValue } from "../../../../engine/world/blocks";
import type { LandmarkDefinition } from "../../../types/landmark";

export const qutubMinar: LandmarkDefinition = {
  id: "qutub-minar",
  name: "Qutub Minar",
  description: "A tapered, balcony-ringed voxel tower built entirely from mineable blocks.",
  anchor: { lat: 28.5245, lon: 77.1855 },
  suppressRadiusMetres: 100,
  build: ({ world, originX, originZ, groundY }) => {
    const set = (x: number, y: number, z: number, block: BlockIdValue = BlockId.RED_SANDSTONE) => {
      world.setBlockRaw(originX + x, groundY + y, originZ + z, block);
    };

    for (let x = -7; x <= 7; x += 1) {
      for (let z = -7; z <= 7; z += 1) {
        if (x * x + z * z <= 48) set(x, 1, z, BlockId.SAND);
      }
    }

    const height = 31;
    const balconyLevels = new Set([8, 15, 21, 26]);
    for (let y = 2; y <= height; y += 1) {
      const radius = y < 9 ? 5 : y < 16 ? 4.3 : y < 23 ? 3.5 : y < 28 ? 2.8 : 2.2;
      const limit = Math.ceil(radius + 1);
      for (let x = -limit; x <= limit; x += 1) {
        for (let z = -limit; z <= limit; z += 1) {
          const distance = Math.hypot(x, z);
          const isWall = distance <= radius && distance >= radius - 1.35;
          const isBalcony = balconyLevels.has(y) && distance <= radius + 1;
          if (isWall || isBalcony) {
            const stripe = y % 6 === 0 || balconyLevels.has(y);
            set(x, y, z, stripe ? BlockId.SAND : BlockId.RED_SANDSTONE);
          }
        }
      }
    }
    for (let x = -2; x <= 2; x += 1) {
      for (let z = -2; z <= 2; z += 1) set(x, height + 1, z, BlockId.SAND);
    }
  },
};
