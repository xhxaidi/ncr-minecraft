import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export type TimeOfDay = "day" | "night";

const SUN_OFFSET = new THREE.Vector3(65, 92, 65); // from the SE, ~45° elevation
const SHADOW_BOX = 75; // half-size of the ~150-unit box following the player

// Horizon MUST equal fog so distant buildings dissolve into the haze with no
// seam. Single source of truth for each time of day.
const DAY_HORIZON = "#e3d9c3";
const NIGHT_HORIZON = "#1d294c";

function skyGradient(stops: Array<[number, string]>, sun?: { u: number; v: number }): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  for (const [at, colour] of stops) gradient.addColorStop(at, colour);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (sun) {
    // Subtle warm disc with a soft halo, painted into the backdrop.
    const x = sun.u * canvas.width;
    const y = sun.v * canvas.height;
    const halo = context.createRadialGradient(x, y, 4, x, y, 60);
    halo.addColorStop(0, "rgba(255, 244, 214, 0.9)");
    halo.addColorStop(0.18, "rgba(255, 238, 200, 0.35)");
    halo.addColorStop(1, "rgba(255, 238, 200, 0)");
    context.fillStyle = halo;
    context.fillRect(x - 60, y - 60, 120, 120);
    context.fillStyle = "rgba(255, 248, 226, 0.95)";
    context.beginPath();
    context.arc(x, y, 9, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class LightingRig {
  readonly sun = new THREE.DirectionalLight(0xffe8c4, 1.05);
  readonly hemi = new THREE.HemisphereLight(0xa8c4e0, 0xd9c1a0, 0.9);
  readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly daySky = skyGradient([[0, "#4d92d8"], [0.55, "#9cc6ea"], [1, DAY_HORIZON]]);
  private readonly nightSky = skyGradient([[0, "#050916"], [0.62, "#0b1230"], [1, NIGHT_HORIZON]]);
  shadowsEnabled = true;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
  ) {
    // Neutral keeps the palette saturated; ACES washed it toward grey.
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const shadowCamera = this.sun.shadow.camera;
    shadowCamera.left = -SHADOW_BOX;
    shadowCamera.right = SHADOW_BOX;
    shadowCamera.top = SHADOW_BOX;
    shadowCamera.bottom = -SHADOW_BOX;
    shadowCamera.near = 1;
    shadowCamera.far = 320;
    this.sun.shadow.normalBias = 0.9;
    scene.add(this.sun, this.sun.target, this.hemi);

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.15, 0.4, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.setTime("day");
  }

  setTime(time: TimeOfDay): void {
    const day = time === "day";
    this.scene.background = day ? this.daySky : this.nightSky;
    this.scene.fog = day
      ? new THREE.Fog(DAY_HORIZON, 80, 300)
      : new THREE.Fog(NIGHT_HORIZON, 55, 230);
    this.sun.color.set(day ? 0xffe8c4 : 0x9db4ff);
    this.sun.intensity = day ? 1.05 : 0.24;
    // Cool sky fill + warm ground bounce: shadowed faces tint toward
    // desaturated blue instead of gray.
    this.hemi.color.set(day ? 0xa8c4e0 : 0x2a3a63);
    this.hemi.groundColor.set(day ? 0xd9c1a0 : 0x141a2c);
    this.hemi.intensity = day ? 0.9 : 0.5;
    this.renderer.toneMappingExposure = day ? 1.15 : 1.0;
    // Threshold stays 0.9; strength keeps daytime clean and night glowing.
    this.bloom.strength = day ? 0.15 : 0.7;
  }

  followPlayer(position: THREE.Vector3): void {
    this.sun.target.position.copy(position);
    this.sun.position.copy(position).add(SUN_OFFSET);
  }

  disableShadows(): void {
    this.shadowsEnabled = false;
    this.sun.castShadow = false;
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  render(): void {
    this.composer.render();
  }
}
