import type { BlockId } from "../../engine/world/blocks";
import type { VoxelWorld } from "../../engine/world/VoxelWorld";
import type { GeoPoint } from "./catalog";

export type LandmarkBuildContext = {
  world: VoxelWorld;
  originX: number;
  originZ: number;
  groundY: number;
  block: typeof BlockId;
};

export type LandmarkDefinition = {
  id: string;
  name: string;
  description: string;
  anchor: GeoPoint;
  suppressRadiusMetres: number;
  build: (context: LandmarkBuildContext) => void;
};
