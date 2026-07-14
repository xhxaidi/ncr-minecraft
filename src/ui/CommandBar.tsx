import { useEffect, useRef, useState } from "react";
import { useGameStore } from "./store";

export function CommandBar() {
  const open = useGameStore((state) => state.commandOpen);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const { commandOpen, entered } = useGameStore.getState();
      if (event.code !== "KeyT" || commandOpen || !entered) return;
      if ((event.target as HTMLElement | null)?.tagName === "INPUT") return;
      event.preventDefault();
      document.exitPointerLock();
      useGameStore.setState({ commandOpen: true });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setValue("");
      inputRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const close = (submit: boolean) => {
    const { game, entered } = useGameStore.getState();
    if (submit && value.trim()) game?.execCommand(value);
    useGameStore.setState({ commandOpen: false });
    if (entered) game?.lock();
  };

  return (
    <div className="command-layer">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          close(true);
        }}
      >
        <span>›</span>
        <input
          ref={inputRef}
          value={value}
          placeholder='Try "make it night" or "goto cyber city"'
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") close(false);
          }}
        />
      </form>
    </div>
  );
}
