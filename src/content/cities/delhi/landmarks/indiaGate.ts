import { BlockId, type BlockIdValue } from "../../../../engine/world/blocks";
import type { LandmarkDefinition } from "../../../types/landmark";

type Letter = readonly string[];

const INDIA: readonly Letter[] = [
  ["111", "010", "010", "010", "111"],
  ["1001", "1101", "1011", "1001", "1001"],
  ["1110", "1001", "1001", "1001", "1110"],
  ["111", "010", "010", "010", "111"],
  ["0110", "1001", "1111", "1001", "1001"],
];

export const indiaGate: LandmarkDefinition = {
  id: "india-gate",
  name: "India Gate",
  description: "A detailed, mineable sandstone memorial with a deep arch, inscriptions and ceremonial plaza.",
  anchor: { lat: 28.6129, lon: 77.2295 },
  suppressRadiusMetres: 120,
  build: ({ world, originX, originZ, groundY }) => {
    const set = (x: number, y: number, z: number, block: BlockIdValue = BlockId.SAND) => {
      world.setBlockRaw(originX + x, groundY + y, originZ + z, block);
    };
    const fill = (
      minX: number,
      maxX: number,
      minY: number,
      maxY: number,
      minZ: number,
      maxZ: number,
      block: BlockIdValue,
    ) => {
      for (let y = minY; y <= maxY; y += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
          for (let x = minX; x <= maxX; x += 1) set(x, y, z, block);
        }
      }
    };
    const facade = (x: number, y: number, block: BlockIdValue, depth = 5) => {
      set(x, y, depth, block);
      set(x, y, -depth, block);
    };
    const openingHalfWidth = (y: number): number => {
      if (y <= 14) return 4;
      if (y > 20) return -1;
      const normalY = (y - 14) / 6;
      return Math.floor(4.8 * Math.sqrt(Math.max(0, 1 - normalY * normalY)));
    };

    // Ceremonial paving, a broad approach and the three-step red-stone plinth.
    for (let z = -14; z <= 30; z += 1) {
      for (let x = -18; x <= 18; x += 1) {
        const border = Math.abs(x) >= 16 || z === -14 || z === 30;
        const centreLine = Math.abs(x) <= 1 && z > 8;
        set(x, 0, z, border ? BlockId.RED_SANDSTONE : centreLine ? BlockId.WHITE_MARBLE : BlockId.STONE);
      }
    }
    fill(-14, 14, 1, 1, -7, 7, BlockId.RED_SANDSTONE);
    fill(-13, 13, 2, 2, -6, 6, BlockId.SAND);
    fill(-12, 12, 3, 3, -5, 5, BlockId.WHITE_MARBLE);

    // The memorial body. Its nine-block-deep passage is actually walkable.
    for (let y = 4; y <= 20; y += 1) {
      const opening = openingHalfWidth(y);
      const halfWidth = y >= 18 ? 12 : 11;
      for (let z = -4; z <= 4; z += 1) {
        for (let x = -halfWidth; x <= halfWidth; x += 1) {
          if (opening >= 0 && Math.abs(x) <= opening) continue;
          set(x, y, z, BlockId.SAND);
        }
      }

      // Warm, recessed stone around the inner arch makes the tunnel feel deep.
      if (opening >= 0) {
        const edge = opening + 1;
        for (let z = -4; z <= 4; z += 1) {
          set(edge, y, z, BlockId.RED_SANDSTONE);
          set(-edge, y, z, BlockId.RED_SANDSTONE);
        }
      }
    }

    // Lower facade: projected pylons, recessed panels and horizontal mouldings.
    for (const x of [-11, -6, 6, 11]) {
      for (let y = 5; y <= 19; y += 1) facade(x, y, y % 5 === 0 ? BlockId.WHITE_MARBLE : BlockId.SAND);
    }
    for (const y of [6, 11, 15]) {
      for (let x = -11; x <= 11; x += 1) {
        if (Math.abs(x) > openingHalfWidth(y)) facade(x, y, BlockId.WHITE_MARBLE);
      }
    }
    for (const centreX of [-8, 8]) {
      for (let x = centreX - 2; x <= centreX + 2; x += 1) {
        facade(x, 8, BlockId.RED_SANDSTONE);
        facade(x, 12, BlockId.RED_SANDSTONE);
      }
      for (let y = 8; y <= 12; y += 1) {
        facade(centreX - 2, y, BlockId.RED_SANDSTONE);
        facade(centreX + 2, y, BlockId.RED_SANDSTONE);
      }
    }

    // A double voussoir ring follows the curved opening on both elevations.
    for (let y = 4; y <= 20; y += 1) {
      const opening = openingHalfWidth(y);
      if (opening < 0) continue;
      const inner = opening + 1;
      const outer = Math.min(12, opening + 2);
      facade(inner, y, BlockId.WHITE_MARBLE);
      facade(-inner, y, BlockId.WHITE_MARBLE);
      facade(outer, y, BlockId.RED_SANDSTONE);
      facade(-outer, y, BlockId.RED_SANDSTONE);
    }

    // Circular memorial wreaths inspired by the stone reliefs on the real gate.
    const medallion = [[0, -2], [-1, -1], [1, -1], [-2, 0], [2, 0], [-1, 1], [1, 1], [0, 2]] as const;
    for (const centreX of [-8, 8]) {
      for (const [dx, dy] of medallion) facade(centreX + dx, 17 + dy, BlockId.RED_SANDSTONE);
    }

    // Deep cornice, repeating dentils, frieze and a second projecting cornice.
    fill(-13, 13, 21, 21, -5, 5, BlockId.WHITE_MARBLE);
    fill(-12, 12, 22, 24, -4, 4, BlockId.SAND);
    for (let x = -11; x <= 11; x += 2) {
      facade(x, 22, BlockId.RED_SANDSTONE);
      facade(x, 23, BlockId.WHITE_MARBLE);
    }
    fill(-13, 13, 25, 25, -5, 5, BlockId.RED_SANDSTONE);
    fill(-12, 12, 26, 26, -5, 5, BlockId.WHITE_MARBLE);

    // Inscription attic. INDIA is built from real blocks, not a flat overlay.
    fill(-12, 12, 27, 31, -4, 4, BlockId.SAND);
    const inscriptionWidth = INDIA.reduce((total, letter) => total + (letter[0]?.length ?? 0), 0) + INDIA.length - 1;
    let cursorX = -Math.floor(inscriptionWidth / 2);
    for (const letter of INDIA) {
      for (let row = 0; row < letter.length; row += 1) {
        const pixels = letter[row] ?? "";
        for (let column = 0; column < pixels.length; column += 1) {
          if (pixels[column] !== "1") continue;
          facade(cursorX + column, 31 - row, BlockId.BLACK_MARBLE);
        }
      }
      cursorX += (letter[0]?.length ?? 0) + 1;
    }

    // The stepped crown reproduces the monument's tapering upper silhouette.
    fill(-12, 12, 32, 32, -5, 5, BlockId.WHITE_MARBLE);
    fill(-10, 10, 33, 34, -4, 4, BlockId.SAND);
    fill(-9, 9, 35, 35, -4, 4, BlockId.RED_SANDSTONE);
    fill(-8, 8, 36, 37, -3, 3, BlockId.SAND);
    fill(-9, 9, 38, 38, -4, 4, BlockId.WHITE_MARBLE);
    fill(-3, 3, 39, 39, -2, 2, BlockId.RED_SANDSTONE);

    // Front memorial plinth, perimeter hedges and stone-and-iron bollards.
    fill(-2, 2, 1, 1, 13, 17, BlockId.BLACK_MARBLE);
    fill(-1, 1, 2, 2, 14, 16, BlockId.RED_SANDSTONE);
    for (let y = 3; y <= 5; y += 1) set(0, y, 15, BlockId.BLACK_MARBLE);
    set(0, 6, 15, BlockId.SAND);
    for (let z = -10; z <= 24; z += 2) {
      set(-17, 1, z, BlockId.LEAVES);
      set(17, 1, z, BlockId.LEAVES);
    }
    for (let x = -14; x <= 14; x += 4) {
      for (const z of [-11, 22]) {
        set(x, 1, z, BlockId.RED_SANDSTONE);
        set(x, 2, z, BlockId.BLACK_MARBLE);
        set(x, 3, z, BlockId.WHITE_MARBLE);
      }
    }
  },
};
