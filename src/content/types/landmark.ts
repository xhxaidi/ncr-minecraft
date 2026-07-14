import type { BlockId } from "../../engine/world/blocks";
import type { VoxelWorld } from "../../engine/world/VoxelWorld";
import type { GeoPoint } from "./catalog";

export type LandmarkBuildContext = {
  world: VoxelWorld;
  originX: number;
  originZ: number;
  groundY: number;
  block: typeof BlockId;
  // metres per voxel for the active preset; size real-world dimensions with this
  blockMetres?: number;
};

export type LandmarkDefinition = {
  id: string;
  name: string;
  description: string;
  anchor: GeoPoint;
  suppressRadiusMetres: number;
  build: (context: LandmarkBuildContext) => void;
};
