import { type FormEvent, useState } from "react";
import { CITY_CATALOG } from "../content/catalog";
import { useGameStore } from "./store";

export function TopBar() {
  const game = useGameStore((state) => state.game);
  const preset = useGameStore((state) => state.preset);
  const timeOfDay = useGameStore((state) => state.timeOfDay);
  const guestName = useGameStore((state) => state.guestName);
  const [query, setQuery] = useState("");

  const search = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    game?.searchPlace(query);
    setQuery("");
  };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-cube" aria-hidden="true" />
        <div><strong>DILLI BLOCKS</strong><small>REAL NCR · MINEABLE</small></div>
      </div>
      <div className="topbar-actions">
        <select
          className="glass-button"
          aria-label="Choose a district"
          value={preset?.id ?? "india-gate"}
          onChange={(event) => void game?.loadPreset(event.target.value)}
        >
          {CITY_CATALOG.map((city) => (
            <optgroup key={city.id} label={`${city.name} · ${city.region}`}>
              {city.presets.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.shortName}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <form onSubmit={search}>
          <input
            className="search-input"
            placeholder="Search districts…"
            aria-label="Search districts"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>
        <button
          type="button"
          className="glass-button"
          onClick={() => game?.setTimeOfDay(timeOfDay === "day" ? "night" : "day")}
        >
          {timeOfDay === "day" ? "Make it night" : "Make it day"}
        </button>
        <div className="guest-pill"><span /><b>{guestName}</b></div>
      </div>
    </header>
  );
}
