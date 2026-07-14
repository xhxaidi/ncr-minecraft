import { create } from "zustand";
import type { Game, GameEvents, PresetInfo } from "../engine/game";
import type { TimeOfDay } from "../engine/lighting";

type UIState = {
  game: Game | null;
  guestName: string;
  entered: boolean;
  locked: boolean;
  commandOpen: boolean;
  uiHidden: boolean;
  selectedSlot: number;
  fps: number;
  coords: GameEvents["coords"];
  timeOfDay: TimeOfDay;
  toast: string;
  loading: GameEvents["loading"];
  preset: PresetInfo | null;
};

export const useGameStore = create<UIState>(() => ({
  game: null,
  guestName: localStorage.getItem("dilli-blocks-guest") ?? "Guest Explorer",
  entered: false,
  locked: false,
  commandOpen: false,
  uiHidden: false,
  selectedSlot: 0,
  fps: 0,
  coords: { x: 0, y: 0, z: 0 },
  timeOfDay: "day",
  toast: "Loading voxel engine",
  loading: { active: true, stage: "Preparing voxel terrain", progress: 0 },
  preset: null,
}));

export function bindGameToStore(game: Game): void {
  const set = useGameStore.setState;
  set({ game });
  game.on("fps", (fps) => set({ fps }));
  game.on("coords", (coords) => set({ coords }));
  game.on("loading", (loading) => set({ loading }));
  game.on("preset", (preset) => set({ preset }));
  game.on("toast", (toast) => set({ toast }));
  game.on("slot", (selectedSlot) => set({ selectedSlot }));
  game.on("timeofday", (timeOfDay) => set({ timeOfDay }));
  game.on("locked", (locked) => set({ locked }));
  game.on("uihidden", (uiHidden) => set({ uiHidden }));
}
