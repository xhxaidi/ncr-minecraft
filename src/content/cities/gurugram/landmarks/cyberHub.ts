// handcrafted dlf cyber hub: plaza boulevard, retail strips, skywalk, amphitheatre
// geometry is authored for the cyber-hub preset scale of 1.5 metres per block
import { BlockId, type BlockIdValue } from "../../../../engine/world/blocks";
import type { LandmarkDefinition } from "../../../types/landmark";

const STRIP_X = 56;
const STRIP_INNER_Z = 16;
const STRIP_OUTER_Z = 34;
const RING_X = 48;
const RING_INNER_Z = 10;
const RING_OUTER_Z = 12;
const DECK_Y = 6;

export const cyberHub: LandmarkDefinition = {
  id: "cyber-hub",
  name: "DLF Cyber Hub",
  description: "The NCR food and nightlife plaza: twin retail strips, a skywalk loop, amphitheatre and fountain.",
  anchor: { lat: 28.4948, lon: 77.0886 },
  suppressRadiusMetres: 135,
  build: ({ world, originX, originZ, groundY }) => {
    const set = (x: number, y: number, z: number, block: BlockIdValue) => {
      world.setBlockRaw(originX + x, groundY + y, originZ + z, block);
    };

    // clear generic osm output inside the complex, then lay the plaza floor
    for (let x = -60; x <= 60; x += 1) {
      for (let z = -36; z <= 36; z += 1) {
        for (let y = 1; y <= 40; y += 1) set(x, y, z, BlockId.AIR);
        if (Math.abs(x) <= 58 && Math.abs(z) <= 34) set(x, 0, z, BlockId.PAVEMENT);
      }
    }

    // twin retail strips, three storeys with slabs so interiors are walkable
    for (const side of [-1, 1]) {
      const front = STRIP_INNER_Z * side;
      const back = STRIP_OUTER_Z * side;
      for (let x = -STRIP_X; x <= STRIP_X; x += 1) {
        const bay = Math.floor((x + STRIP_X) / 8);
        const mullion = (x + STRIP_X) % 6 === 0;
        const doorway = (x + STRIP_X) % 12 === 6;
        for (let y = 1; y <= 11; y += 1) {
          // plaza-facing facade: glass shopfronts below, dark glass and piers above
          let facadeBlock: BlockIdValue = BlockId.DARK_GLASS;
          if (y <= 3) facadeBlock = doorway && y <= 2 ? BlockId.AIR : mullion ? BlockId.METAL : BlockId.GLASS;
          else if (y === 4) facadeBlock = bay % 2 === 0 ? BlockId.AWNING : BlockId.CONCRETE;
          else if (y === 8) facadeBlock = BlockId.CONCRETE;
          else if (mullion) facadeBlock = BlockId.CONCRETE;
          set(x, y, front, facadeBlock);
          // rear wall: concrete with window bands
          set(x, y, back, y % 4 === 2 ? BlockId.GLASS : BlockId.CONCRETE);
        }
        // floor slabs and roof across the strip depth
        for (let z = Math.min(front, back); z <= Math.max(front, back); z += 1) {
          set(x, 4, z, BlockId.CONCRETE);
          set(x, 8, z, BlockId.CONCRETE);
          set(x, 12, z, BlockId.CONCRETE);
        }
        // protruding awning over the shopfront and rooftop terrace railing
        if (bay % 2 === 0 && x % 8 !== 0) set(x, 4, front - side, BlockId.AWNING);
        set(x, 13, front, BlockId.METAL);
      }
      // strip end walls
      for (const x of [-STRIP_X, STRIP_X]) {
        for (let z = Math.min(front, back); z <= Math.max(front, back); z += 1) {
          for (let y = 1; y <= 11; y += 1) set(x, y, z, y % 4 === 2 ? BlockId.GLASS : BlockId.CONCRETE);
        }
      }
    }

    // elevated skywalk loop with railings and pillars
    for (let x = -RING_X; x <= RING_X; x += 1) {
      for (let z = -RING_OUTER_Z; z <= RING_OUTER_Z; z += 1) {
        const onBand = Math.abs(z) >= RING_INNER_Z || Math.abs(x) >= RING_X - 2;
        if (!onBand) continue;
        set(x, DECK_Y, z, BlockId.PAVEMENT);
        const outerEdge = Math.abs(z) === RING_OUTER_Z || Math.abs(x) === RING_X;
        const innerEdge = !outerEdge && (Math.abs(z) === RING_INNER_Z || Math.abs(x) === RING_X - 2);
        const stairGap = Math.abs(z) === RING_OUTER_Z && Math.abs(Math.abs(x) - 24) <= 1;
        if ((outerEdge || innerEdge) && !stairGap) set(x, DECK_Y + 1, z, BlockId.METAL);
      }
    }
    for (const x of [-40, -24, -8, 8, 24, 40]) {
      for (const z of [-RING_INNER_Z, RING_INNER_Z]) {
        for (let y = 1; y < DECK_Y; y += 1) set(x, y, z, BlockId.METAL);
      }
    }
    // four staircases up to the skywalk
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (let stepIndex = 0; stepIndex <= 5; stepIndex += 1) {
          const z = (18 - stepIndex) * sz;
          for (let dx = -1; dx <= 1; dx += 1) {
            for (let y = 1; y <= stepIndex + 1; y += 1) set(24 * sx + dx, y, z, BlockId.STONE);
          }
        }
      }
    }

    // amphitheatre and stage at the east end
    for (const [radius, tier] of [[12, 1], [9, 2], [6, 3]] as const) {
      for (let dx = 0; dx <= radius; dx += 1) {
        for (let dz = -radius; dz <= radius; dz += 1) {
          if (Math.hypot(dx, dz) > radius) continue;
          for (let y = 1; y <= tier; y += 1) set(44 + dx, y, dz, BlockId.WHITE_MARBLE);
        }
      }
    }
    for (let dx = -5; dx <= 5; dx += 1) {
      for (let dz = -5; dz <= 5; dz += 1) {
        if (Math.hypot(dx, dz) <= 5) set(36 + dx, 1, dz, BlockId.BLACK_MARBLE);
      }
    }

    // central fountain on the west boulevard
    for (let dx = -5; dx <= 5; dx += 1) {
      for (let dz = -5; dz <= 5; dz += 1) {
        const distance = Math.hypot(dx, dz);
        if (distance > 5) continue;
        set(-36 + dx, 1, dz, distance > 4 ? BlockId.STONE : BlockId.WATER);
      }
    }
    set(-36, 2, 0, BlockId.WHITE_MARBLE);
    set(-36, 3, 0, BlockId.WHITE_MARBLE);
    set(-36, 4, 0, BlockId.WATER);

    // planters with trees, and parasols for outdoor seating
    for (let x = -52; x <= 52; x += 13) {
      for (const z of [-14, 14]) {
        for (let dx = -1; dx <= 1; dx += 1) {
          for (let dz = -1; dz <= 1; dz += 1) {
            set(x + dx, 1, z + dz, dx === 0 && dz === 0 ? BlockId.GRASS : BlockId.STONE);
          }
        }
        set(x, 2, z, BlockId.WOOD);
        set(x, 3, z, BlockId.WOOD);
        for (let dx = -1; dx <= 1; dx += 1) {
          for (let dz = -1; dz <= 1; dz += 1) set(x + dx, 4, z + dz, BlockId.LEAVES);
        }
        set(x, 5, z, BlockId.LEAVES);
      }
    }
    for (const x of [-46, -33, -7, 6, 32, 45]) {
      for (const z of [-14, 14]) {
        for (let y = 1; y <= 3; y += 1) set(x, y, z, BlockId.WOOD);
        for (let dx = -1; dx <= 1; dx += 1) {
          for (let dz = -1; dz <= 1; dz += 1) set(x + dx, 4, z + dz, BlockId.AWNING);
        }
      }
    }

    // west entry gate
    for (const z of [-8, 8]) {
      for (let y = 1; y <= 8; y += 1) {
        set(-58, y, z, BlockId.BLACK_MARBLE);
        set(-57, y, z, BlockId.BLACK_MARBLE);
      }
    }
    for (let z = -8; z <= 8; z += 1) {
      set(-58, 7, z, BlockId.AWNING);
      set(-58, 8, z, BlockId.BLACK_MARBLE);
      set(-58, 9, z, BlockId.BLACK_MARBLE);
      set(-57, 8, z, BlockId.BLACK_MARBLE);
    }
  },
};
