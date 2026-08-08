"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { playCorrectSound, playWrongSound } from "@/lib/sfx";

export type Verdict = "correct" | "incorrect";

const BULLET = 5;
const SCATTER_DOT = 8;
const INNER_RADIUS = 28;
const OUTER_RADIUS = 42;
const TICKS = 8;

const DARK_OFUDA = "color-mix(in srgb, var(--ofuda) 75%, #000)";
const DARK_GOLD = "color-mix(in srgb, var(--gold) 75%, #000)";

/**
 * DanmakuBurst — the verdict moment.
 *
 * Correct: a hit. Center flash, then a rotating spell circle and two
 * staggered bullet layers (the danmaku "double ring" beat).
 *
 * Incorrect: a miss. The franchise's MISS sign flicks up while the shot
 * collapses inward — energy dissipating instead of exploding.
 */
export function DanmakuBurst({
  x,
  y,
  verdict,
  onFadeOut,
}: {
  x: number;
  y: number;
  verdict: Verdict;
  onFadeOut: () => void;
}) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (verdict === "correct") playCorrectSound();
    else playWrongSound();
  }, [verdict]);

  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{ left: x, top: y }}
    >
      {verdict === "correct" ? (
        <>
          {/* Impact flash */}
          <motion.span
            initial={reduce ? false : { scale: 0, opacity: 1 }}
            animate={reduce ? { opacity: 0 } : { scale: 1.9, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute block rounded-full"
            style={{
              left: -8,
              top: -8,
              width: 16,
              height: 16,
              backgroundColor: DARK_GOLD,
            }}
          />

          {/* Spell circle — solid outer ring with rotating dashed core */}
          <motion.span
            initial={reduce ? false : { scale: 0.55, opacity: 1 }}
            animate={
              reduce
                ? { opacity: 0 }
                : { scale: 1, opacity: [1, 1, 0] }
            }
            transition={{ duration: 0.8, ease: "easeOut", times: [0, 0.7, 1] }}
            onAnimationComplete={onFadeOut}
            className="absolute block rounded-full"
            style={{
              left: -40,
              top: -40,
              width: 80,
              height: 80,
              border: "2px solid " + DARK_OFUDA,
            }}
          />
          <motion.span
            initial={reduce ? false : { scale: 0.6, rotate: 0, opacity: 1 }}
            animate={
              reduce
                ? { opacity: 0 }
                : { scale: 1, rotate: 70, opacity: [1, 1, 0] }
            }
            transition={{ duration: 0.66, ease: "easeOut", times: [0, 0.7, 1] }}
            className="absolute block rounded-full"
            style={{
              left: -30,
              top: -30,
              width: 60,
              height: 60,
              border: "2px dashed " + DARK_OFUDA,
            }}
          />

          {/* Double bullet layer — inner ofuda, outer gold, staggered */}
          {Array.from({ length: TICKS }).map((_, i) => {
            const angle = (i / TICKS) * Math.PI * 2;
            const inner = {
              dx: Math.cos(angle) * INNER_RADIUS,
              dy: Math.sin(angle) * INNER_RADIUS,
            };
            const outer = {
              dx: Math.cos(angle) * OUTER_RADIUS,
              dy: Math.sin(angle) * OUTER_RADIUS,
            };
            return (
              <span key={i}>
                <motion.span
                  initial={reduce ? false : { x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={
                    reduce
                      ? { opacity: 0 }
                      : {
                          x: inner.dx,
                          y: inner.dy,
                          scale: 1,
                          opacity: [1, 1, 0],
                        }
                  }
                  transition={{
                    duration: 0.7,
                    ease: "easeOut",
                    times: [0, 0.8, 1],
                  }}
                  className="absolute block rounded-full"
                  style={{
                    left: -BULLET / 2,
                    top: -BULLET / 2,
                    width: BULLET,
                    height: BULLET,
                    backgroundColor: DARK_OFUDA,
                  }}
                />
                <motion.span
                  initial={reduce ? false : { x: 0, y: 0, scale: 0, opacity: 0 }}
                  animate={
                    reduce
                      ? { opacity: 0 }
                      : {
                          x: outer.dx,
                          y: outer.dy,
                          scale: 1,
                          opacity: [0.5, 1, 0.25],
                        }
                  }
                  transition={{
                    duration: 0.7,
                    ease: "easeOut",
                    times: [0, 0.4, 1],
                    delay: 0.07,
                  }}
                  className="absolute block rounded-full"
                  style={{
                    left: -BULLET / 2,
                    top: -BULLET / 2,
                    width: BULLET,
                    height: BULLET,
              backgroundColor: DARK_GOLD,
                  }}
                />
              </span>
            );
          })}
        </>
      ) : (
        <>
          {/* The shot shatters — translucent white flecks scatter at random */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 40;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            return (
              <motion.span
                key={i}
                initial={reduce ? false : { x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={
                  reduce
                    ? { opacity: 0 }
                    : {
                        x: dx,
                        y: dy,
                        scale: 1,
                        opacity: [1, 1, 0],
                      }
                }
                transition={{
                  duration: 0.95,
                  ease: "easeOut",
                  times: [0, 0.8, 1],
                }}
                className="absolute block rounded-full"
                style={{
                  left: -SCATTER_DOT / 2,
                  top: -SCATTER_DOT / 2,
                  width: SCATTER_DOT,
                  height: SCATTER_DOT,
                  backgroundColor: "rgba(255, 255, 255, 1)",
                }}
              />
            );
          })}

          {/* The MISS sign — the franchise's own failure mark */}
          <motion.span
            initial={reduce ? { opacity: 0 } : { scale: 1.35, opacity: 0 }}
            animate={
              reduce
                ? { opacity: [0, 1, 1, 0] }
                : { scale: [1.35, 1, 1, 0.92], opacity: [0, 1, 1, 0] }
            }
            transition={{ duration: 1, times: [0, 0.2, 0.72, 1] }}
            onAnimationComplete={onFadeOut}
            className="absolute block rounded-sm text-center font-display tracking-[0.3em] text-paper text-lg"
            style={{ left: -55, top: -19, width: 110 }}
          >
            MISS
          </motion.span>
        </>
      )}
    </div>
  );
}
