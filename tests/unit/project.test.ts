import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CITY_CATALOG, allPresets, getPreset } from "../../src/content/catalog";
import { indiaGate } from "../../src/content/cities/delhi/landmarks/indiaGate";
import { qutubMinar } from "../../src/content/cities/delhi/landmarks/qutubMinar";
import { BlockId, cycleHotbar } from "../../src/engine/world/blocks";
import { DoubleTapTracker, approach } from "../../src/engine/physics/PlayerController";
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

describe("player physics helpers", () => {
  it("approaches a target and converges", () => {
    expect(approach(0, 10, 12, 0)).toBe(0);
    expect(approach(0, 10, 12, 1)).toBeGreaterThan(9.999);
    expect(approach(5, 5, 12, 0.016)).toBe(5);
  });

  it("is frame-rate independent", () => {
    const single = approach(0, 10, 12, 0.032);
    const halfStep = approach(0, 10, 12, 0.016);
    const double = approach(halfStep, 10, 12, 0.016);
    expect(double).toBeCloseTo(single, 9);
  });

  it("detects double taps within the window only", () => {
    const tracker = new DoubleTapTracker(300);
    expect(tracker.tap(0)).toBe(false);
    expect(tracker.tap(250)).toBe(true);
    expect(tracker.tap(300)).toBe(false);
    expect(tracker.tap(700)).toBe(false);
    expect(tracker.tap(950)).toBe(true);
  });

  it("cycles the hotbar with wraparound", () => {
    expect(cycleHotbar(0, -1, 9)).toBe(8);
    expect(cycleHotbar(8, 1, 9)).toBe(0);
    expect(cycleHotbar(3, 1, 9)).toBe(4);
  });
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
