import type { LandmarkDefinition } from "./landmark";

export type GeoPoint = {
  lat: number;
  lon: number;
};

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
  spawn: SpawnPoint;
  landmarks: LandmarkDefinition[];
  // metres represented by one block; smaller values give finer detail
  blockMetres?: number;
  // real-world enrichment for osm ways lacking height/material tags, keyed by way id
  buildingDetails?: Record<number, BuildingDetail>;
};

export type CityDefinition = {
  id: string;
  name: string;
  region: string;
  description: string;
  presets: PresetDefinition[];
};
