// player movement, minecraft-style controls and aabb collision
import * as THREE from "three";
import type { SpawnPoint } from "../../content/types/catalog";
import { isSolid } from "../world/blocks";
import type { VoxelWorld } from "../world/VoxelWorld";

const WALK_SPEED = 4.317;
const SPRINT_SPEED = 5.612;
const SNEAK_SPEED = 1.31;
const FLY_SPEED = 11;
const FLY_SPRINT_SPEED = 22;
const FLY_VERTICAL_SPEED = 9;
const GRAVITY = 32;
const JUMP_VELOCITY = 9;
const TERMINAL_VELOCITY = -60;
const GROUND_RATE = 12;
const AIR_RATE = 2.5;
const FLY_RATE = 6;
const EYE_HEIGHT = 1.62;
const SNEAK_EYE_HEIGHT = 1.27;
const EYE_RATE = 14;
const DOUBLE_TAP_MS = 300;
const SUPPORT_PROBE = 0.1;
const PLAYER_HALF_WIDTH = 0.3;
const PLAYER_HEIGHT = 1.8;

// frame-rate independent exponential approach toward a target value
export function approach(current: number, target: number, rate: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * delta));
}

export class DoubleTapTracker {
  private last = Number.NEGATIVE_INFINITY;

  constructor(private readonly windowMs: number = DOUBLE_TAP_MS) {}

  tap(now: number): boolean {
    if (now - this.last <= this.windowMs) {
      this.last = Number.NEGATIVE_INFINITY;
      return true;
    }
    this.last = now;
    return false;
  }
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target.isContentEditable;
}

export class PlayerController {
  readonly position = new THREE.Vector3(0, 12, 24);
  readonly velocity = new THREE.Vector3();
  yaw = Math.PI;
  pitch = 0;
  fly = false;
  onGround = false;
  enabled = false;
  sprinting = false;
  sneaking = false;
  private eyeHeight = EYE_HEIGHT;
  private readonly sprintTap = new DoubleTapTracker();
  private readonly flyTap = new DoubleTapTracker();
  private readonly keys = new Set<string>();
  private touching = false;
  private touchX = 0;
  private touchY = 0;

  constructor(
    private readonly world: VoxelWorld,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
    onLockChange: (locked: boolean) => void,
  ) {
    addEventListener("keydown", (event) => {
      if (isTypingTarget(event.target)) return;
      if (this.enabled && (event.code === "Space" || event.code.startsWith("Arrow"))) event.preventDefault();
      if (!event.repeat) {
        if (event.code === "KeyF") this.toggleFly();
        if (event.code === "Space" && this.flyTap.tap(performance.now())) this.toggleFly();
        if (event.code === "KeyW" && this.sprintTap.tap(performance.now())) this.sprinting = true;
        // ctrl only arms sprint when w is already held; ctrl-then-w is a browser shortcut
        if ((event.code === "ControlLeft" || event.code === "ControlRight") && this.keys.has("KeyW")) this.sprinting = true;
        if (event.code === "KeyS") this.sprinting = false;
      }
      this.keys.add(event.code);
    });
    addEventListener("keyup", (event) => {
      if (event.code === "KeyW") this.sprinting = false;
      this.keys.delete(event.code);
    });
    document.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== this.canvas) return;
      this.yaw -= event.movementX * 0.0024;
      this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.0024, -1.55, 1.55);
    });
    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === this.canvas;
      this.enabled = locked || matchMedia("(pointer: coarse)").matches;
      if (!locked) {
        this.keys.clear();
        this.sprinting = false;
      }
      onLockChange(locked);
    });
    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      this.touching = true;
      this.touchX = event.clientX;
      this.touchY = event.clientY;
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.touching || event.pointerType !== "touch") return;
      this.yaw -= (event.clientX - this.touchX) * 0.004;
      this.pitch = THREE.MathUtils.clamp(this.pitch - (event.clientY - this.touchY) * 0.004, -1.4, 1.4);
      this.touchX = event.clientX;
      this.touchY = event.clientY;
    });
    this.canvas.addEventListener("pointerup", () => { this.touching = false; });
  }

  setSpawn(spawn: SpawnPoint): void {
    this.position.set(spawn.x, spawn.y, spawn.z);
    this.velocity.set(0, 0, 0);
    this.yaw = spawn.yaw ?? Math.PI;
    this.pitch = 0;
    this.sprinting = false;
    this.sneaking = false;
    this.eyeHeight = EYE_HEIGHT;
  }

  lock(): void {
    if (matchMedia("(pointer: coarse)").matches) {
      this.enabled = true;
      return;
    }
    void this.canvas.requestPointerLock();
  }

  setMovement(code: string, active: boolean): void {
    if (active) this.keys.add(code);
    else this.keys.delete(code);
  }

  private toggleFly(): void {
    this.fly = !this.fly;
    this.velocity.y = 0;
  }

  private isFree(px: number, py: number, pz: number): boolean {
    for (let x = Math.floor(px - PLAYER_HALF_WIDTH); x <= Math.floor(px + PLAYER_HALF_WIDTH - 1e-7); x += 1) {
      for (let y = Math.floor(py); y <= Math.floor(py + PLAYER_HEIGHT - 1e-7); y += 1) {
        for (let z = Math.floor(pz - PLAYER_HALF_WIDTH); z <= Math.floor(pz + PLAYER_HALF_WIDTH - 1e-7); z += 1) {
          if (isSolid(this.world.getBlock(x, y, z))) return false;
        }
      }
    }
    return true;
  }

  private hasSupport(px: number, py: number, pz: number): boolean {
    const y = Math.floor(py - SUPPORT_PROBE);
    for (let x = Math.floor(px - PLAYER_HALF_WIDTH); x <= Math.floor(px + PLAYER_HALF_WIDTH - 1e-7); x += 1) {
      for (let z = Math.floor(pz - PLAYER_HALF_WIDTH); z <= Math.floor(pz + PLAYER_HALF_WIDTH - 1e-7); z += 1) {
        if (isSolid(this.world.getBlock(x, y, z))) return true;
      }
    }
    return false;
  }

  update(delta: number): void {
    if (this.enabled) {
      let side = Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) - Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
      let forward = Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) - Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
      const length = Math.hypot(side, forward) || 1;
      side /= length;
      forward /= length;
      const shift = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
      this.sneaking = shift && !this.fly;
      if (this.sneaking || forward <= 0) this.sprinting = false;
      const speed = this.fly
        ? this.sprinting ? FLY_SPRINT_SPEED : FLY_SPEED
        : this.sneaking ? SNEAK_SPEED : this.sprinting ? SPRINT_SPEED : WALK_SPEED;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      const targetX = (side * cos - forward * sin) * speed;
      const targetZ = (-side * sin - forward * cos) * speed;
      const rate = this.fly ? FLY_RATE : this.onGround ? GROUND_RATE : AIR_RATE;
      this.velocity.x = approach(this.velocity.x, targetX, rate, delta);
      this.velocity.z = approach(this.velocity.z, targetZ, rate, delta);
      if (targetX === 0 && Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0;
      if (targetZ === 0 && Math.abs(this.velocity.z) < 0.01) this.velocity.z = 0;
      if (this.fly) {
        const targetY = this.keys.has("Space") ? FLY_VERTICAL_SPEED : shift || this.keys.has("KeyC") ? -FLY_VERTICAL_SPEED : 0;
        this.velocity.y = approach(this.velocity.y, targetY, FLY_RATE, delta);
      } else {
        this.velocity.y = Math.max(TERMINAL_VELOCITY, this.velocity.y - GRAVITY * delta);
        if (this.keys.has("Space") && this.onGround) this.velocity.y = JUMP_VELOCITY;
      }

      const move = (axis: "x" | "y" | "z", distance: number) => {
        if (!distance) return;
        // sneaking on the ground refuses horizontal moves that would leave support
        const guard = axis !== "y" && this.sneaking && this.onGround && !this.fly;
        const step = Math.sign(distance) * Math.min(Math.abs(distance), 0.45);
        let remaining = distance;
        while (Math.abs(remaining) > 1e-8) {
          const amount = Math.abs(remaining) < Math.abs(step) ? remaining : step;
          const next = this.position.clone();
          next[axis] += amount;
          if (this.isFree(next.x, next.y, next.z) && (!guard || this.hasSupport(next.x, next.y, next.z))) {
            this.position[axis] += amount;
            remaining -= amount;
          } else {
            if (axis === "y") {
              if (distance < 0) this.onGround = true;
              this.velocity.y = 0;
            } else {
              this.velocity[axis] = 0;
            }
            break;
          }
        }
      };
      // y first so onGround is fresh for the sneak edge guard
      this.onGround = false;
      move("y", this.velocity.y * delta);
      move("x", this.velocity.x * delta);
      move("z", this.velocity.z * delta);
    }

    this.eyeHeight = approach(this.eyeHeight, this.sneaking ? SNEAK_EYE_HEIGHT : EYE_HEIGHT, EYE_RATE, delta);
    this.camera.position.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
  }
}
