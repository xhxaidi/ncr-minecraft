import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CITY_CATALOG, allPresets, getPreset } from "../../src/content/catalog";
import { indiaGate } from "../../src/content/cities/delhi/landmarks/indiaGate";
import { qutubMinar } from "../../src/content/cities/delhi/landmarks/qutubMinar";
import { BlockId } from "../../src/engine/world/blocks";
import { GROUND_LEVEL, VoxelWorld } from "../../src/engine/world/VoxelWorld";
import { geoToBlock } from "../../src/geo/osm/projection";
import { pointInPolygon, rasterLine } from "../../src/geo/osm/raster";
import {
  buildingHeightMetres,
  chooseBuildingBlock,
  generatePresetWorld,
  hiddenFromSurface,
  roadHalfWidthMetres,
  stitchOuterRings,
} from "../../src/geo/osm/generateWorld";
import type { OsmRelation, OsmWay } from "../../src/geo/osm/types";

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

  it("scales projection with per-preset block size", () => {
    const origin = { lat: 28.6328, lon: 77.2197 };
    const east = { lat: 28.6328, lon: 77.2297 };
    const coarse = geoToBlock(east, origin, 3);
    const fine = geoToBlock(east, origin, 2);
    expect(fine.x).toBeGreaterThan(coarse.x);
    expect(Math.round(fine.x / coarse.x)).toBe(2);
  });
});

describe("osm interpretation", () => {
  it("maps building tags to sensible blocks and heights", () => {
    expect(chooseBuildingBlock({ "building:colour": "white" })).toBe(BlockId.PLASTER);
    expect(chooseBuildingBlock({ "building:material": "brick" })).toBe(BlockId.BRICK);
    expect(chooseBuildingBlock({ building: "office" })).toBe(BlockId.CONCRETE);
    expect(buildingHeightMetres({ height: "63" })).toBe(63);
    expect(buildingHeightMetres({ "building:levels": "3" })).toBeCloseTo(10.6);
    expect(buildingHeightMetres({ building: "house" })).toBe(6);
  });

  it("keeps tunnels and underground levels off the surface", () => {
    expect(hiddenFromSurface({ tunnel: "yes" })).toBe(true);
    expect(hiddenFromSurface({ level: "-1" })).toBe(true);
    expect(hiddenFromSurface({ layer: "-2" })).toBe(true);
    expect(hiddenFromSurface({ highway: "primary" })).toBe(false);
    expect(roadHalfWidthMetres("primary")).toBeGreaterThan(roadHalfWidthMetres("service"));
  });

  it("stitches multipolygon outer ways into closed rings", () => {
    const ways = new Map<number, OsmWay>([
      [1, { type: "way", id: 1, nodes: [10, 11, 12] }],
      [2, { type: "way", id: 2, nodes: [12, 13, 10] }],
    ]);
    const relation: OsmRelation = {
      type: "relation",
      id: 99,
      members: [
        { type: "way", ref: 1, role: "outer" },
        { type: "way", ref: 2, role: "outer" },
      ],
      tags: { building: "yes" },
    };
    const rings = stitchOuterRings(relation, ways);
    expect(rings).toHaveLength(1);
    expect(rings[0]?.[0]).toBe(rings[0]?.[rings[0].length - 1]);
  });
});

describe("connaught place world", () => {
  it("generates the fine-grained preset with flag, trees and colonnades", async () => {
    const preset = getPreset("connaught-place");
    expect(preset.blockMetres).toBe(2);
    const file = new URL(`../../public${preset.dataUrl}`, import.meta.url);
    const payload = await readFile(file, "utf8");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(payload)) as typeof fetch;
    try {
      const world = new VoxelWorld();
      const stats = await generatePresetWorld(world, preset);
      expect(stats.buildings).toBeGreaterThan(300);
      expect(stats.roads).toBeGreaterThan(200);
      expect(stats.trees).toBeGreaterThan(40);
      expect(stats.furniture).toBeGreaterThan(15);
      expect(stats.landmarks).toBe(1);
      // the 63m national flagpole in central park
      const flag = geoToBlock({ lat: 28.6320822, lon: 77.2194015 }, preset.origin, preset.blockMetres);
      expect(world.getBlock(flag.x, GROUND_LEVEL + 25, flag.z)).toBe(BlockId.METAL);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }, 30_000);
});

describe("landmark builders", () => {
  it("builds a mineable India Gate with a central opening", () => {
    const world = new VoxelWorld();
    world.generateFlat(3);
    indiaGate.build({ world, originX: 0, originZ: 0, groundY: GROUND_LEVEL, block: BlockId });
    expect(world.getBlock(7, GROUND_LEVEL + 10, 0)).not.toBe(BlockId.AIR);
    expect(world.getBlock(0, GROUND_LEVEL + 10, 0)).toBe(BlockId.AIR);
  });

  it("builds Qutub Minar through the generic landmark contract", async () => {
    const world = new VoxelWorld();
    const stats = await generatePresetWorld(world, getPreset("qutub-minar-lab"));
    expect(stats.landmarks).toBe(1);
    expect(world.getBlock(0, GROUND_LEVEL + 32, 0)).not.toBe(BlockId.AIR);
    expect(qutubMinar.id).toBe("qutub-minar");
  });
});
