import type { PresetDefinition } from "../../content/types/catalog";
import { BlockId, type BlockIdValue } from "../../engine/world/blocks";
import { GROUND_LEVEL, VoxelWorld } from "../../engine/world/VoxelWorld";
import { geoToBlock } from "./projection";
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

function isNode(element: OverpassResponse["elements"][number]): element is OsmNode {
  return element.type === "node" && "lat" in element && "lon" in element;
}

function isWay(element: OverpassResponse["elements"][number]): element is OsmWay {
  return element.type === "way" && "nodes" in element;
}

function chooseBuildingBlock(tags: Record<string, string>): BlockIdValue {
  const material = `${tags.material ?? ""} ${tags["building:material"] ?? ""}`.toLowerCase();
  if (material.includes("brick")) return BlockId.BRICK;
  if (material.includes("sandstone")) return BlockId.RED_SANDSTONE;
  if (material.includes("glass")) return BlockId.GLASS;
  return BlockId.CONCRETE;
}

function roadRadius(highway: string): number {
  if (["motorway", "trunk"].includes(highway)) return 3;
  if (["primary", "secondary"].includes(highway)) return 2;
  if (["footway", "path", "pedestrian", "steps"].includes(highway)) return 0;
  return 1;
}

function withinLimit(x: number, z: number, limit: number): boolean {
  return Math.abs(x) <= limit && Math.abs(z) <= limit;
}

function fillPolygon(
  polygon: Array<{ x: number; z: number }>,
  limit: number,
  visit: (x: number, z: number) => void,
): void {
  if (polygon.length < 3) return;
  const bounds = polygonBounds(polygon);
  const minX = Math.max(-limit, Math.floor(bounds.minX));
  const maxX = Math.min(limit, Math.ceil(bounds.maxX));
  const minZ = Math.max(-limit, Math.floor(bounds.minZ));
  const maxZ = Math.min(limit, Math.ceil(bounds.maxZ));
  if (minX > maxX || minZ > maxZ || (maxX - minX) * (maxZ - minZ) > 12_000) return;
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPolygon({ x, z }, polygon)) visit(x, z);
    }
  }
}

export async function generatePresetWorld(
  world: VoxelWorld,
  preset: PresetDefinition,
  onProgress: ProgressCallback = () => undefined,
): Promise<WorldGenerationStats> {
  const stats: WorldGenerationStats = { nodes: 0, roads: 0, buildings: 0, parks: 0, water: 0, landmarks: 0 };
  const limit = preset.radiusChunks * 16 - 2;
  onProgress({ stage: "Preparing voxel terrain", progress: 0.05 });
  world.generateFlat(preset.radiusChunks);

  if (preset.dataUrl) {
    onProgress({ stage: "Loading cached OpenStreetMap data", progress: 0.12 });
    const response = await fetch(preset.dataUrl);
    if (!response.ok) throw new Error(`Could not load ${preset.name} map data (${response.status})`);
    const osm = await response.json() as OverpassResponse;
    const nodes = new Map<number, OsmNode>();
    for (const element of osm.elements) {
      if (isNode(element)) nodes.set(element.id, element);
    }
    stats.nodes = nodes.size;
    const ways = osm.elements.filter(isWay);

    const polygonFor = (way: OsmWay) => way.nodes
      .map((id) => nodes.get(id))
      .filter((node): node is OsmNode => Boolean(node))
      .map((node) => geoToBlock({ lat: node.lat, lon: node.lon }, preset.origin));

    const landmarkAnchors = preset.landmarks.map((landmark) => ({
      definition: landmark,
      position: geoToBlock(landmark.anchor, preset.origin),
      radiusBlocks: landmark.suppressRadiusMetres / 3,
    }));
    const suppressed = (polygon: Array<{ x: number; z: number }>) => {
      if (!polygon.length) return false;
      const centre = polygon.reduce((sum, point) => ({ x: sum.x + point.x, z: sum.z + point.z }), { x: 0, z: 0 });
      centre.x /= polygon.length;
      centre.z /= polygon.length;
      return landmarkAnchors.some((landmark) => Math.hypot(centre.x - landmark.position.x, centre.z - landmark.position.z) < landmark.radiusBlocks);
    };

    onProgress({ stage: "Drawing parks and water", progress: 0.28 });
    for (const way of ways) {
      const tags = way.tags ?? {};
      const polygon = polygonFor(way);
      if (tags.natural === "water" || tags.waterway || tags.water) {
        fillPolygon(polygon, limit, (x, z) => world.setBlockRaw(x, GROUND_LEVEL, z, BlockId.WATER));
        stats.water += 1;
      } else if (["park", "garden", "recreation_ground"].includes(tags.leisure ?? "")) {
        fillPolygon(polygon, limit, (x, z) => {
          world.setBlockRaw(x, GROUND_LEVEL, z, BlockId.GRASS);
          const seed = Math.abs((x * 73856093) ^ (z * 19349663));
          if (seed % 97 === 0) {
            for (let y = 1; y <= 3; y += 1) world.setBlockRaw(x, GROUND_LEVEL + y, z, BlockId.WOOD);
            for (let dx = -1; dx <= 1; dx += 1) {
              for (let dz = -1; dz <= 1; dz += 1) {
                world.setBlockRaw(x + dx, GROUND_LEVEL + 4, z + dz, BlockId.LEAVES);
              }
            }
          }
        });
        stats.parks += 1;
      }
    }

    onProgress({ stage: "Rasterizing real roads", progress: 0.46 });
    for (const way of ways) {
      const tags = way.tags ?? {};
      if (!tags.highway) continue;
      const points = polygonFor(way);
      const radius = roadRadius(tags.highway);
      for (let index = 1; index < points.length; index += 1) {
        const start = points[index - 1];
        const end = points[index];
        if (!start || !end) continue;
        for (const point of rasterLine(start, end)) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            for (let dz = -radius; dz <= radius; dz += 1) {
              if (withinLimit(point.x + dx, point.z + dz, limit)) {
                world.setBlockRaw(point.x + dx, GROUND_LEVEL, point.z + dz, BlockId.ROAD);
              }
            }
          }
        }
      }
      stats.roads += 1;
    }

    onProgress({ stage: "Extruding building footprints", progress: 0.68 });
    for (const way of ways) {
      const tags = way.tags ?? {};
      if (!tags.building) continue;
      const polygon = polygonFor(way);
      if (polygon.length < 3 || suppressed(polygon)) continue;
      const levels = Number.parseFloat(tags["building:levels"] ?? "");
      const height = Math.max(2, Math.min(14, Number.isFinite(levels) ? Math.round(levels) : tags.building === "house" ? 2 : 4));
      const block = chooseBuildingBlock(tags);

      for (let index = 1; index < polygon.length; index += 1) {
        const start = polygon[index - 1];
        const end = polygon[index];
        if (!start || !end) continue;
        for (const point of rasterLine(start, end)) {
          if (!withinLimit(point.x, point.z, limit)) continue;
          for (let y = 1; y <= height; y += 1) {
            const window = block !== BlockId.GLASS && y % 3 === 2 && (Math.abs(point.x + point.z) % 4 === 0);
            world.setBlockRaw(point.x, GROUND_LEVEL + y, point.z, window ? BlockId.GLASS : block);
          }
        }
      }
      fillPolygon(polygon, limit, (x, z) => world.setBlockRaw(x, GROUND_LEVEL + height, z, block));
      stats.buildings += 1;
    }
  }

  onProgress({ stage: "Building landmark voxels", progress: 0.9 });
  for (const landmark of preset.landmarks) {
    const position = geoToBlock(landmark.anchor, preset.origin);
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
