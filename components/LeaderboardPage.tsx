"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatTime } from "@/lib/format-time";
import type { DifficultyId } from "@/lib/game/session-utils";

type LeaderboardEntry = { name: string; time: number; isAuthor?: boolean };

const TABS: { id: DifficultyId; label: string }[] = [
  { id: "5", label: "Easy" },
  { id: "20", label: "Normal" },
  { id: "40", label: "Hard" },
  { id: "all", label: "Lunatic" },
];

export function LeaderboardPage({
  initialDifficulty = "all",
}: {
  initialDifficulty?: DifficultyId;
}) {
  const [difficulty, setDifficulty] = useState<DifficultyId>(initialDifficulty);
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setEntries(null);
    setError(false);
    fetch(`/api/leaderboard?difficulty=${difficulty}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setEntries)
      .catch(() => setError(true));
  }, [difficulty]);

  return (
    <main className="min-h-screen mx-auto max-w-2xl px-4 py-8 sm:py-12 flex flex-col gap-7">
      <header className="flex items-baseline justify-between border-b border-line/70 pb-3">
        <h1 className="font-display text-3xl sm:text-4xl tracking-wide">
          Ranking
        </h1>
        <Link
          href="/"
          className="font-display tracking-[0.2em] text-xs sm:text-sm text-ofuda hover:underline underline-offset-4"
        >
          ← PLAY AGAIN
        </Link>
      </header>

      <div role="tablist" aria-label="Difficulty" className="flex gap-2">
        {TABS.map((tab) => {
          const selected = difficulty === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setDifficulty(tab.id)}
              className={`rounded-sm border px-4 py-1.5 font-display tracking-widest text-sm transition-colors ${
                selected
                  ? "border-ofuda bg-ofuda text-paper"
                  : "border-line text-soft hover:border-soft hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {error && (
          <p className="font-body text-ofuda">
            Couldn&rsquo;t reach the leaderboard. Reload to try again.
          </p>
        )}

        {entries === null && !error && (
          <p className="font-body text-soft">Reading the ranking…</p>
        )}

        {entries !== null && entries.length === 0 && (
          <p className="font-body text-soft">
            No clears yet. Finish a game to claim the first slot.
          </p>
        )}

        {entries !== null && entries.length > 0 && (
          <ul>
            <AnimatePresence initial={false}>
              {entries.map((entry, index) => {
                const top3 = index < 3;
                const devAuto = entry.isAuthor === true;
                return (
                  <motion.li
                    key={`${entry.name}-${entry.time}-${index}`}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.07, duration: 0.28 }}
                    className="flex items-center gap-4 sm:gap-6 py-3.5 border-b border-line/60"
                  >
                    <span
                      className={`flex items-center justify-center w-9 h-9 shrink-0 rounded-sm border font-display text-sm ${
                        devAuto
                          ? "border-[#5b9bd5] text-[#5b9bd5]"
                          : top3
                            ? "border-ofuda text-ofuda"
                            : "border-line text-soft"
                      }`}
                      aria-label={`Rank ${index + 1}`}
                    >
                      {index + 1}
                    </span>
                    <span
                      className={`flex-1 min-w-0 font-display tracking-wide truncate text-base sm:text-lg ${
                        devAuto
                          ? "text-[#7fb8e6]"
                          : top3
                            ? "underline decoration-gold/70 underline-offset-4"
                            : ""
                      }`}
                    >
                      {entry.name}
                    </span>
                    <span
                      className={`shrink-0 font-body tabular-nums text-sm sm:text-base ${
                        devAuto ? "text-[#5b9bd5]" : "text-soft"
                      }`}
                    >
                      {formatTime(entry.time)}
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </main>
  );
}
