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
};

export type CityDefinition = {
  id: string;
  name: string;
  region: string;
  description: string;
  presets: PresetDefinition[];
};
