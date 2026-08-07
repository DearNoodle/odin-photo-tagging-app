"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * AimMarker — the persistent "you clicked here" ring. Stays visible and
 * gently pulsing while the character dropdown is open so the player can
 * cross-reference the spot against the roster. Removed when the verdict fires.
 */
export function AimMarker({
  x,
  y,
  ringSize = 60,
}: {
  x: number;
  y: number;
  ringSize?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="pointer-events-none absolute z-20"
      style={{ left: x, top: y }}
    >
      {/* Aiming ring — clear, visible, gently pulsing */}
      <motion.span
        animate={
          reduce
            ? { opacity: 0.9 }
            : { scale: [1, 1.08, 1], opacity: [0.95, 0.7, 0.95] }
        }
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
        }
        className="absolute block rounded-full"
        style={{
          left: -ringSize / 2,
          top: -ringSize / 2,
          width: ringSize,
          height: ringSize,
          border: "2px solid var(--paper)",
          boxShadow: "0 0 0 1px var(--ofuda)",
        }}
      />
      {/* Center dot for precise reference */}
      <span
        className="absolute block rounded-full"
        style={{
          left: -3,
          top: -3,
          width: 6,
          height: 6,
          backgroundColor: "var(--ofuda)",
        }}
      />
    </motion.div>
  );
}