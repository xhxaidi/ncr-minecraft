// central park at rajiv chowk: sunken amphitheatre, ring paths and lawn planting
// the 63m national flag itself comes from the osm flagpole node
import { BlockId, type BlockIdValue } from "../../../../engine/world/blocks";
import type { LandmarkDefinition } from "../../../types/landmark";

export const centralPark: LandmarkDefinition = {
  id: "central-park",
  name: "Central Park",
  description: "The lawns and amphitheatre at the heart of Connaught Place.",
  anchor: { lat: 28.6327, lon: 77.2194 },
  suppressRadiusMetres: 80,
  build: ({ world, originX, originZ, groundY, blockMetres }) => {
    const scale = blockMetres ?? 3;
    const metres = (value: number) => Math.max(1, Math.round(value / scale));
    const set = (x: number, y: number, z: number, block: BlockIdValue) => {
      world.setBlockRaw(originX + x, groundY + y, originZ + z, block);
    };

    const plazaRadius = metres(14);
    const outerSeats = metres(26);
    const ringPath = metres(58);
    const treeRing = metres(44);

    for (let dx = -outerSeats; dx <= outerSeats; dx += 1) {
      for (let dz = -outerSeats; dz <= outerSeats; dz += 1) {
        const distance = Math.hypot(dx, dz);
        if (distance <= plazaRadius) {
          set(dx, 0, dz, BlockId.PAVEMENT);
        } else if (distance <= outerSeats) {
          // amphitheatre seating rises away from the stage
          const step = Math.min(3, Math.ceil((distance - plazaRadius) / metres(4)));
          set(dx, 0, dz, BlockId.PAVEMENT);
          for (let y = 1; y <= step; y += 1) set(dx, y, dz, BlockId.WHITE_MARBLE);
        }
      }
    }

    // circular walking path with eight radial spokes
    for (let dx = -ringPath - 1; dx <= ringPath + 1; dx += 1) {
      for (let dz = -ringPath - 1; dz <= ringPath + 1; dz += 1) {
        const distance = Math.hypot(dx, dz);
        if (Math.abs(distance - ringPath) <= 1) set(dx, 0, dz, BlockId.PAVEMENT);
      }
    }
    for (let spoke = 0; spoke < 8; spoke += 1) {
      const angle = (spoke * Math.PI) / 4;
      for (let step = outerSeats + 1; step <= ringPath; step += 1) {
        const x = Math.round(Math.cos(angle) * step);
        const z = Math.round(Math.sin(angle) * step);
        set(x, 0, z, BlockId.PAVEMENT);
        set(x + (Math.abs(Math.cos(angle)) < 0.5 ? 1 : 0), 0, z + (Math.abs(Math.cos(angle)) < 0.5 ? 0 : 1), BlockId.PAVEMENT);
      }
    }

    // formal tree ring between the seats and the walking path
    for (let tree = 0; tree < 16; tree += 1) {
      const angle = (tree * Math.PI) / 8;
      const x = Math.round(Math.cos(angle) * treeRing);
      const z = Math.round(Math.sin(angle) * treeRing);
      const trunk = metres(5);
      for (let y = 1; y <= trunk; y += 1) set(x, y, z, BlockId.WOOD);
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          set(x + dx, trunk, z + dz, BlockId.LEAVES);
          set(x + dx, trunk + 1, z + dz, BlockId.LEAVES);
        }
      }
      set(x, trunk + 2, z, BlockId.LEAVES);
    }
  },
};
