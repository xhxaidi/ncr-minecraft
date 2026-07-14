import * as THREE from "three";
import { BlockId, type BlockIdValue } from "../world/blocks";
import type { VoxelWorld } from "../world/VoxelWorld";

export type VoxelHit = {
  x: number;
  y: number;
  z: number;
  block: BlockIdValue;
  face: [number, number, number];
};

export function raycastVoxel(world: VoxelWorld, camera: THREE.Camera, maxDistance = 7): VoxelHit | null {
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const origin = camera.position;
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = Math.sign(direction.x);
  const stepY = Math.sign(direction.y);
  const stepZ = Math.sign(direction.z);
  const deltaX = Math.abs(1 / direction.x);
  const deltaY = Math.abs(1 / direction.y);
  const deltaZ = Math.abs(1 / direction.z);
  let distanceX = deltaX * (stepX > 0 ? x + 1 - origin.x : origin.x - x);
  let distanceY = deltaY * (stepY > 0 ? y + 1 - origin.y : origin.y - y);
  let distanceZ = deltaZ * (stepZ > 0 ? z + 1 - origin.z : origin.z - z);
  let face: [number, number, number] = [0, 0, 0];
  let distance = 0;
  while (distance <= maxDistance) {
    if (distanceX < distanceY && distanceX < distanceZ) {
      x += stepX;
      distance = distanceX;
      distanceX += deltaX;
      face = [-stepX, 0, 0];
    } else if (distanceY < distanceZ) {
      y += stepY;
      distance = distanceY;
      distanceY += deltaY;
      face = [0, -stepY, 0];
    } else {
      z += stepZ;
      distance = distanceZ;
      distanceZ += deltaZ;
      face = [0, 0, -stepZ];
    }
    const block = world.getBlock(x, y, z);
    if (block !== BlockId.AIR && block !== BlockId.WATER) return { x, y, z, block, face };
  }
  return null;
}
