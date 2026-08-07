"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { NAME_MAX_LENGTH } from "@/lib/domain";

export function WinModal({
  count,
  onSubmit,
  onCancel,
}: {
  count: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      confetti({
        particleCount: 140,
        spread: 90,
        startVelocity: 35,
        origin: { y: 0.6 },
        colors: ["#e65a4f", "#e8b84b", "#f5efe2"],
      });
    }, 80);
    return () => {
      clearTimeout(id);
      confetti.reset();
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(name.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        initial={{ scale: 0.84, opacity: 0, y: 18 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.86, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        className="relative z-10 w-full max-w-sm card-frame rounded-sm bg-surface p-7 text-center shadow-2xl"
      >
        <p className="font-display tracking-[0.3em] text-ofuda text-[10px] mb-1">
          SPELL CARD
        </p>
        <h2 className="font-display text-3xl sm:text-4xl leading-tight">
          All {count} found.
        </h2>
        <p className="mt-2 font-body text-soft text-sm">
          Enter your name for the ranking.
        </p>
        <form
          onSubmit={handleSubmit}
          className="mt-5 flex flex-col items-center gap-5"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX_LENGTH}
            placeholder="Type here"
            autoFocus
            className="w-full rounded-sm border border-line bg-bg/40 px-3 py-2.5 text-center font-display text-xl tracking-wide outline-none focus:border-ofuda transition-colors"
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-sm bg-ofuda px-6 py-2.5 font-display tracking-wide text-paper transition hover:brightness-110 disabled:opacity-40"
            >
              Post to ranking
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-sm border border-line px-6 py-2.5 font-display tracking-wide text-soft transition hover:text-ink hover:border-soft"
            >
              Skip
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}