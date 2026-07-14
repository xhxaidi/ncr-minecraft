// generic osm -> voxel pipeline: terrain, areas, roads, rail, buildings, landmarks
import type { BuildingDetail, PresetDefinition } from "../../content/types/catalog";
import { BlockId, type BlockIdValue } from "../../engine/world/blocks";
import { CHUNK_HEIGHT, GROUND_LEVEL, VoxelWorld } from "../../engine/world/VoxelWorld";
import { BLOCK_METRES, geoToBlock } from "./projection";
import { pointInPolygon, polygonBounds, rasterLine } from "./raster";
import type { OsmNode, OsmWay, OverpassResponse } from "./types";

export type WorldGenerationProgress = {
  stage: string;
  progress: number;
};

export type WorldGenerationStats = {
  nodes: number;
  roads: number;
  buildings: number;
  parks: number;
  water: number;
  landmarks: number;
};

type ProgressCallback = (update: WorldGenerationProgress) => void;

const MAX_BUILD_HEIGHT = CHUNK_HEIGHT - GROUND_LEVEL - 2;

const MATERIAL_BLOCKS: Record<NonNullable<BuildingDetail["material"]>, BlockIdValue> = {
  glass: BlockId.DARK_GLASS,
  concrete: BlockId.CONCRETE,
  brick: BlockId.BRICK,
  sandstone: BlockId.RED_SANDSTONE,
  marble: BlockId.WHITE_MARBLE,
  metal: BlockId.METAL,
};

function isNode(element: OverpassResponse["elements"][number]): element is OsmNode {
  return element.type === "node" && "lat" in element && "lon" in element;
}

function isWay(element: OverpassResponse["elements"][number]): element is OsmWay {
  return element.type === "way" && "nodes" in element;
}

function chooseBuildingBlock(tags: Record<string, string>, detail?: BuildingDetail): BlockIdValue {
  if (detail?.material) return MATERIAL_BLOCKS[detail.material];
  const material = `${tags.material ?? ""} ${tags["building:material"] ?? ""}`.toLowerCase();
  if (material.includes("brick")) return BlockId.BRICK;
  if (material.includes("sandstone")) return BlockId.RED_SANDSTONE;
  if (material.includes("glass")) return BlockId.DARK_GLASS;
  if (material.includes("marble")) return BlockId.WHITE_MARBLE;
  if (["office", "commercial"].includes(tags.building ?? "")) return BlockId.DARK_GLASS;
  return BlockId.CONCRETE;
}

function buildingHeightBlocks(tags: Record<string, string>, detail: BuildingDetail | undefined, scale: number): number {
  const taggedHeight = Number.parseFloat((tags.height ?? "").replace("m", ""));
  const taggedLevels = Number.parseFloat(tags["building:levels"] ?? "");
  const levels = detail?.levels ?? (Number.isFinite(taggedLevels) ? taggedLevels : undefined);
  const metres = detail?.heightMetres
    ?? (Number.isFinite(taggedHeight) ? taggedHeight : undefined)
    ?? (levels !== undefined ? levels * 3.2 : undefined)
    ?? (tags.building === "house" ? 6 : ["office", "commercial"].includes(tags.building ?? "") ? 24 : 12);
  return Math.max(2, Math.min(MAX_BUILD_HEIGHT, Math.round(metres / scale)));
}

function roadWidthMetres(tags: Record<string, string>): number {
  const lanes = Number.parseFloat(tags.lanes ?? "");
  if (Number.isFinite(lanes) && lanes > 0) return lanes * 3.5;
  const highway = tags.highway ?? "";
  if (["motorway", "trunk"].includes(highway)) return 15;
  if (highway === "primary") return 11;
  if (highway === "secondary") return 9;
  if (highway === "tertiary") return 7;
  if (["footway", "path", "pedestrian", "steps", "cycleway"].includes(highway)) return 2;
  return 5;
}

function isPedestrian(highway: string): boolean {
  return ["footway", "path", "pedestrian", "steps", "cycleway"].includes(highway);
}

function withinLimit(x: number, z: number, limit: number): boolean {
  return Math.abs(x) <= limit && Math.abs(z) <= limit;
}

function fillPolygon(
  polygon: Array<{ x: number; z: number }>,
  limit: number,
  areaCap: number,
  visit: (x: number, z: number) => void,
): void {
  if (polygon.length < 3) return;
  const bounds = polygonBounds(polygon);
  const minX = Math.max(-limit, Math.floor(bounds.minX));
  const maxX = Math.min(limit, Math.ceil(bounds.maxX));
  const minZ = Math.max(-limit, Math.floor(bounds.minZ));
  const maxZ = Math.min(limit, Math.ceil(bounds.maxZ));
  if (minX > maxX || minZ > maxZ || (maxX - minX) * (maxZ - minZ) > areaCap) return;
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPolygon({ x, z }, polygon)) visit(x, z);
    }
  }
}

function plantTree(world: VoxelWorld, x: number, z: number, scale: number): void {
  const trunk = scale <= 2 ? 4 : 3;
  for (let y = 1; y <= trunk; y += 1) world.setBlockRaw(x, GROUND_LEVEL + y, z, BlockId.WOOD);
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      world.setBlockRaw(x + dx, GROUND_LEVEL + trunk + 1, z + dz, BlockId.LEAVES);
      if (Math.abs(dx) + Math.abs(dz) < 2) world.setBlockRaw(x + dx, GROUND_LEVEL + trunk + 2, z + dz, BlockId.LEAVES);
    }
  }
}

function buildFountain(world: VoxelWorld, x: number, z: number, scale: number): void {
  const radius = Math.max(2, Math.round(4.5 / scale));
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      const distance = Math.hypot(dx, dz);
      if (distance > radius) continue;
      const block = distance > radius - 1 ? BlockId.STONE : BlockId.WATER;
      world.setBlockRaw(x + dx, GROUND_LEVEL + 1, z + dz, block);
    }
  }
  world.setBlockRaw(x, GROUND_LEVEL + 2, z, BlockId.WHITE_MARBLE);
  world.setBlockRaw(x, GROUND_LEVEL + 3, z, BlockId.WATER);
}

export async function generatePresetWorld(
  world: VoxelWorld,
  preset: PresetDefinition,
  onProgress: ProgressCallback = () => undefined,
): Promise<WorldGenerationStats> {
  const stats: WorldGenerationStats = { nodes: 0, roads: 0, buildings: 0, parks: 0, water: 0, landmarks: 0 };
  const scale = preset.blockMetres ?? BLOCK_METRES;
  const limit = preset.radiusChunks * 16 - 2;
  const areaCap = Math.round(12_000 * (BLOCK_METRES / scale) ** 2);
  onProgress({ stage: "Preparing voxel terrain", progress: 0.05 });
  world.generateFlat(preset.radiusChunks);

  if (preset.dataUrl) {
    onProgress({ stage: "Loading cached OpenStreetMap data", progress: 0.1 });
    const response = await fetch(preset.dataUrl);
    if (!response.ok) throw new Error(`Could not load ${preset.name} map data (${response.status})`);
    const osm = await response.json() as OverpassResponse;
    const nodes = new Map<number, OsmNode>();
    for (const element of osm.elements) {
      if (isNode(element)) nodes.set(element.id, element);
    }
    stats.nodes = nodes.size;
    const ways = osm.elements.filter(isWay);

    const project = (point: { lat: number; lon: number }) => geoToBlock(point, preset.origin, scale);
    const polygonFor = (way: OsmWay) => way.nodes
      .map((id) => nodes.get(id))
      .filter((node): node is OsmNode => Boolean(node))
      .map((node) => project({ lat: node.lat, lon: node.lon }));

    const landmarkAnchors = preset.landmarks.map((landmark) => ({
      position: project(landmark.anchor),
      radiusBlocks: landmark.suppressRadiusMetres / scale,
    }));
    const suppressed = (polygon: Array<{ x: number; z: number }>) => {
      if (!polygon.length) return false;
      const centre = polygon.reduce((sum, point) => ({ x: sum.x + point.x, z: sum.z + point.z }), { x: 0, z: 0 });
      centre.x /= polygon.length;
      centre.z /= polygon.length;
      return landmarkAnchors.some((landmark) => Math.hypot(centre.x - landmark.position.x, centre.z - landmark.position.z) < landmark.radiusBlocks);
    };

    onProgress({ stage: "Drawing parks, water and parking", progress: 0.22 });
    for (const way of ways) {
      const tags = way.tags ?? {};
      const polygon = polygonFor(way);
      if (tags.natural === "water" || tags.waterway || tags.water) {
        fillPolygon(polygon, limit, areaCap, (x, z) => world.setBlockRaw(x, GROUND_LEVEL, z, BlockId.WATER));
        stats.water += 1;
      } else if (
        ["park", "garden", "recreation_ground", "pitch"].includes(tags.leisure ?? "")
        || ["grass", "meadow", "village_green", "recreation_ground"].includes(tags.landuse ?? "")
        || ["grassland", "scrub", "wood"].includes(tags.natural ?? "")
      ) {
        fillPolygon(polygon, limit, areaCap, (x, z) => {
          world.setBlockRaw(x, GROUND_LEVEL, z, BlockId.GRASS);
          const seed = Math.abs((x * 73856093) ^ (z * 19349663));
          if (seed % 97 === 0) plantTree(world, x, z, scale);
        });
        stats.parks += 1;
      } else if (tags.amenity === "parking" && tags.parking !== "underground") {
        fillPolygon(polygon, limit, areaCap, (x, z) => world.setBlockRaw(x, GROUND_LEVEL, z, BlockId.ROAD));
      }
    }

    onProgress({ stage: "Rasterizing real roads and footpaths", progress: 0.38 });
    for (const way of ways) {
      const tags = way.tags ?? {};
      if (!tags.highway || tags.area === "yes") continue;
      const points = polygonFor(way);
      const pedestrian = isPedestrian(tags.highway);
      const surface = pedestrian ? BlockId.PAVEMENT : BlockId.ROAD;
      const radius = Math.min(7, Math.max(0, Math.round(roadWidthMetres(tags) / scale / 2)));
      for (let index = 1; index < points.length; index += 1) {
        const start = points[index - 1];
        const end = points[index];
        if (!start || !end) continue;
        for (const point of rasterLine(start, end)) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            for (let dz = -radius; dz <= radius; dz += 1) {
              if (!withinLimit(point.x + dx, point.z + dz, limit)) continue;
              // footpaths never overwrite carriageways
              if (pedestrian && world.getBlock(point.x + dx, GROUND_LEVEL, point.z + dz) === BlockId.ROAD) continue;
              world.setBlockRaw(point.x + dx, GROUND_LEVEL, point.z + dz, surface);
            }
          }
        }
      }
      stats.roads += 1;
    }

    onProgress({ stage: "Raising the elevated metro", progress: 0.5 });
    for (const way of ways) {
      const tags = way.tags ?? {};
      if (!["subway", "light_rail", "monorail", "rail"].includes(tags.railway ?? "") || !tags.bridge) continue;
      const deckY = GROUND_LEVEL + Math.max(4, Math.round(11 / scale));
      if (deckY >= CHUNK_HEIGHT - 2) continue;
      const points = polygonFor(way);
      let step = 0;
      for (let index = 1; index < points.length; index += 1) {
        const start = points[index - 1];
        const end = points[index];
        if (!start || !end) continue;
        for (const point of rasterLine(start, end)) {
          if (!withinLimit(point.x, point.z, limit)) continue;
          for (let dx = -1; dx <= 1; dx += 1) {
            for (let dz = -1; dz <= 1; dz += 1) {
              world.setBlockRaw(point.x + dx, deckY, point.z + dz, BlockId.CONCRETE);
            }
          }
          world.setBlockRaw(point.x, deckY + 1, point.z, BlockId.METAL);
          if (step % 9 === 0) {
            for (let y = GROUND_LEVEL + 1; y < deckY; y += 1) world.setBlockRaw(point.x, y, point.z, BlockId.CONCRETE);
          }
          step += 1;
        }
      }
    }

    onProgress({ stage: "Placing fences, trees and fountains", progress: 0.58 });
    for (const way of ways) {
      const tags = way.tags ?? {};
      if (!tags.barrier) continue;
      const block = tags.barrier === "hedge" ? BlockId.LEAVES : tags.barrier === "wall" ? BlockId.STONE : BlockId.METAL;
      const points = polygonFor(way);
      for (let index = 1; index < points.length; index += 1) {
        const start = points[index - 1];
        const end = points[index];
        if (!start || !end) continue;
        for (const point of rasterLine(start, end)) {
          if (withinLimit(point.x, point.z, limit)) world.setBlockRaw(point.x, GROUND_LEVEL + 1, point.z, block);
        }
      }
    }
    for (const node of nodes.values()) {
      const tags = node.tags ?? {};
      if (!tags.natural && !tags.amenity) continue;
      const point = project({ lat: node.lat, lon: node.lon });
      if (!withinLimit(point.x, point.z, limit)) continue;
      if (tags.natural === "tree") plantTree(world, point.x, point.z, scale);
      if (tags.amenity === "fountain") buildFountain(world, point.x, point.z, scale);
    }

    onProgress({ stage: "Extruding building footprints", progress: 0.68 });
    for (const way of ways) {
      const tags = way.tags ?? {};
      if (!tags.building) continue;
      const polygon = polygonFor(way);
      if (polygon.length < 3 || suppressed(polygon)) continue;
      const detail = preset.buildingDetails?.[way.id];
      const height = buildingHeightBlocks(tags, detail, scale);
      const block = chooseBuildingBlock(tags, detail);
      const storey = Math.max(2, Math.round(3.2 / scale));

      for (let index = 1; index < polygon.length; index += 1) {
        const start = polygon[index - 1];
        const end = polygon[index];
        if (!start || !end) continue;
        for (const point of rasterLine(start, end)) {
          if (!withinLimit(point.x, point.z, limit)) continue;
          for (let y = 1; y <= height; y += 1) {
            // glass towers get metal spandrels between floors, opaque walls get window bands
            let facade: BlockIdValue = block;
            if (block === BlockId.DARK_GLASS) {
              if (y % storey === 0) facade = BlockId.METAL;
            } else if (y % storey === storey - 1 && (Math.abs(point.x + point.z) % 4) < 2) {
              facade = BlockId.GLASS;
            }
            world.setBlockRaw(point.x, GROUND_LEVEL + y, point.z, facade);
          }
        }
      }
      const roof = block === BlockId.DARK_GLASS ? BlockId.CONCRETE : block;
      fillPolygon(polygon, limit, areaCap, (x, z) => world.setBlockRaw(x, GROUND_LEVEL + height, z, roof));
      stats.buildings += 1;
    }
  }

  onProgress({ stage: "Building landmark voxels", progress: 0.9 });
  for (const landmark of preset.landmarks) {
    const position = geoToBlock(landmark.anchor, preset.origin, scale);
    landmark.build({
      world,
      originX: position.x,
      originZ: position.z,
      groundY: GROUND_LEVEL,
      block: BlockId,
    });
    stats.landmarks += 1;
  }
  world.markAllDirty();
  onProgress({ stage: "World ready", progress: 1 });
  return stats;
}
