import * as THREE from "three";
import type { SpawnPoint } from "../../content/types/catalog";
import { isSolid } from "../world/blocks";
import type { VoxelWorld } from "../world/VoxelWorld";

export class PlayerController {
  readonly position = new THREE.Vector3(0, 12, 24);
  readonly velocity = new THREE.Vector3();
  yaw = Math.PI;
  pitch = 0;
  fly = false;
  onGround = false;
  enabled = false;
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
      if ((event.target as HTMLElement | null)?.tagName === "INPUT") return;
      if (event.code === "KeyF" && !event.repeat) {
        this.fly = !this.fly;
        this.velocity.y = 0;
      }
      this.keys.add(event.code);
    });
    addEventListener("keyup", (event) => this.keys.delete(event.code));
    document.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== this.canvas) return;
      this.yaw -= event.movementX * 0.0024;
      this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.0024, -1.55, 1.55);
    });
    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === this.canvas;
      this.enabled = locked || matchMedia("(pointer: coarse)").matches;
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

  private isFree(px: number, py: number, pz: number): boolean {
    const width = 0.3;
    const height = 1.8;
    for (let x = Math.floor(px - width); x <= Math.floor(px + width - 1e-7); x += 1) {
      for (let y = Math.floor(py); y <= Math.floor(py + height - 1e-7); y += 1) {
        for (let z = Math.floor(pz - width); z <= Math.floor(pz + width - 1e-7); z += 1) {
          if (isSolid(this.world.getBlock(x, y, z))) return false;
        }
      }
    }
    return true;
  }

  update(delta: number): void {
    if (this.enabled) {
      let side = Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) - Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
      let forward = Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) - Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
      const length = Math.hypot(side, forward) || 1;
      side /= length;
      forward /= length;
      const sprint = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
      const speed = this.fly ? sprint ? 24 : 12 : sprint ? 7 : 4.3;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      this.velocity.x = (side * cos - forward * sin) * speed;
      this.velocity.z = (-side * sin - forward * cos) * speed;
      if (this.fly) {
        this.velocity.y = this.keys.has("Space") ? speed : this.keys.has("KeyC") ? -speed : 0;
      } else {
        this.velocity.y = Math.max(-50, this.velocity.y - 25 * delta);
        if (this.keys.has("Space") && this.onGround) this.velocity.y = 8.6;
      }

      const move = (axis: "x" | "y" | "z", distance: number) => {
        if (!distance) return;
        const step = Math.sign(distance) * Math.min(Math.abs(distance), 0.45);
        let remaining = distance;
        while (Math.abs(remaining) > 1e-8) {
          const amount = Math.abs(remaining) < Math.abs(step) ? remaining : step;
          const next = this.position.clone();
          next[axis] += amount;
          if (this.isFree(next.x, next.y, next.z)) {
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
      this.onGround = false;
      move("x", this.velocity.x * delta);
      move("z", this.velocity.z * delta);
      move("y", this.velocity.y * delta);
    }

    this.camera.position.set(this.position.x, this.position.y + 1.62, this.position.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
  }
}
