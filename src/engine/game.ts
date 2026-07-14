import * as THREE from "three";
import { CITY_CATALOG, getPreset } from "../content/catalog";
import type { PresetDefinition } from "../content/types/catalog";
import { generatePresetWorld } from "../geo/osm/generateWorld";
import { LightingRig, type TimeOfDay } from "./lighting";
import { raycastVoxel } from "./physics/raycast";
import { PlayerController } from "./physics/PlayerController";
import { ChunkMesher } from "./rendering/ChunkMesher";
import { BLOCK_NAMES, BlockId, HOTBAR_BLOCKS } from "./world/blocks";
import { VoxelWorld } from "./world/VoxelWorld";

export type PresetInfo = {
  id: string;
  name: string;
  description: string;
  source: string;
  stats: string;
};

export type GameEvents = {
  fps: number;
  coords: { x: number; y: number; z: number };
  loading: { active: boolean; stage: string; progress: number };
  preset: PresetInfo;
  toast: string;
  slot: number;
  timeofday: TimeOfDay;
  locked: boolean;
  uihidden: boolean;
};

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

// Hero cameras for the Jama Masjid demo (world coords; mosque centre = 0,0).
// (a) street-level bazaar approach down the axis, (b) elevated three-quarter
// view of domes + courtyard, (c) courtyard interior facing the pishtaq.
type HeroShot = { name: string; pos: [number, number, number]; target: [number, number, number] };
const HERO_SHOTS: HeroShot[] = [
  { name: "a-street", pos: [54, 12.8, 2], target: [0, 17, 0] },
  { name: "b-overview", pos: [46, 44, -40], target: [-8, 13, 2] },
  { name: "c-courtyard", pos: [12, 12.8, 8], target: [-11, 17, 0] },
];
const HERO_FOV = 50;

function downloadPng(filename: string, dataUrl: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export class Game {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 1000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly world = new VoxelWorld();
  private readonly mesher: ChunkMesher;
  private readonly lighting: LightingRig;
  private readonly player: PlayerController;
  private readonly listeners: { [K in keyof GameEvents]?: Set<Handler<K>> } = {};
  private readonly abort = new AbortController();
  private currentPreset: PresetDefinition = getPreset("jama-masjid");
  private selected = 0;
  private hero = -1; // -1 = screenshot mode off, else index into HERO_SHOTS
  private loading = false;
  private time: TimeOfDay = "day";
  private frames = 0;
  private fpsElapsed = 0;
  private lastFrame = performance.now();
  private raf = 0;
  private settledAt = Number.POSITIVE_INFINITY;
  private lowFpsWindows = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.mesher = new ChunkMesher(this.scene, this.world);
    this.lighting = new LightingRig(this.scene, this.renderer, this.camera);
    this.player = new PlayerController(this.world, this.camera, canvas, (locked) => this.emit("locked", locked));

    const signal = this.abort.signal;
    addEventListener("resize", () => this.resize(), { signal });
    addEventListener("keydown", (event) => {
      if ((event.target as HTMLElement | null)?.tagName === "INPUT") return;
      if (event.code.startsWith("Digit")) {
        const index = Number(event.code.slice(5)) - 1;
        if (index >= 0 && index < HOTBAR_BLOCKS.length) this.selectSlot(index);
      }
      if (event.code === "KeyP" && !event.repeat) this.cycleHero();
    }, { signal });
    canvas.addEventListener("mousedown", (event) => {
      if (document.pointerLockElement !== canvas) return;
      if (event.button === 0) this.mine();
      if (event.button === 2) this.build();
    }, { signal });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
  }

  on<K extends keyof GameEvents>(event: K, handler: Handler<K>): () => void {
    const set = (this.listeners[event] ?? new Set()) as Set<Handler<K>>;
    this.listeners[event] = set as never;
    set.add(handler);
    return () => set.delete(handler);
  }

  private emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    this.listeners[event]?.forEach((handler) => handler(payload));
  }

  async start(): Promise<void> {
    this.raf = requestAnimationFrame(this.renderLoop);
    await this.loadPreset(this.currentPreset.id);
  }

  dispose(): void {
    this.abort.abort();
    cancelAnimationFrame(this.raf);
    this.mesher.clear();
    this.renderer.dispose();
  }

  async loadPreset(presetId: string): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.currentPreset = getPreset(presetId);
    const source = this.currentPreset.dataUrl ? "CACHED OPENSTREETMAP" : "HANDCRAFTED LANDMARK LAB";
    this.emit("loading", { active: true, stage: "Preparing voxel terrain", progress: 0 });
    this.emit("preset", {
      id: this.currentPreset.id,
      name: this.currentPreset.name,
      description: this.currentPreset.description,
      source,
      stats: "Generating world…",
    });
    this.mesher.clear();
    try {
      const result = await generatePresetWorld(this.world, this.currentPreset, ({ stage, progress }) => {
        this.emit("loading", { active: true, stage, progress });
      });
      this.player.setSpawn(this.currentPreset.spawn);
      this.mesher.rebuildBudget(36);
      this.emit("preset", {
        id: this.currentPreset.id,
        name: this.currentPreset.name,
        description: this.currentPreset.description,
        source,
        stats: `${result.buildings} buildings · ${result.roads} roads · ${result.landmarks} landmarks`,
      });
      this.emit("toast", `${this.currentPreset.shortName} ready · every visible block is editable`);
    } catch (error) {
      this.emit("toast", error instanceof Error ? error.message : "Could not generate world");
    } finally {
      this.loading = false;
      this.emit("loading", { active: false, stage: "", progress: 1 });
      this.settledAt = performance.now();
      this.lowFpsWindows = 0;
    }
  }

  searchPlace(query: string): string | null {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    for (const city of CITY_CATALOG) {
      for (const preset of city.presets) {
        const haystack = `${city.name} ${preset.name} ${preset.shortName} ${preset.description}`.toLowerCase();
        if (haystack.includes(needle)) {
          if (preset.id === this.currentPreset.id) this.emit("toast", `Already exploring ${preset.shortName}`);
          else void this.loadPreset(preset.id);
          return preset.name;
        }
      }
    }
    this.emit("toast", `No district matches “${query.trim()}”`);
    return null;
  }

  setTimeOfDay(time: TimeOfDay): void {
    this.time = time;
    this.lighting.setTime(time);
    this.mesher.setNight(time === "night");
    this.emit("timeofday", time);
    this.emit("toast", time === "day" ? "Daylight restored" : "Night mode enabled");
  }

  execCommand(input: string): void {
    const command = input.trim().toLowerCase();
    if (!command) return;
    if (command.includes("night")) return this.setTimeOfDay("night");
    if (command.includes("day") || command.includes("morning")) return this.setTimeOfDay("day");
    if (command.startsWith("goto ") || command.startsWith("go to ")) {
      void this.searchPlace(command.replace(/^go ?to /, ""));
      return;
    }
    if (command === "fly") {
      this.player.fly = !this.player.fly;
      this.emit("toast", this.player.fly ? "Fly mode on" : "Fly mode off");
      return;
    }
    this.emit("toast", `Unknown command: ${input.trim()}`);
  }

  lock(): void {
    this.player.lock();
  }

  // Screenshot mode: P hides the UI, drops FOV to 50 and steps through the
  // saved hero cameras, exporting a PNG at each stop; a fourth press exits.
  cycleHero(): void {
    const next = this.hero + 1;
    if (next >= HERO_SHOTS.length) {
      this.exitScreenshotMode();
      const iteration = Number(localStorage.getItem("art-iteration") ?? "1");
      localStorage.setItem("art-iteration", String(iteration + 1));
      return;
    }
    const iteration = Number(localStorage.getItem("art-iteration") ?? "1");
    const shot = HERO_SHOTS[next]!;
    downloadPng(`hero-${shot.name}-iter${iteration}.png`, this.captureHero(next));
  }

  captureHero(index: number): string {
    const shot = HERO_SHOTS[index];
    if (!shot) throw new Error(`No hero shot ${index}`);
    if (this.hero < 0) {
      this.emit("uihidden", true);
      this.camera.fov = HERO_FOV;
      this.camera.updateProjectionMatrix();
    }
    this.hero = index;
    this.applyHero(shot);
    this.lighting.render();
    return this.renderer.domElement.toDataURL("image/png");
  }

  exitScreenshotMode(): void {
    if (this.hero < 0) return;
    this.hero = -1;
    this.camera.fov = 72;
    this.camera.updateProjectionMatrix();
    this.emit("uihidden", false);
  }

  private applyHero(shot: HeroShot): void {
    this.camera.position.set(...shot.pos);
    this.camera.lookAt(...shot.target);
    this.lighting.followPlayer(this.camera.position);
  }

  setMovement(code: string, active: boolean): void {
    this.player.setMovement(code, active);
  }

  selectSlot(index: number): void {
    this.selected = index;
    this.emit("slot", index);
    const block = HOTBAR_BLOCKS[index];
    if (block !== undefined) this.emit("toast", `${BLOCK_NAMES[block]} selected`);
  }

  mine(): void {
    const hit = raycastVoxel(this.world, this.camera);
    if (!hit) return;
    this.world.setBlock(hit.x, hit.y, hit.z, BlockId.AIR);
    this.emit("toast", `${BLOCK_NAMES[hit.block]} mined`);
  }

  build(): void {
    const hit = raycastVoxel(this.world, this.camera);
    const block = HOTBAR_BLOCKS[this.selected];
    if (!hit || block === undefined) return;
    const x = hit.x + hit.face[0];
    const y = hit.y + hit.face[1];
    const z = hit.z + hit.face[2];
    if (this.world.getBlock(x, y, z) !== BlockId.AIR) return;
    if (Math.abs(x - this.player.position.x) < .7 && Math.abs(z - this.player.position.z) < .7 && y >= this.player.position.y && y <= this.player.position.y + 2) {
      this.emit("toast", "Cannot place a block inside yourself");
      return;
    }
    this.world.setBlock(x, y, z, block);
    this.emit("toast", `${BLOCK_NAMES[block]} placed`);
  }

  private resize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.lighting.setSize(innerWidth, innerHeight);
  }

  private renderLoop = (now: number): void => {
    this.raf = requestAnimationFrame(this.renderLoop);
    const delta = Math.min((now - this.lastFrame) / 1000, .05);
    this.lastFrame = now;
    if (this.hero >= 0) {
      // Screenshot mode owns the camera; physics and input stand still.
      this.applyHero(HERO_SHOTS[this.hero]!);
    } else {
      this.player.update(delta);
      this.lighting.followPlayer(this.player.position);
    }
    this.mesher.rebuildBudget(10);
    this.lighting.render();
    this.frames += 1;
    this.fpsElapsed += delta;
    if (this.fpsElapsed >= 1) {
      const fps = Math.round(this.frames / this.fpsElapsed);
      this.emit("fps", fps);
      this.emit("coords", {
        x: Math.floor(this.player.position.x),
        y: Math.floor(this.player.position.y),
        z: Math.floor(this.player.position.z),
      });
      // ponytail: one-way shadow kill switch, no re-enable until reload.
      if (this.lighting.shadowsEnabled && now - this.settledAt > 3000) {
        this.lowFpsWindows = fps < 55 ? this.lowFpsWindows + 1 : 0;
        if (this.lowFpsWindows >= 2) {
          this.lighting.disableShadows();
          this.emit("toast", "Shadows disabled to hold 60 FPS");
        }
      }
      this.frames = 0;
      this.fpsElapsed = 0;
    }
  };
}
