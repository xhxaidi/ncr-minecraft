import { BLOCK_COLORS, BLOCK_NAMES, HOTBAR_BLOCKS } from "../engine/world/blocks";
import { useGameStore } from "./store";

export function HUD() {
  const game = useGameStore((state) => state.game);
  const fps = useGameStore((state) => state.fps);
  const coords = useGameStore((state) => state.coords);
  const selectedSlot = useGameStore((state) => state.selectedSlot);
  const toast = useGameStore((state) => state.toast);
  const preset = useGameStore((state) => state.preset);

  const hold = (code: string) => ({
    onPointerDown: () => game?.setMovement(code, true),
    onPointerUp: () => game?.setMovement(code, false),
    onPointerCancel: () => game?.setMovement(code, false),
    onPointerLeave: () => game?.setMovement(code, false),
  });

  return (
    <>
      <div id="crosshair" aria-hidden="true" />

      <section className="location-card" aria-live="polite">
        <span>{preset?.source ?? "YOU ARE EXPLORING"}</span>
        <strong>{preset?.name ?? "Loading…"}</strong>
        <small>{preset?.description ?? "Loading real map data…"}</small>
        <b>{preset?.stats ?? ""}</b>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          Map data © OpenStreetMap contributors
        </a>
      </section>

      <div className="telemetry">
        <span>{fps} FPS</span>
        <span>x {coords.x} · y {coords.y} · z {coords.z}</span>
      </div>

      <div className="toast" aria-live="polite">{toast}</div>

      <div className="hotbar" aria-label="Block selection">
        {HOTBAR_BLOCKS.map((block, index) => {
          const [r, g, b] = BLOCK_COLORS[block] ?? [255, 0, 255];
          return (
            <button
              key={block}
              type="button"
              className={`hotbar-slot${index === selectedSlot ? " active" : ""}`}
              title={BLOCK_NAMES[block]}
              onClick={() => game?.selectSlot(index)}
            >
              <i style={{ background: `rgb(${r},${g},${b})` }} />
              <kbd>{index + 1}</kbd>
            </button>
          );
        })}
      </div>

      <div className="controls-card">
        <span><kbd>WASD</kbd> Move</span>
        <span><kbd>SPACE</kbd> Jump</span>
        <span><kbd>F</kbd> Fly</span>
        <span><kbd>T</kbd> Command</span>
        <span><kbd>P</kbd> Photo mode</span>
        <span><kbd>CLICK</kbd> Mine</span>
        <span><kbd>RIGHT CLICK</kbd> Build</span>
      </div>

      <div className="touch-controls" aria-label="Touch controls">
        <div className="touch-dpad">
          <button {...hold("KeyW")} aria-label="Move forward">↑</button>
          <button {...hold("KeyA")} aria-label="Move left">←</button>
          <button {...hold("KeyS")} aria-label="Move backward">↓</button>
          <button {...hold("KeyD")} aria-label="Move right">→</button>
        </div>
        <div className="touch-actions">
          <button type="button" onClick={() => game?.mine()}>Mine</button>
          <button type="button" onClick={() => game?.build()}>Build</button>
        </div>
      </div>
    </>
  );
}
