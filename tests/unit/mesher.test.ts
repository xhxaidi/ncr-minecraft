import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ChunkMesher } from "../../src/engine/rendering/ChunkMesher";
import { BlockId } from "../../src/engine/world/blocks";
import { VoxelWorld } from "../../src/engine/world/VoxelWorld";

function meshWorld(build: (world: VoxelWorld) => void) {
  const scene = new THREE.Scene();
  const world = new VoxelWorld();
  build(world);
  const mesher = new ChunkMesher(scene, world);
  mesher.rebuildBudget(64);
  return { scene, mesher };
}

describe("chunk mesher", () => {
  it("bakes darker vertex colors where corners are occluded", () => {
    const { scene } = meshWorld((world) => {
      world.setBlock(4, 4, 4, BlockId.STONE);
      world.setBlock(5, 5, 4, BlockId.STONE); // occludes one top corner of the first block
    });
    const mesh = scene.children.find((child): child is THREE.Mesh => child instanceof THREE.Mesh);
    expect(mesh).toBeDefined();
    const colors = mesh!.geometry.getAttribute("color");
    const positions = mesh!.geometry.getAttribute("position");
    // Collect the brightness of top-face vertices (y === 5) of the lower block.
    const topBrightness: number[] = [];
    for (let index = 0; index < positions.count; index += 1) {
      if (positions.getY(index) === 5 && positions.getX(index) <= 5 && positions.getZ(index) <= 5) {
        topBrightness.push(colors.getX(index) + colors.getY(index) + colors.getZ(index));
      }
    }
    expect(topBrightness.length).toBeGreaterThan(0);
    expect(Math.min(...topBrightness)).toBeLessThan(Math.max(...topBrightness) - 0.01);
  });

  it("splits windows and neon into their own material groups", () => {
    const { scene, mesher } = meshWorld((world) => {
      world.setBlock(1, 4, 1, BlockId.CONCRETE);
      world.setBlock(2, 4, 1, BlockId.WINDOW);
      world.setBlock(3, 4, 1, BlockId.NEON);
    });
    const mesh = scene.children.find((child): child is THREE.Mesh => child instanceof THREE.Mesh);
    expect(mesh!.geometry.groups).toHaveLength(3);
    expect(mesher.materials).toHaveLength(3);
    const dayWindow = mesher.materials[1];
    mesher.setNight(true);
    expect(mesher.materials[1]).not.toBe(dayWindow);
    mesher.setNight(false);
    expect(mesher.materials[1]).toBe(dayWindow);
  });
});
