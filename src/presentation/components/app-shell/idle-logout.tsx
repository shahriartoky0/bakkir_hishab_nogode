"use client";

import { useEffect, useRef } from "react";
import { signOutAction } from "../../actions/auth";

const KEY = "baki:last-activity";
const EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "visibilitychange"] as const;

/**
 * Signs out after `minutes` without any interaction (spec 6.8, default 30 min).
 * Activity in any open tab counts (shared through localStorage).
 */
export function IdleLogout({ minutes }: { minutes: number }) {
  const signingOut = useRef(false);

  useEffect(() => {
    const limit = minutes * 60_000;
    let lastLocal = Date.now();
    const read = () => {
      try {
        return Number(localStorage.getItem(KEY)) || lastLocal;
      } catch {
        return lastLocal;
      }
    };
    const touch = () => {
      lastLocal = Date.now();
      try {
        localStorage.setItem(KEY, String(lastLocal));
      } catch {
        // storage unavailable: per-tab tracking only
      }
    };
    touch();
    for (const e of EVENTS) window.addEventListener(e, touch, { passive: true });

    const timer = window.setInterval(() => {
      const last = Math.max(read(), lastLocal);
      if (!signingOut.current && Date.now() - last > limit) {
        signingOut.current = true;
        void signOutAction();
      }
    }, 30_000);

    return () => {
      window.clearInterval(timer);
      for (const e of EVENTS) window.removeEventListener(e, touch);
    };
  }, [minutes]);

  return null;
}
