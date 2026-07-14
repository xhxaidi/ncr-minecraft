import * as THREE from "three";
import { CITY_CATALOG, getPreset } from "../content/catalog";
import type { PresetDefinition } from "../content/types/catalog";
import { HOTBAR_BLOCKS, BLOCK_NAMES, BlockId, type BlockIdValue } from "../engine/world/blocks";
import { VoxelWorld } from "../engine/world/VoxelWorld";
import { createTextureAtlas, TILES_PER_ROW, TILE_SIZE } from "../engine/rendering/textureAtlas";
import { ChunkMesher } from "../engine/rendering/ChunkMesher";
import { PlayerController } from "../engine/physics/PlayerController";
import { raycastVoxel } from "../engine/physics/raycast";
import { generatePresetWorld } from "../geo/osm/generateWorld";

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}

export class GameApp {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 1000);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  private readonly world = new VoxelWorld();
  private readonly atlas = createTextureAtlas();
  private readonly mesher = new ChunkMesher(this.scene, this.world, this.atlas);
  private readonly player: PlayerController;
  private selected = 0;
  private currentPreset: PresetDefinition = getPreset("india-gate");
  private entered = false;
  private loading = false;
  private day = true;
  private frames = 0;
  private fpsElapsed = 0;
  private lastFrame = performance.now();

  private readonly gameRoot = required<HTMLDivElement>("#game");
  private readonly welcome = required<HTMLElement>("#welcome");
  private readonly pause = required<HTMLElement>("#pause");
  private readonly loadingLayer = required<HTMLElement>("#loading");
  private readonly loadingStage = required<HTMLElement>("#loading-stage");
  private readonly loadingProgress = required<HTMLElement>("#loading-progress");
  private readonly locationName = required<HTMLElement>("#location-name");
  private readonly locationDescription = required<HTMLElement>("#location-description");
  private readonly stats = required<HTMLElement>("#world-stats");
  private readonly toast = required<HTMLElement>("#toast");
  private readonly fps = required<HTMLElement>("#fps");
  private readonly coords = required<HTMLElement>("#coords");

  constructor() {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.gameRoot.append(this.renderer.domElement);
    this.player = new PlayerController(this.world, this.camera, this.renderer.domElement, (locked) => {
      if (!this.entered || matchMedia("(pointer: coarse)").matches) return;
      this.pause.classList.toggle("hidden", locked);
    });
    this.installUi();
    this.setTime(true);
    addEventListener("resize", () => this.resize());
    addEventListener("keydown", (event) => {
      if (event.code.startsWith("Digit")) {
        const index = Number(event.code.slice(5)) - 1;
        if (index >= 0 && index < HOTBAR_BLOCKS.length) this.selectBlock(index);
      }
    });
    this.renderer.domElement.addEventListener("mousedown", (event) => {
      if (document.pointerLockElement !== this.renderer.domElement) return;
      if (event.button === 0) this.mine();
      if (event.button === 2) this.build();
    });
    this.renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  async start(): Promise<void> {
    this.renderLoop(performance.now());
    await this.loadPreset(this.currentPreset.id);
  }

  private installUi(): void {
    const presetList = required<HTMLElement>("#preset-list");
    for (const city of CITY_CATALOG) {
      const heading = document.createElement("div");
      heading.className = "city-heading";
      heading.textContent = `${city.name} · ${city.region}`;
      presetList.append(heading);
      for (const preset of city.presets) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "preset-button";
        button.dataset.preset = preset.id;
        button.innerHTML = `<b>${preset.shortName}</b><small>${preset.description}</small>`;
        button.addEventListener("click", () => {
          void this.loadPreset(preset.id).then(() => {
            if (this.entered) this.player.lock();
          });
        });
        presetList.append(button);
      }
    }

    const hotbar = required<HTMLElement>("#hotbar");
    HOTBAR_BLOCKS.forEach((block, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hotbar-slot";
      button.title = BLOCK_NAMES[block] ?? "Block";
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 16;
      const context = canvas.getContext("2d");
      const tile = this.atlas.tileForBlock(block, 0);
      context?.drawImage(this.atlas.canvas, (tile % TILES_PER_ROW) * TILE_SIZE, Math.floor(tile / TILES_PER_ROW) * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0, 0, 16, 16);
      const key = document.createElement("kbd");
      key.textContent = String(index + 1);
      button.append(canvas, key);
      button.addEventListener("click", () => this.selectBlock(index));
      hotbar.append(button);
    });
    this.selectBlock(0);

    const guestInput = required<HTMLInputElement>("#guest-name");
    const savedGuest = localStorage.getItem("dilli-blocks-guest");
    if (savedGuest) guestInput.value = savedGuest;
    required<HTMLFormElement>("#guest-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const name = guestInput.value.trim().slice(0, 20) || "Guest Explorer";
      localStorage.setItem("dilli-blocks-guest", name);
      required<HTMLElement>("#guest-label").textContent = name;
      this.entered = true;
      this.welcome.classList.add("hidden");
      this.player.lock();
    });
    required<HTMLButtonElement>("#resume").addEventListener("click", () => this.player.lock());
    required<HTMLButtonElement>("#choose-world").addEventListener("click", () => {
      this.pause.classList.add("hidden");
      this.showToast("Choose a district from the world directory");
    });
    required<HTMLButtonElement>("#time-toggle").addEventListener("click", () => this.setTime(!this.day));
    required<HTMLButtonElement>("#touch-mine").addEventListener("click", () => this.mine());
    required<HTMLButtonElement>("#touch-build").addEventListener("click", () => this.build());
    document.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((button) => {
      const code = button.dataset.move ?? "";
      const stop = () => this.player.setMovement(code, false);
      button.addEventListener("pointerdown", () => this.player.setMovement(code, true));
      button.addEventListener("pointerup", stop);
      button.addEventListener("pointercancel", stop);
      button.addEventListener("pointerleave", stop);
    });
  }

  private async loadPreset(presetId: string): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.loadingLayer.classList.remove("hidden");
    this.currentPreset = getPreset(presetId);
    document.querySelectorAll<HTMLElement>("[data-preset]").forEach((button) => {
      button.classList.toggle("active", button.dataset.preset === presetId);
    });
    this.locationName.textContent = this.currentPreset.name;
    this.locationDescription.textContent = this.currentPreset.description;
    this.mesher.clear();
    try {
      const result = await generatePresetWorld(this.world, this.currentPreset, ({ stage, progress }) => {
        this.loadingStage.textContent = stage;
        this.loadingProgress.style.width = `${Math.round(progress * 100)}%`;
      });
      this.player.setSpawn(this.currentPreset.spawn);
      this.mesher.rebuildBudget(36);
      this.stats.textContent = `${result.buildings} buildings · ${result.roads} roads · ${result.landmarks} landmarks`;
      required<HTMLElement>("#world-source").textContent = this.currentPreset.dataUrl ? "CACHED OPENSTREETMAP" : "HANDCRAFTED LANDMARK LAB";
      this.showToast(`${this.currentPreset.shortName} ready · every visible block is editable`);
    } catch (error) {
      this.stats.textContent = "World generation failed";
      this.showToast(error instanceof Error ? error.message : "Could not generate world");
    } finally {
      this.loadingLayer.classList.add("hidden");
      this.loading = false;
    }
  }

  private selectBlock(index: number): void {
    this.selected = index;
    document.querySelectorAll(".hotbar-slot").forEach((slot, slotIndex) => slot.classList.toggle("active", slotIndex === index));
    const block = HOTBAR_BLOCKS[index];
    if (block !== undefined) this.showToast(`${BLOCK_NAMES[block]} selected`);
  }

  private mine(): void {
    const hit = raycastVoxel(this.world, this.camera);
    if (!hit) return;
    this.world.setBlock(hit.x, hit.y, hit.z, BlockId.AIR);
    this.showToast(`${BLOCK_NAMES[hit.block]} mined`);
  }

  private build(): void {
    const hit = raycastVoxel(this.world, this.camera);
    const block = HOTBAR_BLOCKS[this.selected];
    if (!hit || block === undefined) return;
    const x = hit.x + hit.face[0];
    const y = hit.y + hit.face[1];
    const z = hit.z + hit.face[2];
    if (this.world.getBlock(x, y, z) !== BlockId.AIR) return;
    if (Math.abs(x - this.player.position.x) < .7 && Math.abs(z - this.player.position.z) < .7 && y >= this.player.position.y && y <= this.player.position.y + 2) {
      this.showToast("Cannot place a block inside yourself");
      return;
    }
    this.world.setBlock(x, y, z, block);
    this.showToast(`${BLOCK_NAMES[block]} placed`);
  }

  private setTime(day: boolean): void {
    this.day = day;
    this.scene.background = new THREE.Color(day ? 0x8abbd5 : 0x0b1230);
    this.scene.fog = new THREE.Fog(day ? 0x9bc2d3 : 0x1d294c, 75, 270);
    this.mesher.material.color.set(day ? 0xffffff : 0x7f91bd);
    this.showToast(day ? "Daylight restored" : "Night mode enabled");
  }

  private showToast(message: string): void {
    this.toast.textContent = message;
  }

  private resize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  private renderLoop = (now: number): void => {
    requestAnimationFrame(this.renderLoop);
    const delta = Math.min((now - this.lastFrame) / 1000, .05);
    this.lastFrame = now;
    this.player.update(delta);
    this.mesher.rebuildBudget(10);
    this.renderer.render(this.scene, this.camera);
    this.frames += 1;
    this.fpsElapsed += delta;
    if (this.fpsElapsed >= 1) {
      this.fps.textContent = `${Math.round(this.frames / this.fpsElapsed)} FPS`;
      this.coords.textContent = `x ${Math.floor(this.player.position.x)} · y ${Math.floor(this.player.position.y)} · z ${Math.floor(this.player.position.z)}`;
      this.frames = 0;
      this.fpsElapsed = 0;
    }
  };
}
