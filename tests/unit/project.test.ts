import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CITY_CATALOG, allPresets, getPreset } from "../../src/content/catalog";
import { indiaGate } from "../../src/content/cities/delhi/landmarks/indiaGate";
import {
  INDIA_GATE_BOUNDS,
  INDIA_GATE_VOXEL_COUNT,
} from "../../src/content/cities/delhi/landmarks/data/indiaGateVoxels.generated";
import { qutubMinar } from "../../src/content/cities/delhi/landmarks/qutubMinar";
import { BlockId } from "../../src/engine/world/blocks";
import { GROUND_LEVEL, VoxelWorld } from "../../src/engine/world/VoxelWorld";
import { geoToBlock } from "../../src/geo/osm/projection";
import { pointInPolygon, rasterLine } from "../../src/geo/osm/raster";
import { generatePresetWorld } from "../../src/geo/osm/generateWorld";

describe("city catalog", () => {
  it("uses unique city and preset ids", () => {
    expect(new Set(CITY_CATALOG.map((city) => city.id)).size).toBe(CITY_CATALOG.length);
    const presets = allPresets();
    expect(new Set(presets.map((preset) => preset.id)).size).toBe(presets.length);
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

describe("landmark builders", () => {
  it("builds the source-modelled India Gate with accurate proportions and a clear reveal", () => {
    const world = new VoxelWorld();
    world.generateFlat(3);
    world.setBlockRaw(20, GROUND_LEVEL + 4, 20, BlockId.WOOD);
    indiaGate.build({ world, originX: 0, originZ: 0, groundY: GROUND_LEVEL, block: BlockId });
    expect(INDIA_GATE_VOXEL_COUNT).toBeGreaterThan(9_000);
    expect(INDIA_GATE_BOUNDS).toMatchObject({ minX: -16, maxX: 16, maxY: 46 });
    expect(world.getBlock(10, GROUND_LEVEL + 10, 3)).toBe(BlockId.SAND);
    expect(world.getBlock(0, GROUND_LEVEL + 10, 0)).toBe(BlockId.AIR);
    expect(world.getBlock(0, GROUND_LEVEL + 47, 0)).toBe(BlockId.SAND);
    expect(world.getBlock(20, GROUND_LEVEL + 4, 20)).toBe(BlockId.AIR);
    expect(world.getBlock(0, GROUND_LEVEL, 25)).toBe(BlockId.SAND);
  });

  it("builds Qutub Minar through the generic landmark contract", async () => {
    const world = new VoxelWorld();
    const stats = await generatePresetWorld(world, getPreset("qutub-minar-lab"));
    expect(stats.landmarks).toBe(1);
    expect(world.getBlock(0, GROUND_LEVEL + 32, 0)).not.toBe(BlockId.AIR);
    expect(qutubMinar.id).toBe("qutub-minar");
  });
});
