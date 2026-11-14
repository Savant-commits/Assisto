"use client";

import { useEffect, useMemo, useState } from "react";

export function useScrollDirection(threshold = 64, resetKey?: string) {
  const routeVersion = useMemo(() => ({ key: resetKey }), [resetKey]);
  const [hiddenState, setHiddenState] = useState({ hidden: false, routeVersion });

  useEffect(() => {
    let previousY = window.scrollY;

    function handleScroll() {
      const currentY = window.scrollY;
      if (currentY <= threshold) {
        setHiddenState({ hidden: false, routeVersion });
      } else if (currentY > previousY) {
        setHiddenState({ hidden: true, routeVersion });
      } else if (currentY < previousY) {
        setHiddenState({ hidden: false, routeVersion });
      }
      previousY = currentY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [routeVersion, threshold]);

  return hiddenState.routeVersion === routeVersion && hiddenState.hidden;
}