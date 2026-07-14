// generic osm -> voxel pipeline: areas, roads, paths, buildings, greenery and street furniture
import type { BuildingStyle, PresetDefinition } from "../../content/types/catalog";
import { BlockId, type BlockIdValue } from "../../engine/world/blocks";
import { GROUND_LEVEL, VoxelWorld } from "../../engine/world/VoxelWorld";
import { BLOCK_METRES, geoToBlock, type BlockPoint } from "./projection";
import { pointInPolygon, polygonBounds, rasterLine } from "./raster";
import type { OsmNode, OsmRelation, OsmWay, OverpassResponse } from "./types";

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
  trees: number;
  furniture: number;
  landmarks: number;
};

type ProgressCallback = (update: WorldGenerationProgress) => void;

type Feature = {
  tags: Record<string, string>;
  polygon: BlockPoint[];
};

function isNode(element: OverpassResponse["elements"][number]): element is OsmNode {
  return element.type === "node" && "lat" in element && "lon" in element;
}

function isWay(element: OverpassResponse["elements"][number]): element is OsmWay {
  return element.type === "way" && "nodes" in element;
}

function isRelation(element: OverpassResponse["elements"][number]): element is OsmRelation {
  return element.type === "relation" && "members" in element;
}

function withinLimit(x: number, z: number, limit: number): boolean {
  return Math.abs(x) <= limit && Math.abs(z) <= limit;
}

// tunnels, underground levels and indoor mapping should not appear on the surface
export function hiddenFromSurface(tags: Record<string, string>): boolean {
  if (tags.tunnel && tags.tunnel !== "no") return true;
  if (tags.covered === "yes" || tags.indoor === "yes" || tags.location === "underground") return true;
  const layer = Number.parseInt(tags.layer ?? "", 10);
  if (Number.isFinite(layer) && layer < 0) return true;
  const level = Number.parseFloat(tags.level ?? "");
  if (Number.isFinite(level) && level < 0) return true;
  return false;
}

export function chooseBuildingBlock(tags: Record<string, string>): BlockIdValue {
  const colour = `${tags["building:colour"] ?? tags.colour ?? ""}`.toLowerCase();
  if (/white|cream|beige|ivory|^#f/.test(colour)) return BlockId.PLASTER;
  if (/red|maroon/.test(colour)) return BlockId.BRICK;
  if (/yellow|sand|tan/.test(colour)) return BlockId.SAND;
  if (/grey|gray|silver/.test(colour)) return BlockId.CONCRETE;
  if (/blue|glass/.test(colour)) return BlockId.GLASS;
  const material = `${tags.material ?? ""} ${tags["building:material"] ?? ""}`.toLowerCase();
  if (material.includes("brick")) return BlockId.BRICK;
  if (material.includes("sandstone")) return BlockId.RED_SANDSTONE;
  if (material.includes("marble")) return BlockId.WHITE_MARBLE;
  if (material.includes("plaster")) return BlockId.PLASTER;
  if (material.includes("glass")) return BlockId.GLASS;
  if (tags.building === "house" || tags.building === "residential") return BlockId.BRICK;
  return BlockId.CONCRETE;
}

export function buildingHeightMetres(tags: Record<string, string>): number {
  const explicit = Number.parseFloat(`${tags.height ?? ""}`.replace(/[^\d.]/g, ""));
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const levels = Number.parseFloat(tags["building:levels"] ?? "");
  if (Number.isFinite(levels) && levels > 0) return levels * 3.2 + 1;
  if (tags.building === "house" || tags.building === "hut") return 6;
  if (tags.building === "retail" || tags.building === "roof") return 8;
  return 12;
}

export function roadHalfWidthMetres(highway: string): number {
  if (["motorway", "trunk"].includes(highway)) return 9;
  if (highway === "primary") return 7;
  if (highway === "secondary") return 6;
  if (highway === "tertiary") return 5;
  if (["residential", "unclassified", "living_street"].includes(highway)) return 3.5;
  if (highway === "service") return 2.5;
  return 3;
}

function pathHalfWidthMetres(highway: string): number {
  if (highway === "pedestrian") return 2.5;
  if (highway === "steps") return 1.5;
  return 1.2;
}

const PATH_HIGHWAYS = ["footway", "path", "cycleway", "steps", "pedestrian", "corridor"];

function fillPolygon(
  polygon: BlockPoint[],
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

// chains the outer ways of a multipolygon into closed node-id rings
export function stitchOuterRings(relation: OsmRelation, waysById: Map<number, OsmWay>): number[][] {
  const segments = relation.members
    .filter((member) => member.type === "way" && member.role !== "inner")
    .map((member) => waysById.get(member.ref)?.nodes)
    .filter((nodeIds): nodeIds is number[] => Boolean(nodeIds?.length))
    .map((nodeIds) => [...nodeIds]);
  const rings: number[][] = [];
  while (segments.length) {
    const ring = segments.pop();
    if (!ring) break;
    while (ring[0] !== ring[ring.length - 1]) {
      const end = ring[ring.length - 1];
      const index = segments.findIndex((segment) => segment[0] === end || segment[segment.length - 1] === end);
      if (index < 0) break;
      const [segment] = segments.splice(index, 1);
      if (!segment) break;
      if (segment[0] === end) ring.push(...segment.slice(1));
      else ring.push(...segment.reverse().slice(1));
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

export async function generatePresetWorld(
  world: VoxelWorld,
  preset: PresetDefinition,
  onProgress: ProgressCallback = () => undefined,
): Promise<WorldGenerationStats> {
  const stats: WorldGenerationStats = {
    nodes: 0, roads: 0, buildings: 0, parks: 0, water: 0, trees: 0, furniture: 0, landmarks: 0,
  };
  const scale = preset.blockMetres ?? BLOCK_METRES;
  const limit = preset.radiusChunks * 16 - 2;
  const areaCap = Math.round(12_000 * (BLOCK_METRES / scale) ** 2);
  const floorBlocks = Math.max(2, Math.round(3.2 / scale));
  const ground = GROUND_LEVEL;

  const setSurface = (x: number, z: number, block: BlockIdValue) => world.setBlockRaw(x, ground, z, block);
  const surfaceIs = (x: number, z: number, block: BlockIdValue) => world.getBlock(x, ground, z) === block;

  const buildTree = (x: number, z: number, heightMetres = 8) => {
    if (!withinLimit(x, z, limit)) return;
    const trunk = Math.min(6, Math.max(2, Math.round((heightMetres * 0.6) / scale)));
    for (let y = 1; y <= trunk; y += 1) world.setBlockRaw(x, ground + y, z, BlockId.WOOD);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        world.setBlockRaw(x + dx, ground + trunk, z + dz, BlockId.LEAVES);
        world.setBlockRaw(x + dx, ground + trunk + 1, z + dz, BlockId.LEAVES);
      }
    }
    world.setBlockRaw(x, ground + trunk + 2, z, BlockId.LEAVES);
    stats.trees += 1;
  };

  const buildLamp = (x: number, z: number) => {
    const pole = Math.max(2, Math.round(5 / scale));
    for (let y = 1; y <= pole; y += 1) world.setBlockRaw(x, ground + y, z, BlockId.METAL);
    world.setBlockRaw(x, ground + pole + 1, z, BlockId.LIGHT);
    stats.furniture += 1;
  };

  const buildMetroEntrance = (x: number, z: number) => {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = 0; dz <= 2; dz += 1) {
        setSurface(x + dx, z + dz, BlockId.PAVEMENT);
        if (dz === 2 || Math.abs(dx) === 1) {
          world.setBlockRaw(x + dx, ground + 1, z + dz, BlockId.CONCRETE);
          world.setBlockRaw(x + dx, ground + 2, z + dz, dz === 2 ? BlockId.CONCRETE : BlockId.GLASS);
        }
        world.setBlockRaw(x + dx, ground + 3, z + dz, BlockId.CHAKRA_BLUE);
      }
    }
    stats.furniture += 1;
  };

  const buildFountain = (x: number, z: number, radius: number) => {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        if (!withinLimit(x + dx, z + dz, limit)) continue;
        const distance = Math.hypot(dx, dz);
        if (distance > radius) continue;
        world.setBlockRaw(x + dx, ground + 1, z + dz, distance > radius - 1 ? BlockId.WHITE_MARBLE : BlockId.WATER);
      }
    }
    world.setBlockRaw(x, ground + 2, z, BlockId.WHITE_MARBLE);
    world.setBlockRaw(x, ground + 3, z, BlockId.WATER);
    stats.furniture += 1;
  };

  const buildFlagpole = (x: number, z: number, heightMetres: number) => {
    const pole = Math.min(44, Math.max(4, Math.round(heightMetres / scale)));
    for (let y = 1; y <= pole; y += 1) world.setBlockRaw(x, ground + y, z, BlockId.METAL);
    const width = Math.max(6, Math.round(pole * 0.45));
    const height = Math.max(3, Math.round(width * 0.66));
    const band = Math.max(1, Math.round(height / 3));
    for (let dy = 0; dy < band * 3; dy += 1) {
      const block = dy < band ? BlockId.SAFFRON : dy < band * 2 ? BlockId.WHITE_MARBLE : BlockId.FLAG_GREEN;
      for (let dx = 1; dx <= width; dx += 1) {
        world.setBlockRaw(x + dx, ground + pole - dy, z, block);
      }
    }
    // ashoka chakra on the white band
    const chakraY = ground + pole - band - Math.floor(band / 2);
    const chakraX = x + Math.ceil(width / 2);
    world.setBlockRaw(chakraX, chakraY, z, BlockId.CHAKRA_BLUE);
    if (band >= 3) {
      world.setBlockRaw(chakraX + 1, chakraY, z, BlockId.CHAKRA_BLUE);
      world.setBlockRaw(chakraX - 1, chakraY, z, BlockId.CHAKRA_BLUE);
      world.setBlockRaw(chakraX, chakraY + 1, z, BlockId.CHAKRA_BLUE);
      world.setBlockRaw(chakraX, chakraY - 1, z, BlockId.CHAKRA_BLUE);
    }
    stats.furniture += 1;
  };

  onProgress({ stage: "Preparing voxel terrain", progress: 0.04 });
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
    const waysById = new Map(ways.map((way) => [way.id, way]));
    const relations = osm.elements.filter(isRelation);

    const project = (nodeIds: number[]): BlockPoint[] => nodeIds
      .map((id) => nodes.get(id))
      .filter((node): node is OsmNode => Boolean(node))
      .map((node) => geoToBlock({ lat: node.lat, lon: node.lon }, preset.origin, scale));
    const polygonFor = (way: OsmWay) => project(way.nodes);

    // multipolygon relations become extra area/building features
    const relationFeatures: Feature[] = relations.flatMap((relation) => {
      const tags = relation.tags ?? {};
      if (!tags.building && !tags.leisure && !tags.natural && !tags.landuse && !tags.amenity) return [];
      return stitchOuterRings(relation, waysById).map((ring) => ({ tags, polygon: project(ring) }));
    });
    const features: Feature[] = [
      ...ways.filter((way) => way.tags).map((way) => ({ tags: way.tags ?? {}, polygon: polygonFor(way) })),
      ...relationFeatures,
    ];

    const landmarkAnchors = preset.landmarks.map((landmark) => ({
      position: geoToBlock(landmark.anchor, preset.origin, scale),
      radiusBlocks: landmark.suppressRadiusMetres / scale,
    }));
    const centreOf = (polygon: BlockPoint[]) => {
      const centre = polygon.reduce((sum, point) => ({ x: sum.x + point.x, z: sum.z + point.z }), { x: 0, z: 0 });
      return { x: centre.x / polygon.length, z: centre.z / polygon.length };
    };
    const suppressed = (polygon: BlockPoint[]) => {
      if (!polygon.length) return false;
      const centre = centreOf(polygon);
      return landmarkAnchors.some((landmark) => Math.hypot(centre.x - landmark.position.x, centre.z - landmark.position.z) < landmark.radiusBlocks);
    };
    const isClosed = (polygon: BlockPoint[]) => {
      const first = polygon[0];
      const last = polygon[polygon.length - 1];
      return Boolean(first && last && first.x === last.x && first.z === last.z && polygon.length > 3);
    };

    onProgress({ stage: "Laying parks, plazas and water", progress: 0.2 });
    const treeSeedMod = Math.round(97 * (BLOCK_METRES / scale) ** 2) * 2;
    for (const { tags, polygon } of features) {
      if (hiddenFromSurface(tags)) continue;
      if (tags.natural === "water" || tags.water || (tags.waterway && isClosed(polygon))) {
        fillPolygon(polygon, limit, areaCap, (x, z) => setSurface(x, z, BlockId.WATER));
        stats.water += 1;
      } else if (tags.amenity === "fountain" && isClosed(polygon)) {
        fillPolygon(polygon, limit, areaCap, (x, z) => world.setBlockRaw(x, ground + 1, z, BlockId.WATER));
        for (let index = 1; index < polygon.length; index += 1) {
          const start = polygon[index - 1];
          const end = polygon[index];
          if (!start || !end) continue;
          for (const point of rasterLine(start, end)) {
            if (withinLimit(point.x, point.z, limit)) world.setBlockRaw(point.x, ground + 1, point.z, BlockId.WHITE_MARBLE);
          }
        }
        stats.furniture += 1;
      } else if (["park", "garden", "recreation_ground", "pitch", "playground"].includes(tags.leisure ?? "")
        || ["grass", "village_green", "greenery", "flowerbed", "meadow"].includes(tags.landuse ?? "")
        || ["grassland", "scrub", "wood"].includes(tags.natural ?? "")) {
        const planted = ["park", "garden", "recreation_ground"].includes(tags.leisure ?? "") || tags.natural === "wood";
        fillPolygon(polygon, limit, areaCap, (x, z) => {
          setSurface(x, z, BlockId.GRASS);
          if (!planted) return;
          const seed = Math.abs((x * 73856093) ^ (z * 19349663));
          if (seed % treeSeedMod === 0) buildTree(x, z);
        });
        stats.parks += 1;
      } else if ((tags.highway === "pedestrian" && tags.area === "yes") || tags.amenity === "parking") {
        fillPolygon(polygon, limit, areaCap, (x, z) => setSurface(x, z, tags.amenity === "parking" ? BlockId.ROAD : BlockId.PAVEMENT));
      }
    }

    onProgress({ stage: "Rasterizing real roads", progress: 0.38 });
    const centrelines: BlockPoint[] = [];
    for (const way of ways) {
      const tags = way.tags ?? {};
      if (!tags.highway || hiddenFromSurface(tags)) continue;
      if (PATH_HIGHWAYS.includes(tags.highway) || tags.highway === "track" || tags.area === "yes") continue;
      const points = polygonFor(way);
      const radius = Math.max(1, Math.round(roadHalfWidthMetres(tags.highway) / scale));
      const wide = radius >= 3;
      let along = 0;
      for (let index = 1; index < points.length; index += 1) {
        const start = points[index - 1];
        const end = points[index];
        if (!start || !end) continue;
        for (const point of rasterLine(start, end)) {
          for (let dx = -radius - 1; dx <= radius + 1; dx += 1) {
            for (let dz = -radius - 1; dz <= radius + 1; dz += 1) {
              const x = point.x + dx;
              const z = point.z + dz;
              if (!withinLimit(x, z, limit)) continue;
              if (Math.abs(dx) <= radius && Math.abs(dz) <= radius) {
                setSurface(x, z, BlockId.ROAD);
              } else if (surfaceIs(x, z, BlockId.GRASS)) {
                // kerbside pavement strip where the road meets open ground
                setSurface(x, z, BlockId.PAVEMENT);
              }
            }
          }
          if (wide && along % 6 < 2) centrelines.push(point);
          along += 1;
        }
      }
      stats.roads += 1;
    }
    for (const point of centrelines) {
      if (withinLimit(point.x, point.z, limit) && surfaceIs(point.x, point.z, BlockId.ROAD)) {
        setSurface(point.x, point.z, BlockId.ROAD_LINE);
      }
    }

    onProgress({ stage: "Paving footpaths and crossings", progress: 0.52 });
    for (const way of ways) {
      const tags = way.tags ?? {};
      if (hiddenFromSurface(tags) || tags.area === "yes") continue;
      if (!PATH_HIGHWAYS.includes(tags.highway ?? "")) continue;
      const crossing = tags.footway === "crossing" || tags.highway === "crossing";
      const radius = Math.max(0, Math.floor(pathHalfWidthMetres(tags.highway ?? "") / scale));
      const points = polygonFor(way);
      for (let index = 1; index < points.length; index += 1) {
        const start = points[index - 1];
        const end = points[index];
        if (!start || !end) continue;
        for (const point of rasterLine(start, end)) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            for (let dz = -radius; dz <= radius; dz += 1) {
              const x = point.x + dx;
              const z = point.z + dz;
              if (!withinLimit(x, z, limit)) continue;
              const onRoad = surfaceIs(x, z, BlockId.ROAD) || surfaceIs(x, z, BlockId.ROAD_LINE);
              if (crossing) {
                if (onRoad) setSurface(x, z, BlockId.ROAD_LINE);
              } else if (!onRoad) {
                setSurface(x, z, BlockId.PAVEMENT);
              }
            }
          }
        }
      }
    }

    onProgress({ stage: "Extruding building footprints", progress: 0.64 });
    for (const { tags, polygon } of features) {
      if (!tags.building || tags["building:part"] === "yes") continue;
      if (hiddenFromSurface(tags) || polygon.length < 3 || suppressed(polygon)) continue;
      const suggestion: BuildingStyle = {
        block: chooseBuildingBlock(tags),
        heightMetres: buildingHeightMetres(tags),
        arcade: false,
      };
      const centre = centreOf(polygon);
      const style = preset.buildingStyle?.(tags, { x: centre.x * scale, z: centre.z * scale }, suggestion) ?? suggestion;
      const height = Math.min(30, Math.max(2, Math.round(style.heightMetres / scale)));
      const arcadeHeight = Math.max(2, floorBlocks);

      let outlineIndex = 0;
      for (let index = 1; index < polygon.length; index += 1) {
        const start = polygon[index - 1];
        const end = polygon[index];
        if (!start || !end) continue;
        for (const point of rasterLine(start, end)) {
          outlineIndex += 1;
          if (!withinLimit(point.x, point.z, limit)) continue;
          for (let y = 1; y <= height; y += 1) {
            if (style.arcade && y <= arcadeHeight) {
              // open colonnade: a column every third outline block
              if (outlineIndex % 3 === 0) world.setBlockRaw(point.x, ground + y, point.z, style.block);
              else if (y === 1) setSurface(point.x, point.z, BlockId.PAVEMENT);
              continue;
            }
            const window = style.block !== BlockId.GLASS && y > 1 && y < height && y % floorBlocks === 0 && outlineIndex % 3 !== 0;
            world.setBlockRaw(point.x, ground + y, point.z, window ? BlockId.GLASS : style.block);
          }
        }
      }
      fillPolygon(polygon, limit, areaCap, (x, z) => {
        world.setBlockRaw(x, ground + height, z, BlockId.ROOF);
        setSurface(x, z, BlockId.PAVEMENT);
      });
      stats.buildings += 1;
    }

    onProgress({ stage: "Planting hedges, fences and boundary walls", progress: 0.78 });
    for (const way of ways) {
      const tags = way.tags ?? {};
      if (!tags.barrier || hiddenFromSurface(tags)) continue;
      const block = tags.barrier === "hedge" ? BlockId.HEDGE
        : ["fence", "railing", "handrail"].includes(tags.barrier) ? BlockId.METAL
          : tags.barrier === "wall" || tags.barrier === "retaining_wall" ? BlockId.STONE
            : undefined;
      if (!block) continue;
      const points = polygonFor(way);
      for (let index = 1; index < points.length; index += 1) {
        const start = points[index - 1];
        const end = points[index];
        if (!start || !end) continue;
        for (const point of rasterLine(start, end)) {
          if (withinLimit(point.x, point.z, limit) && !surfaceIs(point.x, point.z, BlockId.ROAD)) {
            world.setBlockRaw(point.x, ground + 1, point.z, block);
          }
        }
      }
    }

    onProgress({ stage: "Placing trees, lamps and street furniture", progress: 0.86 });
    for (const node of nodes.values()) {
      const tags = node.tags;
      if (!tags || hiddenFromSurface(tags)) continue;
      const { x, z } = geoToBlock({ lat: node.lat, lon: node.lon }, preset.origin, scale);
      if (!withinLimit(x, z, limit)) continue;
      if (tags.natural === "tree") {
        const height = Number.parseFloat(tags.height ?? "");
        buildTree(x, z, Number.isFinite(height) ? height : 8);
      } else if (tags.highway === "street_lamp") {
        buildLamp(x, z);
      } else if (tags.railway === "subway_entrance") {
        buildMetroEntrance(x, z);
      } else if (tags.man_made === "flagpole") {
        const height = Number.parseFloat(tags.height ?? "");
        buildFlagpole(x, z, Number.isFinite(height) ? height : 12);
      } else if (tags.amenity === "fountain") {
        buildFountain(x, z, Math.max(2, Math.round(4 / scale)));
      }
    }
  }

  onProgress({ stage: "Building landmark voxels", progress: 0.94 });
  for (const landmark of preset.landmarks) {
    const position = geoToBlock(landmark.anchor, preset.origin, scale);
    landmark.build({
      world,
      originX: position.x,
      originZ: position.z,
      groundY: ground,
      block: BlockId,
      blockMetres: scale,
    });
    stats.landmarks += 1;
  }
  world.markAllDirty();
  onProgress({ stage: "World ready", progress: 1 });
  return stats;
}
