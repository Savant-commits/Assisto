import { useEffect, useRef } from "react";

type Entry = { run: () => void };

const stack: Entry[] = [];

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  const top = stack[stack.length - 1];
  if (top) top.run();
}

export function useEscapeKey(active: boolean, onEscape: () => void) {
  const handlerRef = useRef(onEscape);

  useEffect(() => {
    handlerRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;

    const entry: Entry = { run: () => handlerRef.current() };
    stack.push(entry);
    if (stack.length === 1) {
      window.addEventListener("keydown", onKeyDown);
    }

    return () => {
      const index = stack.indexOf(entry);
      if (index !== -1) stack.splice(index, 1);
      if (stack.length === 0) {
        window.removeEventListener("keydown", onKeyDown);
      }
    };
  }, [active]);
}
