"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getThumb } from "@/lib/character-thumbs";
import { BLUR_HERO } from "@/lib/image-blurs";
import { setSoundMuted } from "@/lib/sfx";
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

type SessionPayload = {
  sessionId: string;
  difficulty: DifficultyId;
  pool: string[];
  clicked: Record<string, boolean>;
  active: string[];
  finished: boolean;
};

const DIFFICULTY_OPTIONS: {
  id: DifficultyId;
  label: string;
  hint: string;
  description: string;
}[] = [
  {
    id: "5",
    label: "Easy",
    hint: "5 characters",
    description: "Eeeh? Easy Modo?!",
  },
  {
    id: "20",
    label: "Normal",
    hint: "20 characters",
    description: "You'll be fine. Probably.",
  },
  {
    id: "40",
    label: "Hard",
    hint: "40 characters",
    description: "This is where the fun begins.",
  },
  {
    id: "all",
    label: "Lunatic",
    hint: "Every character",
    description: "Welcome to Hell... or Moon?",
  },
];

export function GameBoard() {
  const router = useRouter();
  const boardRef = useRef<HTMLDivElement>(null);

  const [difficulty, setDifficulty] = useState<DifficultyId | null>(null);
  const [target, setTarget] = useState(0);
  const [active, setActive] = useState<string[]>([]);
  const [stripShuffled, setStripShuffled] = useState(false);
  const [shuffleTick, setShuffleTick] = useState(0);
  const [found, setFound] = useState<string[]>([]);
  const [click, setClick] = useState<ClickPoint | null>(null);
  const [burst, setBurst] = useState<Burst>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuEnabled, setMenuEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [finished, setFinished] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [started, setStarted] = useState(false);
  const [beginning, setBeginning] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [penalty, setPenalty] = useState(0);
  const submittingRef = useRef(false);
  const nameSubmitRef = useRef(false);
  const rerollRef = useRef(false);

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
      setStarted(true);
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

  async function handleSelect(character: string) {
    if (!click || submittingRef.current) return;
    submittingRef.current = true;
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
      }
    } catch {
      setBurst({ x: boardX, y: boardY, verdict: "incorrect", key: key + 1 });
    } finally {
      submittingRef.current = false;
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
            <p className="font-display tracking-[0.18em] text-soft text-[10px] sm:text-xs uppercase tabular-nums">
              {found.length} / {target}
            </p>
          )}
        </div>
        <ul className="flex flex-wrap justify-center gap-5 sm:gap-8">
          <AnimatePresence mode="popLayout" initial={false}>
            {active.map((name, index) => {
              const thumb = getThumb(name);
              const shuffling = stripShuffled;
              const spin = index % 2 === 0 ? -10 : 10;
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
                      boxShadow:
                        dropdownOpen && click
                          ? [
                              "0 0 0 0 rgba(230, 90, 79, 0.5)",
                              "0 0 0 6px rgba(230, 90, 79, 0)",
                            ]
                          : "0 0 0 0 rgba(230, 90, 79, 0)",
                    }}
                    transition={
                      dropdownOpen && click
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

          {difficulty === "5" && started && !finished ? (
            <button
              type="button"
              onClick={handleReroll}
              className="rounded-sm border border-line bg-surface px-2 py-1 font-display tracking-[0.14em] text-[9px] sm:text-[10px] uppercase text-soft transition-colors hover:border-ofuda hover:text-ofuda cursor-pointer"
              title="New 5 characters from the full roster (+30s)"
            >
              Reroll (+30s)
            </button>
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

        <div
          ref={boardRef}
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
        </div>
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
                          : option.id === "all"
                            ? "border-line text-ofuda hover:border-ofuda hover:bg-ofuda/10"
                            : "border-line text-ink hover:border-soft"
                      }`}
                    >
                      {option.label}
                      <span className="block font-body text-[10px] mt-0.5 opacity-70">
                        {option.id === "all" ? "All characters" : option.hint}
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
