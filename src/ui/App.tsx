import { type FormEvent, useEffect, useRef, useState } from "react";
import { Game } from "../engine/game";
import { CommandBar } from "./CommandBar";
import { HUD } from "./HUD";
import { LoadingOverlay } from "./LoadingOverlay";
import { bindGameToStore, useGameStore } from "./store";
import { TopBar } from "./TopBar";

const COARSE = matchMedia("(pointer: coarse)").matches;

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas);
    bindGameToStore(game);
    if (import.meta.env.DEV) {
      Object.assign(window, { __game: game, __store: useGameStore });
    }
    void game.start();
    return () => {
      game.dispose();
      useGameStore.setState({ game: null });
    };
  }, []);

  const game = useGameStore((state) => state.game);
  const entered = useGameStore((state) => state.entered);
  const locked = useGameStore((state) => state.locked);
  const uiHidden = useGameStore((state) => state.uiHidden);

  return (
    <>
      <canvas
        id="game"
        ref={canvasRef}
        aria-label="Playable voxel world"
        onClick={() => {
          if (entered && !locked) game?.lock();
        }}
      />
      {!uiHidden && (
        <>
          <TopBar />
          <HUD />
          <CommandBar />
          {!entered && <Welcome />}
          {entered && !COARSE && <Pause />}
          <LoadingOverlay />
        </>
      )}
    </>
  );
}

function Welcome() {
  const game = useGameStore((state) => state.game);
  const guestName = useGameStore((state) => state.guestName);
  const [name, setName] = useState(guestName);

  const enter = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim().slice(0, 20) || "Guest Explorer";
    localStorage.setItem("dilli-blocks-guest", trimmed);
    useGameStore.setState({ guestName: trimmed, entered: true });
    game?.lock();
  };

  return (
    <section className="welcome-layer">
      <div className="welcome-card">
        <span className="eyebrow">OPENSTREETMAP → VOXEL WORLD</span>
        <h1>Real NCR.<br /><em>Every block mineable.</em></h1>
        <p>
          Walk real Delhi and Gurugram roads, explore handcrafted monuments,
          then break and rebuild the city directly in your browser.
        </p>
        <form onSubmit={enter}>
          <label htmlFor="guest-name">Choose a guest name</label>
          <div className="guest-entry">
            <input
              id="guest-name"
              maxLength={20}
              value={name}
              autoComplete="nickname"
              onChange={(event) => setName(event.target.value)}
            />
            <button type="submit">Enter Old Delhi <span>→</span></button>
          </div>
        </form>
        <div className="welcome-points">
          <span>Real map footprints</span><span>Mineable landmarks</span><span>No account needed</span>
        </div>
      </div>
      <div className="welcome-index"><b>05</b><span>WORLDS<br />DELHI + GURUGRAM</span></div>
    </section>
  );
}

function Pause() {
  const game = useGameStore((state) => state.game);
  const locked = useGameStore((state) => state.locked);
  const commandOpen = useGameStore((state) => state.commandOpen);
  const loadingActive = useGameStore((state) => state.loading.active);
  const [wasLocked, setWasLocked] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (locked) {
      setWasLocked(true);
      setDismissed(false);
    }
  }, [locked]);

  if (locked || !wasLocked || dismissed || commandOpen || loadingActive) return null;
  return (
    <section className="pause-layer">
      <div>
        <span>EXPLORATION PAUSED</span>
        <h2>Return to the city?</h2>
        <button type="button" onClick={() => game?.lock()}>Continue exploring</button>
        <button type="button" className="secondary-button" onClick={() => setDismissed(true)}>
          Choose another district
        </button>
        <small>Press Esc to release your cursor.</small>
      </div>
    </section>
  );
}
