import { useGameStore } from "./store";

export function LoadingOverlay() {
  const loading = useGameStore((state) => state.loading);
  if (!loading.active) return null;
  return (
    <section className="loading-layer">
      <div className="loading-card">
        <span>GENERATING DISTRICT</span>
        <strong>{loading.stage}</strong>
        <div><i style={{ width: `${Math.round(loading.progress * 100)}%` }} /></div>
      </div>
    </section>
  );
}
