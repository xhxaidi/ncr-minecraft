import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CITY_CATALOG, allPresets, getPreset } from "../../src/content/catalog";
import { jamaMasjid } from "../../src/content/cities/delhi/landmarks/jamaMasjid";
import { BlockId } from "../../src/engine/world/blocks";
import { GROUND_LEVEL, VoxelWorld } from "../../src/engine/world/VoxelWorld";
import { geoToBlock } from "../../src/geo/osm/projection";
import { pointInPolygon, rasterLine } from "../../src/geo/osm/raster";

describe("city catalog", () => {
  it("uses unique ids and leads with the Jama Masjid demo as the only landmark", () => {
    expect(new Set(CITY_CATALOG.map((city) => city.id)).size).toBe(CITY_CATALOG.length);
    const presets = allPresets();
    expect(new Set(presets.map((preset) => preset.id)).size).toBe(presets.length);
    expect(presets[0]?.id).toBe("jama-masjid");
    expect(presets.flatMap((preset) => preset.landmarks).map((landmark) => landmark.id)).toEqual(["jama-masjid"]);
    expect(getPreset("cyber-city").cityId).toBe("gurugram");
  });

  it("references cached data that ships with the build", async () => {
    for (const preset of allPresets().filter((candidate) => candidate.dataUrl)) {
      const file = new URL(`../../public${preset.dataUrl}`, import.meta.url);
      const data = JSON.parse(await readFile(file, "utf8")) as { elements?: unknown[] };
      expect(data.elements?.length).toBeGreaterThan(100);
    }
  });
});

describe("geospatial rasterization", () => {
  it("projects an origin to zero", () => {
    const origin = { lat: 28.6129, lon: 77.2295 };
    expect(geoToBlock(origin, origin)).toEqual({ x: 0, z: 0 });
  });

  it("rasterizes lines and polygons deterministically", () => {
    expect(rasterLine({ x: 0, z: 0 }, { x: 3, z: 0 })).toHaveLength(4);
    const square = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 }];
    expect(pointInPolygon({ x: 2, z: 2 }, square)).toBe(true);
    expect(pointInPolygon({ x: 8, z: 2 }, square)).toBe(false);
  });
});

describe("jama masjid landmark", () => {
  it("builds a walkable mosque with marble domes and an open east gate", () => {
    const world = new VoxelWorld();
    world.generateFlat(3);
    jamaMasjid.build({ world, originX: 0, originZ: 0, groundY: GROUND_LEVEL, block: BlockId });
    // Central dome rises in marble above the prayer hall roof.
    expect(world.getBlock(-14, GROUND_LEVEL + 10, 0)).toBe(BlockId.WHITE_MARBLE);
    // The east gate arch stays walkable on the bazaar axis.
    expect(world.getBlock(17, GROUND_LEVEL + 2, 0)).toBe(BlockId.AIR);
    expect(world.getBlock(17, GROUND_LEVEL + 3, 0)).toBe(BlockId.AIR);
    // Courtyard paving sits on the plinth with open air above.
    expect(world.getBlock(6, GROUND_LEVEL + 1, 6)).not.toBe(BlockId.AIR);
    expect(world.getBlock(6, GROUND_LEVEL + 2, 6)).toBe(BlockId.AIR);
    // Minarets top out above the domes.
    expect(world.getBlock(-11, GROUND_LEVEL + 15, 12)).toBe(BlockId.WHITE_MARBLE);
  });
});
