"use client";

import { useEffect, useState } from "react";

export function useScrollDirection(threshold = 64) {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    let previousY = window.scrollY;

    function handleScroll() {
      const currentY = window.scrollY;
      if (currentY <= threshold) {
        setIsHidden(false);
      } else if (currentY > previousY) {
        setIsHidden(true);
      } else if (currentY < previousY) {
        setIsHidden(false);
      }
      previousY = currentY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return isHidden;
}