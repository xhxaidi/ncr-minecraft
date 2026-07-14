import type { BlockIdValue } from "../../engine/world/blocks";
import type { LandmarkDefinition } from "./landmark";

export type GeoPoint = {
  lat: number;
  lon: number;
};

export type BuildingStyle = {
  block: BlockIdValue;
  heightMetres: number;
  arcade: boolean;
};

// lets a preset restyle osm buildings (centreMetres is relative to the preset origin)
export type BuildingStyleHook = (
  tags: Record<string, string>,
  centreMetres: { x: number; z: number },
  suggestion: BuildingStyle,
) => BuildingStyle;

export type SpawnPoint = {
  x: number;
  y: number;
  z: number;
  yaw?: number;
};

export type BuildingDetail = {
  levels?: number;
  heightMetres?: number;
  material?: "glass" | "concrete" | "brick" | "sandstone" | "marble" | "metal";
};

export type PresetDefinition = {
  id: string;
  cityId: string;
  name: string;
  shortName: string;
  description: string;
  origin: GeoPoint;
  dataUrl?: string;
  radiusChunks: number;
  // metres represented by one block; smaller values give finer detail
  blockMetres?: number;
  spawn: SpawnPoint;
  landmarks: LandmarkDefinition[];
  // real-world enrichment for osm ways lacking height/material tags, keyed by way id
  buildingDetails?: Record<number, BuildingDetail>;
  buildingStyle?: BuildingStyleHook;
};

export type CityDefinition = {
  id: string;
  name: string;
  region: string;
  description: string;
  presets: PresetDefinition[];
};
