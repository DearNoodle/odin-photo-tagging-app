"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatTime } from "@/lib/format-time";
import { SiteNav } from "@/components/SiteNav";
import type { DifficultyId } from "@/lib/game/session-utils";
import type { LeaderboardSort } from "@/lib/session-store";

type LeaderboardEntry = {
  name: string;
  time: number;
  accuracy?: number;
  isAuthor?: boolean;
};

const TABS: { id: DifficultyId; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "normal", label: "Normal" },
  { id: "hard", label: "Hard" },
  { id: "lunatic", label: "Lunatic" },
];

const SORTS: { id: LeaderboardSort; label: string }[] = [
  { id: "time", label: "Time" },
  { id: "accuracy", label: "Accuracy" },
];

export function LeaderboardPage({
  initialDifficulty = "lunatic",
}: {
  initialDifficulty?: DifficultyId;
}) {
  const [difficulty, setDifficulty] = useState<DifficultyId>(initialDifficulty);
  const [sort, setSort] = useState<LeaderboardSort>("time");
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setEntries(null);
    setError(false);
    fetch(`/api/leaderboard?difficulty=${difficulty}&sort=${sort}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setEntries)
      .catch(() => setError(true));
  }, [difficulty, sort]);

  return (
    <main className="min-h-screen mx-auto max-w-2xl px-4 py-8 sm:py-12 flex flex-col gap-7">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line/70 pb-3">
        <h1 className="font-display text-3xl sm:text-4xl tracking-wide">
          Ranking
        </h1>
        <SiteNav active="ranking" />
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

      <div className="flex items-center gap-1.5 justify-end">
        <span className="font-display tracking-[0.2em] text-[9px] sm:text-[10px] uppercase text-soft mr-1">
          Sort by
        </span>
        {SORTS.map((option) => {
          const selected = sort === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSort(option.id)}
              className={`rounded-sm border px-3 py-1 font-display tracking-widest text-xs transition-colors ${
                selected
                  ? "border-gold bg-gold text-paper"
                  : "border-line text-soft hover:border-soft hover:text-ink"
              }`}
            >
              {option.label}
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
          <div>
            <div className="flex items-center gap-4 sm:gap-6 pb-2 border-b border-soft font-display tracking-[0.18em] text-[9px] sm:text-[10px] uppercase text-soft divide-x divide-soft">
              <span className="w-9 shrink-0 text-center">Rank</span>
              <span className="flex-1 min-w-0 pl-3 sm:pl-4">Name</span>
              <span className="shrink-0 min-w-12 pl-3 sm:pl-4">Acc</span>
              <span className="shrink-0 min-w-14 pl-3 sm:pl-4">Time</span>
            </div>
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
                      className="flex items-center gap-4 sm:gap-6 py-3.5 border-b border-soft divide-x divide-soft"
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
                        className={`flex-1 min-w-0 pl-3 sm:pl-4 font-display tracking-wide truncate text-base sm:text-lg ${
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
                        className={`shrink-0 min-w-12 pl-3 sm:pl-4 font-body tabular-nums text-sm sm:text-base ${
                          devAuto ? "text-[#5b9bd5]" : "text-gold"
                        }`}
                        aria-label={`Accuracy ${Math.round((entry.accuracy ?? 1) * 100)}%`}
                      >
                        {Math.round((entry.accuracy ?? 1) * 100)}%
                      </span>
                      <span
                        className={`shrink-0 min-w-14 pl-3 sm:pl-4 font-body tabular-nums text-sm sm:text-base ${
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
          </div>
        )}
      </div>
    </main>
  );
}
