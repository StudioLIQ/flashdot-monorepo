"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
}

export function usePullToRefresh({ onRefresh, threshold = 80 }: PullToRefreshOptions) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;
    startYRef.current = e.touches[0]?.clientY ?? null;
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (startYRef.current === null || refreshing) return;
      const el = containerRef.current;
      if (!el || el.scrollTop > 0) {
        startYRef.current = null;
        setPullDistance(0);
        return;
      }
      const dy = (e.touches[0]?.clientY ?? 0) - startYRef.current;
      if (dy > 0) {
        e.preventDefault();
        setPulling(true);
        setPullDistance(Math.min(dy * 0.5, threshold + 20));
      }
    },
    [refreshing, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    if (pullDistance >= threshold) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPulling(false);
    setPullDistance(0);
    startYRef.current = null;
  }, [pulling, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { containerRef, pulling, pullDistance, refreshing, threshold };
}
