"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SiteNav } from "@/components/SiteNav";

const LINK =
  "underline underline-offset-4 decoration-ofuda hover:text-ofuda transition-colors";

export function CreditsPage() {
  const reduce = useReducedMotion();
  const reveal = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
      };

  return (
    <main className="min-h-screen mx-auto max-w-2xl px-4 py-8 sm:py-12 flex flex-col gap-7">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line/70 pb-3">
        <h1 className="font-display text-3xl sm:text-4xl tracking-wide">
          Credits
        </h1>
        <SiteNav active="credits" />
      </header>

      <div className="flex flex-col gap-4 font-body text-base sm:text-lg leading-relaxed">
        <motion.p {...reveal} transition={{ delay: 0.15, duration: 0.4 }}>
          Website made with love by{" "}
          <strong className="font-bold">DearNoodle</strong>.
        </motion.p>
        <motion.p {...reveal} transition={{ delay: 0.27, duration: 0.4 }}>
          Character artwork by{" "}
          <a
            href="https://x.com/tama0104"
            target="_blank"
            rel="noreferrer"
            className={LINK}
          >
            柏森たま
          </a>{" "}
          and{" "}
          <a
            href="https://www.pixiv.net/users/4920496"
            target="_blank"
            rel="noreferrer"
            className={LINK}
          >
            dairi
          </a>
          .
        </motion.p>
      </div>

      <motion.p
        {...reveal}
        transition={{ delay: 0.39, duration: 0.4 }}
        className="font-body text-xs sm:text-sm text-soft leading-relaxed"
      >
        Touhou Project © ZUN / Team Shanghai Alice. Fan-made, not affiliated.
      </motion.p>
    </main>
  );
}
