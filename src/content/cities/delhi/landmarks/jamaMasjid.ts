import type { LandmarkDefinition } from "../../../types/landmark";

// Jama Masjid at diorama scale (1 block = 3 m): red sandstone plinth and
// courtyard, west prayer hall with three marble domes, twin minarets and an
// east gate on the bazaar axis. Anchor = courtyard centre = preset origin.
export const jamaMasjid: LandmarkDefinition = {
  id: "jama-masjid",
  name: "Jama Masjid",
  description: "Shah Jahan's great Friday mosque, rebuilt block by block.",
  anchor: { lat: 28.6507, lon: 77.2334 },
  suppressRadiusMetres: 130,
  build({ world, originX, originZ, groundY, block }) {
    const set = (x: number, y: number, z: number, id: number) =>
      world.setBlockRaw(originX + x, y, originZ + z, id as Parameters<typeof world.setBlockRaw>[3]);
    const box = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, id: number) => {
      for (let x = x1; x <= x2; x += 1)
        for (let y = y1; y <= y2; y += 1)
          for (let z = z1; z <= z2; z += 1) set(x, y, z, id);
    };
    const g = groundY;

    // Plinth, then courtyard paving: red sandstone slabs in a large grid
    // with lighter dividing strips, like the real courtyard.
    box(-17, g + 1, -14, 17, g + 1, 14, block.RED_SANDSTONE);
    for (let x = -16; x <= 16; x += 1) {
      for (let z = -13; z <= 13; z += 1) {
        const strip = (x + 16) % 4 === 0 || (z + 13) % 4 === 0;
        set(x, g + 1, z, strip ? block.SAND : block.RED_SANDSTONE);
      }
    }

    // Ablution pool with a marble rim.
    box(1, g + 1, -2, 7, g + 1, 2, block.WHITE_MARBLE);
    box(2, g + 1, -1, 6, g + 1, 1, block.WATER);

    // Perimeter arcade: columns every second block, parapet on top.
    const arcade = (x: number, z: number) => {
      if ((x + z) % 2 === 0) box(x, g + 2, z, x, g + 3, z, block.RED_SANDSTONE);
      set(x, g + 4, z, block.RED_SANDSTONE);
    };
    for (let x = -17; x <= 17; x += 1) {
      arcade(x, -14);
      arcade(x, 14);
    }
    for (let z = -13; z <= 13; z += 1) arcade(17, z);

    // Chhatri-style corner posts: sandstone shaft, marble canopy.
    for (const [cx, cz] of [[-17, -14], [-17, 14], [17, -14], [17, 14]] as const) {
      box(cx, g + 2, cz, cx, g + 5, cz, block.RED_SANDSTONE);
      set(cx, g + 6, cz, block.WHITE_MARBLE);
    }

    // East gate on the bazaar axis, with a walkable arch.
    box(16, g + 2, -3, 17, g + 7, 3, block.RED_SANDSTONE);
    box(16, g + 2, -1, 17, g + 4, 1, block.AIR);
    box(16, g + 8, -1, 17, g + 8, 1, block.WHITE_MARBLE);
    set(17, g + 9, 0, block.AUTO_YELLOW);

    // North and south gates.
    for (const zEdge of [-14, 14]) {
      box(-2, g + 2, zEdge, 2, g + 5, zEdge, block.RED_SANDSTONE);
      box(-1, g + 2, zEdge, 1, g + 3, zEdge, block.AIR);
    }

    // Prayer hall along the west side.
    box(-17, g + 2, -11, -11, g + 6, 11, block.RED_SANDSTONE);
    box(-16, g + 2, -10, -12, g + 5, 10, block.AIR);
    box(-17, g + 7, -11, -11, g + 7, 11, block.RED_SANDSTONE);
    // Facade bays: carve arched openings toward the courtyard.
    for (let z = -9; z <= 9; z += 2) box(-11, g + 2, z, -11, g + 4, z, block.AIR);
    // Central pishtaq: tall sandstone frame with a marble-trimmed arch.
    box(-11, g + 2, -3, -10, g + 9, 3, block.RED_SANDSTONE);
    box(-11, g + 10, -3, -10, g + 10, 3, block.SAND);
    box(-11, g + 2, -1, -10, g + 6, 1, block.AIR);
    box(-11, g + 7, -1, -11, g + 8, 1, block.WHITE_MARBLE);

    // Three onion domes: marble hemispheres with gold finials.
    const dome = (cz: number, radius: number) => {
      const cx = -14;
      const baseY = g + 8;
      for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx += 1) {
        for (let dz = -Math.ceil(radius); dz <= Math.ceil(radius); dz += 1) {
          for (let dy = 0; dy <= Math.ceil(radius); dy += 1) {
            if (Math.hypot(dx, dy, dz) <= radius + 0.4) set(cx + dx, baseY + dy, cz + dz, block.WHITE_MARBLE);
          }
        }
      }
      set(cx, baseY + Math.ceil(radius) + 1, cz, block.AUTO_YELLOW);
    };
    dome(0, 3.4);
    dome(-7, 2.5);
    dome(7, 2.5);

    // Twin minarets flanking the prayer hall facade.
    for (const mz of [-12, 12]) {
      box(-11, g + 2, mz, -10, g + 14, mz + (mz > 0 ? 1 : -1), block.RED_SANDSTONE);
      for (const bandY of [g + 5, g + 9, g + 13]) {
        box(-11, bandY, mz, -10, bandY, mz + (mz > 0 ? 1 : -1), block.WHITE_MARBLE);
      }
      box(-11, g + 15, mz, -10, g + 15, mz + (mz > 0 ? 1 : -1), block.WHITE_MARBLE);
      set(-11, g + 16, mz + (mz > 0 ? 1 : 0), block.AUTO_YELLOW);
    }
  },
};
