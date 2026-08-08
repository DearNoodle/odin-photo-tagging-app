"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getThumb } from "@/lib/character-thumbs";
import { BLUR_HERO } from "@/lib/image-blurs";
import { setSoundMuted, playWrongSound, playTimeoutSound } from "@/lib/sfx";
import { type DifficultyId } from "@/lib/game/session-utils";
import { GameTimer } from "./GameTimer";
import { AimMarker } from "./AimMarker";
import { DanmakuBurst, type Verdict } from "./DanmakuBurst";
import { CharacterDropdown } from "./CharacterDropdown";
import { WinModal } from "./WinModal";

export type ClickPoint = {
  normalX: number;
  normalY: number;
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
  ringSize: number;
  key: number;
};

type Burst = { x: number; y: number; verdict: Verdict; key: number } | null;

/** Lunatic idle penalty: a 15s window without any selection restores one find. */
const LUNATIC_IDLE_MS = 15000;

/** Hold the full window after a reset before the countdown starts ticking. */
const IDLE_RESET_GRACE_MS = 500;

/** Deterministic 0..1 hash of an integer — one random tilt per second, stable within it. */
function pseudoRandom(n: number): number {
  let x = n >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * Fade keyframes within each second (ms → opacity): hidden (0) around the
 * second boundary, visible (1) through mid-second. Only 0 and 1 are ever
 * keyframed; the segments between them interpolate linearly. The timeline
 * wraps around 1000ms (the dip straddles 0ms, half a second off the swell).
 */
const FADE_KEYFRAMES: [number, number][] = [
  [25, 0],
  [300, 1],
  [700, 1],
  [975, 0],
];

function fadeAt(ms: number): number {
  // Wrapped head: [0, 25) belongs to the tail of the previous second.
  if (ms < FADE_KEYFRAMES[0][0]) {
    const [t0, v0] = FADE_KEYFRAMES[FADE_KEYFRAMES.length - 1];
    const [t1, v1] = FADE_KEYFRAMES[0];
    return v0 + ((v1 - v0) * (ms + 1000 - t0)) / (t1 + 1000 - t0);
  }
  for (let i = 1; i < FADE_KEYFRAMES.length; i++) {
    const [t0, v0] = FADE_KEYFRAMES[i - 1];
    const [t1, v1] = FADE_KEYFRAMES[i];
    if (ms <= t1) return v0 + ((v1 - v0) * (ms - t0)) / (t1 - t0);
  }
  // Wrapped tail: [975, 1000) leads into the head of the next second.
  const [t0, v0] = FADE_KEYFRAMES[FADE_KEYFRAMES.length - 1];
  const [t1, v1] = FADE_KEYFRAMES[0];
  return v0 + ((v1 - v0) * (ms - t0)) / (t1 + 1000 - t0);
}

type SessionPayload = {
  sessionId: string;
  difficulty: DifficultyId;
  pool: string[];
  clicked: Record<string, boolean>;
  active: string[];
  finished: boolean;
  totalClicks?: number;
  correctClicks?: number;
};

const DIFFICULTY_OPTIONS: {
  id: DifficultyId;
  label: string;
  hint: string;
  description: string;
}[] = [
  {
    id: "easy",
    label: "Easy",
    hint: "5 characters",
    description: "Eeeh? Easy Modo?!",
  },
  {
    id: "normal",
    label: "Normal",
    hint: "20 characters",
    description: "You'll be fine. Probably.",
  },
  {
    id: "hard",
    label: "Hard",
    hint: "40 characters",
    description: "This is where the fun begins.",
  },
  {
    id: "lunatic",
    label: "Lunatic",
    hint: "Every character",
    description: "Welcome to Hell... or Moon?",
  },
];

export function GameBoard() {
  const router = useRouter();
  const boardRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const [difficulty, setDifficulty] = useState<DifficultyId | null>(null);
  const [target, setTarget] = useState(0);
  const [active, setActive] = useState<string[]>([]);
  const [stripShuffled, setStripShuffled] = useState(false);
  const [shuffleTick, setShuffleTick] = useState(0);
  const [found, setFound] = useState<string[]>([]);
  const [click, setClick] = useState<ClickPoint | null>(null);
  const [burst, setBurst] = useState<Burst>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuEnabled, setMenuEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [finished, setFinished] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [started, setStarted] = useState(false);
  const [beginning, setBeginning] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [penalty, setPenalty] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [correctClicks, setCorrectClicks] = useState(0);
  const submittingRef = useRef(false);
  const nameSubmitRef = useRef(false);
  const rerollRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const timeoutInFlightRef = useRef(false);
  const lastTickSecondRef = useRef(-1);
  const [idleLeft, setIdleLeft] = useState<number | null>(null);
  const [restoredName, setRestoredName] = useState<string | null>(null);
  const [timeoutFlashKey, setTimeoutFlashKey] = useState(0);
  const boardControls = useAnimationControls();

  // Idle-timer motion locked to the countdown's seconds: one full
  // swell/tilt/fade cycle per 1000ms, peaking on the same beat as the
  // per-second tick sound, then fading back out with it.
  const idleScale = useMotionValue(1);
  const idleRotate = useMotionValue(0);
  const idleOpacity = useMotionValue(1);
  useAnimationFrame(() => {
    const counting = started && difficulty === "lunatic" && !finished;
    if (!counting || reduceMotion) return;
    const danger = idleLeft !== null && idleLeft <= 5000;
    const elapsed = Date.now() - lastActivityRef.current;
    const phase = elapsed % 1000;
    const ang = (phase / 1000) * Math.PI * 2;
    const r = pseudoRandom(Math.floor(elapsed / 1000));
    const tiltDir = r > 0.5 ? 1 : -1;
    const tiltAmp = danger ? 7 : 2.2;
    const s = Math.sin(ang);
    // Shrink harder than it grows — the danger beat visibly collapses.
    const grow = danger ? 0.24 : 0.07;
    const shrink = danger ? 0.38 : 0.1;
    idleScale.set(1 + (s >= 0 ? grow : shrink) * s);
    idleRotate.set(tiltDir * tiltAmp * Math.sin(ang));
    // Gradual fade per second, keyframed at 0 / 100 / 500 / 900ms.
    idleOpacity.set(danger ? fadeAt(phase) : 1);
  });

  useEffect(() => {
    const stored = window.localStorage.getItem("menu-enabled");
    if (stored !== null) setMenuEnabled(stored === "on");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("menu-enabled", menuEnabled ? "on" : "off");
  }, [menuEnabled]);

  useEffect(() => {
    const stored = window.localStorage.getItem("sound-enabled");
    if (stored !== null) setSoundEnabled(stored === "on");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("sound-enabled", soundEnabled ? "on" : "off");
    setSoundMuted(!soundEnabled);
  }, [soundEnabled]);

  function toggleMenu() {
    setMenuEnabled((prev) => !prev);
    setDropdownOpen(false);
  }

  const IS_DEV = process.env.NODE_ENV === "development";

  /** Finish flow: dev auto-posts and skips the name box; prod asks for a name. */
  function handleFinished() {
    setFinished(true);
    setTimeout(() => {
      if (IS_DEV) {
        router.push(`/leaderboard?difficulty=${difficulty}`);
      } else {
        setShowModal(true);
      }
    }, 750);
  }

  async function handleBegin(chosen: DifficultyId) {
    if (beginning) return;
    setBeginning(true);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: chosen }),
      });
      if (!res.ok) throw new Error();
      const data: SessionPayload = await res.json();
      setDifficulty(data.difficulty);
      setTarget(data.pool.length);
      setActive(data.active);
      setStripShuffled(false);
      setFound(
        Object.entries(data.clicked)
          .filter(([, v]) => v)
          .map(([k]) => k),
      );
      setTotalClicks(data.totalClicks ?? 0);
      setCorrectClicks(data.correctClicks ?? 0);
      setStarted(true);
      touchActivity();
      if (data.finished) {
        handleFinished();
      }
    } catch {
      setSessionError(true);
    } finally {
      setBeginning(false);
    }
  }

  function handleBoardClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!started || finished || sessionError) return;
    // A bare board click (aim circle + dropdown) is not a selection —
    // only an actual choice from the pop-up or the strip resets the
    // idle window.
    const el = boardRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const bLeft = parseFloat(style.borderLeftWidth);
    const bRight = parseFloat(style.borderRightWidth);
    const bTop = parseFloat(style.borderTopWidth);
    const bBottom = parseFloat(style.borderBottomWidth);
    const innerW = rect.width - bLeft - bRight;
    const innerH = rect.height - bTop - bBottom;

    const x = event.clientX - rect.left - bLeft;
    const y = event.clientY - rect.top - bTop;
    // The 8px edge frame is unclickable — snap clicks inside it to the
    // closest clickable spot instead of ignoring them.
    const margin = 8;
    const nx = Math.min(Math.max(x, margin), innerW - margin);
    const ny = Math.min(Math.max(y, margin), innerH - margin);

    // Snap to the device pixel grid so the burst lands dead-center under
    // the cursor instead of on a fractional pixel.
    const dpr = window.devicePixelRatio || 1;
    const snap = (v: number) => Math.round(v * dpr) / dpr;

    // Visible aim ring — sized to read clearly against the scene.
    const ringSize = Math.max(54, Math.round(innerH * 0.06));
    const key = Date.now();
    setClick({
      normalX: nx / innerW,
      normalY: ny / innerH,
      boardX: snap(nx),
      boardY: snap(ny),
      boardW: innerW,
      boardH: innerH,
      ringSize,
      key,
    });
    setBurst(null);
    setDropdownOpen(true);
  }

  /** Board shake + red vignette — the universal penalty visuals. */
  const triggerShake = useCallback(() => {
    if (!reduceMotion) {
      void boardControls.start({
        x: [0, -7, 7, -5, 5, -2, 2, 0],
        transition: { duration: 0.3, ease: "easeInOut" },
      });
    }
    setTimeoutFlashKey((k) => k + 1);
  }, [boardControls, reduceMotion]);

  /** Red pulse ring around a restored character card. */
  const showRestoredRing = useCallback((restored: string) => {
    setRestoredName(restored);
    window.setTimeout(() => {
      setRestoredName((n) => (n === restored ? null : n));
    }, 1800);
  }, []);

  const showPenalty = useCallback(
    (restored?: string) => {
      triggerShake();
      if (restored) showRestoredRing(restored);
    },
    [triggerShake, showRestoredRing],
  );

  async function handleSelect(character: string) {
    if (!click || submittingRef.current) return;
    submittingRef.current = true;
    // No touchActivity here: the idle window must not start until the
    // server has answered — API latency must not burn countdown time. The
    // tick holds the full window while this request is in flight.
    const { normalX, normalY, boardX, boardY, key } = click;
    setDropdownOpen(false);

    try {
      const res = await fetch("/api/click", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ normalX, normalY, character }),
      });
      const data = await res.json();

      const verdict: Verdict =
        data.result === "correct" ? "correct" : "incorrect";
      setBurst({ x: boardX, y: boardY, verdict, key: key + 1 });
      setTotalClicks(data.totalClicks ?? totalClicks);
      setCorrectClicks(data.correctClicks ?? correctClicks);

      if (data.result === "correct") {
        setFound((prev) =>
          prev.includes(character) ? prev : [...prev, character],
        );
        setActive((prev) => {
          const next = prev.filter((name) => name !== character);
          if (data.replacement && !next.includes(data.replacement)) {
            next.push(data.replacement);
          }
          return next;
        });
        setStripShuffled(false);
        if (data.finished) {
          handleFinished();
        }
      } else if (Array.isArray(data.active)) {
        if (data.restored) {
          setFound((prev) => prev.filter((name) => name !== data.restored));
        }
        // The server only returns a different window when it actually
        // reshuffled the pool — treat that as a shuffle event.
        const next: string[] = data.active;
        const changed =
          next.length !== active.length ||
          next.some((name, i) => name !== active[i]);
        if (changed) {
          setShuffleTick((tick) => tick + 1);
          setStripShuffled(true);
          setActive(next);
        }
        // Penalty visuals on every miss, whatever the difficulty — shake
        // and vignette always; the restored ring when one came back.
        showPenalty(data.restored);
      }
    } catch {
      setBurst({ x: boardX, y: boardY, verdict: "incorrect", key: key + 1 });
    } finally {
      submittingRef.current = false;
      touchActivity();
    }
  }

  async function handleNameSubmit(name: string) {
    if (nameSubmitRef.current) return;
    nameSubmitRef.current = true;
    try {
      await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    } finally {
      router.push(`/leaderboard?difficulty=${difficulty}`);
    }
  }

  async function handleReroll() {
    if (rerollRef.current) return;
    rerollRef.current = true;
    try {
      const res = await fetch("/api/reroll", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      setActive(data.active as string[]);
      setFound([]);
      setPenalty(data.penaltySeconds as number);
      setShuffleTick((tick) => tick + 1);
      setStripShuffled(true);
    } finally {
      rerollRef.current = false;
    }
  }

  /**
   * Restart the Lunatic idle window — called only once the server has
   * answered a selection or penalty (never at dispatch, so latency cannot
   * burn countdown time). The full 15s is held for a beat
   * (`IDLE_RESET_GRACE_MS`) so the reset reads as feedback before the
   * countdown starts ticking down again.
   */
  function touchActivity() {
    lastActivityRef.current = Date.now();
  }

  /**
   * Lunatic idle penalty. The window restarts when the server has answered,
   * not when the request is sent — the tick holds the full window while the
   * request is in flight, so a slow response never re-triggers the penalty
   * or sits at zero while waiting; the ref lock prevents overlapping
   * requests. `firedAt` lets the server cancel the penalty if the player
   * acted after it was dispatched (e.g. a selection sent before the timer
   * ended, still in flight).
   */
  useEffect(() => {
    if (!started || difficulty !== "lunatic" || finished) {
      setIdleLeft(null);
      return;
    }

    async function fireTimeoutPenalty() {
      if (timeoutInFlightRef.current) return;
      timeoutInFlightRef.current = true;
      const firedAt = Date.now();
      // The penalty is deterministic the moment the countdown hits zero —
      // shake, vignette and wrong-click sound play right away instead of
      // waiting for the server. Only the restore/shuffle state (and the
      // restored ring, which needs the character name) land with the
      // response.
      playWrongSound();
      triggerShake();
      try {
        const res = await fetch("/api/timeout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firedAt }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.restored) {
          setFound((prev) => prev.filter((name) => name !== data.restored));
          showRestoredRing(data.restored);
        }
        if (Array.isArray(data.active)) {
          const next: string[] = data.active;
          const changed =
            next.length !== active.length ||
            next.some((name, i) => name !== active[i]);
          if (changed) {
            setShuffleTick((tick) => tick + 1);
            setStripShuffled(true);
            setActive(next);
          }
        }
      } catch {
        // A failed penalty is skipped until the next idle window.
      } finally {
        timeoutInFlightRef.current = false;
        touchActivity();
      }
    }

    const tick = () => {
      const now = Date.now();
      const since = now - lastActivityRef.current;
      // A selection or penalty request in flight: hold the full window —
      // API latency must not burn idle time. The reset grace begins only
      // once the server has answered.
      if (submittingRef.current || timeoutInFlightRef.current) {
        setIdleLeft(LUNATIC_IDLE_MS);
        lastTickSecondRef.current = -1;
        return;
      }
      // Reset feedback: hold the full window for `IDLE_RESET_GRACE_MS`
      // before the countdown resumes, then tick down from 15s.
      const left =
        since < IDLE_RESET_GRACE_MS
          ? LUNATIC_IDLE_MS
          : LUNATIC_IDLE_MS - (since - IDLE_RESET_GRACE_MS);
      setIdleLeft(Math.max(0, Math.ceil(left)));
      // One blip per second once the countdown enters its final 5 seconds.
      const second = Math.ceil(left / 1000);
      if (left <= 5000 && left > 0 && second !== lastTickSecondRef.current) {
        lastTickSecondRef.current = second;
        playTimeoutSound();
      } else if (left > 5000) {
        lastTickSecondRef.current = -1;
      }
      if (left <= 0) void fireTimeoutPenalty();
    };
    const id = window.setInterval(tick, 90);
    tick();
    return () => window.clearInterval(id);
  }, [started, difficulty, finished, active, triggerShake, showRestoredRing]);

  return (
    <main className="min-h-screen mx-auto max-w-5xl px-4 py-6 sm:py-8 flex flex-col gap-3 sm:gap-4">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-line/70 pb-3">
        <button
          type="button"
          title="Start Menu"
          aria-label="Start Menu"
          onClick={async () => {
            await fetch("/api/session", { method: "DELETE" }).catch(() => {});
            window.location.href = "/";
          }}
          className="justify-self-start cursor-pointer text-soft hover:text-ofuda transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
            <path d="M10 21v-6h4v6" />
          </svg>
        </button>
        <GameTimer running={started && !finished} penalty={penalty} />
        <Link
          href="/leaderboard"
          className="justify-self-end font-display tracking-[0.2em] text-xs sm:text-sm text-ofuda hover:underline underline-offset-4"
        >
          RANKING →
        </Link>
      </header>

      <section aria-label="Characters to find">
        <div className="flex items-center justify-between mb-2">
          <p className="font-display tracking-[0.18em] text-soft text-[10px] sm:text-xs uppercase">
            Find
          </p>
          {started && (
            <div className="flex items-center gap-3">
              {totalClicks > 0 && (
                <p className="font-display tracking-[0.18em] text-gold text-[10px] sm:text-xs uppercase tabular-nums">
                  ACC{" "}
                  {Math.round((correctClicks / totalClicks) * 100)}
                  %
                </p>
              )}
              <p className="font-display tracking-[0.18em] text-soft text-[10px] sm:text-xs uppercase tabular-nums">
                {found.length} / {target}
              </p>
            </div>
          )}
        </div>
        <ul className="flex flex-wrap justify-center gap-5 sm:gap-8">
          <AnimatePresence mode="popLayout" initial={false}>
            {active.map((name, index) => {
              const thumb = getThumb(name);
              const shuffling = stripShuffled;
              const spin = index % 2 === 0 ? -10 : 10;
              const isRestored = name === restoredName;
              return (
                <motion.li
                  key={`${name}-${shuffleTick}`}
                  layout
                  initial={
                    shuffling
                      ? { opacity: 0, y: -18, scale: 0.5, rotate: spin }
                      : { opacity: 0, x: 48 }
                  }
                  animate={
                    shuffling
                      ? { opacity: 1, y: 0, scale: 1, rotate: 0 }
                      : { opacity: 1, x: 0 }
                  }
                  exit={{
                    opacity: 0,
                    scale: 0.5,
                    rotate: shuffling ? -spin : 0,
                    transition: { duration: 0.15 },
                  }}
                  transition={
                    shuffling
                      ? {
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                          delay: index * 0.06,
                        }
                      : { duration: 0.28, ease: "easeOut" }
                  }
                  onClick={() => {
                    if (dropdownOpen && click) handleSelect(name);
                  }}
                  title={dropdownOpen && click ? `Select ${name}` : undefined}
                  className={`flex flex-col items-center gap-1.5 ${
                    dropdownOpen && click ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  <motion.div
                    animate={{
                      boxShadow: isRestored
                        ? [
                            "0 0 0 0 rgba(230, 90, 79, 0.75)",
                            "0 0 0 8px rgba(230, 90, 79, 0)",
                          ]
                        : dropdownOpen && click
                          ? [
                              "0 0 0 0 rgba(230, 90, 79, 0.5)",
                              "0 0 0 6px rgba(230, 90, 79, 0)",
                            ]
                          : "0 0 0 0 rgba(230, 90, 79, 0)",
                    }}
                    transition={
                      isRestored
                        ? { repeat: Infinity, duration: 0.9, ease: "easeOut" }
                        : dropdownOpen && click
                          ? { repeat: Infinity, duration: 1.1, ease: "easeOut" }
                          : { duration: 0.2 }
                    }
                    className="rounded-sm"
                  >
                    <Image
                      src={thumb?.src ?? "/img/characters/Cirno.jpg"}
                      alt={name}
                      width={80}
                      height={80}
                      placeholder={thumb ? "blur" : undefined}
                      blurDataURL={thumb?.blurDataUrl}
                      className={`rounded-sm border border-line object-contain aspect-[3/5] w-14 sm:w-20 bg-white py-1 transition-transform hover:scale-105 ${
                        name === "Utsuho Reiuji" ? "object-cover" : ""
                      }`}
                    />
                  </motion.div>
                  <p
                    className={`font-display text-[10px] sm:text-xs text-center leading-tight max-w-14 sm:max-w-20 transition-colors ${
                      dropdownOpen && click
                        ? "text-ofuda underline decoration-ofuda/50 underline-offset-2"
                        : "text-ink"
                    }`}
                  >
                    {name}
                  </p>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </section>

      <figure className="mt-1">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-1.5">
          <button
            type="button"
            role="switch"
            aria-checked={soundEnabled}
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="justify-self-start flex items-center gap-1.5 rounded-sm border border-line bg-surface px-1.5 py-1.5 cursor-pointer select-none group"
            title="Sound"
          >
            <span
              className={`${
                soundEnabled ? "text-ink" : "text-soft"
              } group-hover:text-ink transition-colors`}
            >
              {soundEnabled ? (
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon
                    points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                    fill="currentColor"
                    stroke="none"
                  />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon
                    points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                    fill="currentColor"
                    stroke="none"
                  />
                  <line x1="16" y1="9" x2="22" y2="15" />
                  <line x1="22" y1="9" x2="16" y2="15" />
                </svg>
              )}
            </span>
            <span
              className={`relative inline-flex w-9 h-5 rounded-full border transition-colors ${
                soundEnabled ? "bg-ofuda border-ofuda" : "bg-bg border-line"
              }`}
            >
              <span
                className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-paper shadow transition-all ${
                  soundEnabled ? "left-[18px]" : "left-[2px]"
                }`}
              />
            </span>
          </button>

          {difficulty === "easy" && started && !finished ? (
            <button
              type="button"
              onClick={handleReroll}
              className="rounded-sm border border-line bg-surface px-2 py-1 font-display tracking-[0.14em] text-[9px] sm:text-[10px] uppercase text-soft transition-colors hover:border-ofuda hover:text-ofuda cursor-pointer"
              title="New 5 characters from the full roster (+30s)"
            >
              Reroll (+30s)
            </button>
          ) : difficulty === "lunatic" && started && !finished && idleLeft !== null ? (
            <span
              role="timer"
              title="15s without a selection restores a random found character"
              className="justify-self-center flex flex-col items-center px-2 py-1"
            >
              <span className="flex items-end h-9 sm:h-10">
                <span className="flex items-baseline gap-0.5 leading-none">
                  <motion.span
                    style={{ scale: idleScale, rotate: idleRotate, opacity: idleOpacity }}
                    className={`font-display tabular-nums text-center leading-none transition-all px-1 py-1 will-change-transform ${
                      idleLeft <= 5000
                        ? "text-ofuda text-3xl sm:text-4xl"
                        : "text-ink text-2xl sm:text-3xl"
                    }`}
                  >
                    {(idleLeft / 1000).toFixed(1)}
                  </motion.span>
                  <span
                    className={`font-display text-sm sm:text-base transition-colors ${
                      idleLeft <= 5000 ? "text-ofuda" : "text-soft"
                    }`}
                  >
                    s
                  </span>
                </span>
              </span>
              <span className="mt-0.5 block h-0.5 w-full overflow-hidden rounded-full bg-line/60">
                <span
                  className={`block h-full rounded-full transition-[width] duration-300 ease-linear ${
                    idleLeft <= 5000 ? "bg-ofuda" : "bg-gold"
                  }`}
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, (idleLeft / LUNATIC_IDLE_MS) * 100)
                    )}%`,
                  }}
                />
              </span>
            </span>
          ) : (
            <span aria-hidden="true" />
          )}

          <button
            type="button"
            role="switch"
            aria-checked={menuEnabled}
            onClick={toggleMenu}
            className="justify-self-end flex items-center gap-2 rounded-sm border border-line bg-surface px-2 py-1.5 cursor-pointer select-none group"
            title="Pop-Up Selection"
          >
            <span className="font-display tracking-[0.14em] text-[9px] sm:text-[10px] uppercase text-soft group-hover:text-ink transition-colors">
              Pop-Up Selection
            </span>
            <span
              className={`relative inline-flex w-9 h-5 rounded-full border transition-colors ${
                menuEnabled ? "bg-ofuda border-ofuda" : "bg-bg border-line"
              }`}
            >
              <span
                className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-paper shadow transition-all ${
                  menuEnabled ? "left-[18px]" : "left-[2px]"
                }`}
              />
            </span>
          </button>
        </div>

        <motion.div
          ref={boardRef}
          animate={boardControls}
          onClick={handleBoardClick}
          className="relative w-full aspect-[2893/1158] rounded-sm overflow-hidden cursor-crosshair scroll-frame bg-surface"
        >
          <Image
            src="/img/background/touhou_full.jpg"
            alt="Touhou scene with five hidden characters"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 1024px"
            placeholder="blur"
            blurDataURL={BLUR_HERO}
            className="select-none"
            draggable={false}
          />

          {/* Red danger vignette — one pulse when the idle penalty lands */}
          {timeoutFlashKey > 0 && (
            <motion.div
              key={timeoutFlashKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.5, 0.5, 0] }}
              transition={{ duration: 0.5, times: [0, 0.12, 0.65, 1] }}
              onAnimationComplete={() => setTimeoutFlashKey(0)}
              className="pointer-events-none absolute inset-0 z-30"
              style={{
                background:
                  "radial-gradient(ellipse at center, transparent 45%, var(--ofuda) 115%)",
              }}
            />
          )}

          <AnimatePresence>
            {dropdownOpen && click && !burst && (
              <AimMarker
                key={`aim-${click.key}`}
                x={click.boardX}
                y={click.boardY}
                ringSize={click.ringSize}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {burst && click && (
              <DanmakuBurst
                key={burst.key}
                x={burst.x}
                y={burst.y}
                verdict={burst.verdict}
                onFadeOut={() => {
                  setBurst(null);
                  setClick(null);
                }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {dropdownOpen && click && menuEnabled && (
              <CharacterDropdown
                key={`dropdown-${click.key}`}
                click={click}
                characters={active}
                onSelect={handleSelect}
              />
            )}
          </AnimatePresence>
        </motion.div>
        <figcaption className="mt-3 text-center font-body italic text-soft text-xs sm:text-sm">
          Another incident unfolds in Gensokyo, resolve it before the spell
          breaks.
        </figcaption>
      </figure>

      {sessionError && (
        <p className="text-sm text-ofuda text-center">
          Could not start a session — is the database configured?
        </p>
      )}

      <AnimatePresence>
        {!started && !sessionError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
          >
            <div className="card-frame bg-surface px-6 py-7 sm:px-8 sm:py-9 text-center max-w-sm mx-4">
              <p className="font-display tracking-[0.3em] text-ofuda text-[10px] mb-1">
                DearNoodle&apos;s
              </p>
              <h2 className="font-display text-3xl sm:text-4xl leading-tight">
                Touhou Ensemble
              </h2>
              <p className="mt-3 font-body text-soft text-sm">
                Waifus are waiting for you in the frame. Find them.
              </p>
              <div
                role="radiogroup"
                aria-label="Difficulty"
                className="mt-5 flex flex-col gap-2"
              >
                {DIFFICULTY_OPTIONS.map((option) => {
                  const selected = difficulty === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setDifficulty(option.id)}
                      className={`rounded-sm border px-3 py-2.5 font-display tracking-wide transition-colors ${
                        selected
                          ? "border-ofuda bg-ofuda text-paper"
                          : option.id === "lunatic"
                            ? "border-line text-ofuda hover:border-ofuda hover:bg-ofuda/10"
                            : "border-line text-ink hover:border-soft"
                      }`}
                    >
                      {option.label}
                      <span className="block font-body text-[10px] mt-0.5 opacity-70">
                        {option.id === "lunatic" ? "All characters" : option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 font-body text-sm text-soft italic leading-relaxed min-h-8">
                {DIFFICULTY_OPTIONS.find((o) => o.id === difficulty)
                  ?.description ?? "Choose a difficulty."}
              </p>
              <div className="mt-4 border-t border-line/60 pt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={soundEnabled}
                  onClick={() => setSoundEnabled((prev) => !prev)}
                  className="flex items-center gap-1.5 rounded-sm border border-line bg-surface px-1.5 py-1.5 cursor-pointer select-none group"
                  title="Sound"
                >
                  <span
                    className={`${
                      soundEnabled ? "text-ink" : "text-soft"
                    } group-hover:text-ink transition-colors`}
                  >
                    {soundEnabled ? (
                      <svg
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon
                          points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                          fill="currentColor"
                          stroke="none"
                        />
                        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon
                          points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                          fill="currentColor"
                          stroke="none"
                        />
                        <line x1="16" y1="9" x2="22" y2="15" />
                        <line x1="22" y1="9" x2="16" y2="15" />
                      </svg>
                    )}
                  </span>
                  <span
                    className={`relative inline-flex w-9 h-5 rounded-full border transition-colors ${
                      soundEnabled ? "bg-ofuda border-ofuda" : "bg-bg border-line"
                    }`}
                  >
                    <span
                      className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-paper shadow transition-all ${
                        soundEnabled ? "left-[18px]" : "left-[2px]"
                      }`}
                    />
                  </span>
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={menuEnabled}
                  onClick={toggleMenu}
                  className="flex items-center gap-2 rounded-sm border border-line bg-surface px-2 py-1.5 cursor-pointer select-none group"
                  title="Pop-Up Selection"
                >
                  <span className="font-display tracking-[0.14em] text-[9px] sm:text-[10px] uppercase text-soft group-hover:text-ink transition-colors">
                    Pop-Up Selection
                  </span>
                  <span
                    className={`relative inline-flex w-9 h-5 rounded-full border transition-colors ${
                      menuEnabled ? "bg-ofuda border-ofuda" : "bg-bg border-line"
                    }`}
                  >
                    <span
                      className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-paper shadow transition-all ${
                        menuEnabled ? "left-[18px]" : "left-[2px]"
                      }`}
                    />
                  </span>
                </button>
              </div>
              <button
                type="button"
                disabled={difficulty === null || beginning}
                onClick={() => difficulty && handleBegin(difficulty)}
                className="mt-4 rounded-sm bg-ofuda px-7 py-2.5 font-display tracking-wide text-paper transition hover:brightness-110 disabled:opacity-40"
              >
                Begin
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showModal && (
          <WinModal
            count={target}
            onCancel={() => router.push(`/leaderboard?difficulty=${difficulty}`)}
            onSubmit={handleNameSubmit}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
