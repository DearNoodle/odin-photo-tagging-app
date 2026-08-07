"use client";

import { useEffect, useState } from "react";
import { formatTime } from "@/lib/format-time";

export function GameTimer({
  running,
  penalty,
}: {
  running: boolean;
  penalty: number;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  return (
    <span className="font-display text-lg sm:text-2xl tracking-wider tabular-nums">
      {formatTime(seconds + penalty)}
    </span>
  );
}