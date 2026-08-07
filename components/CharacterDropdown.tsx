"use client";

import { motion } from "framer-motion";
import type { ClickPoint } from "./GameBoard";

const MENU_WIDTH = 208;
const MENU_ROW_HEIGHT = 42;
const OFFSET = 18;
const H_GAP = 10;

export function CharacterDropdown({
  click,
  characters,
  onSelect,
}: {
  click: ClickPoint;
  characters: string[];
  onSelect: (character: string) => void;
}) {
  const { boardX, boardY, boardW, boardH, ringSize } = click;
  const flipH = boardX > boardW / 2;
  const flipV = boardY > boardH / 2;

  // Horizontally clear the aim ring so the menu never crowds it.
  const hOffset = Math.round(ringSize / 2) + H_GAP;
  const menuHeight = characters.length * MENU_ROW_HEIGHT + 14;

  let left = flipH ? boardX - hOffset - MENU_WIDTH : boardX + hOffset;
  left = Math.max(8, Math.min(left, boardW - MENU_WIDTH - 8));

  let top = flipV ? boardY - OFFSET - menuHeight : boardY + OFFSET;
  top = Math.max(8, Math.min(top, boardH - menuHeight - 8));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: flipV ? 8 : -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onClick={(e) => e.stopPropagation()}
      className="absolute z-30 rounded-sm rounded-tl-none bg-surface/95 border border-line shadow-lg backdrop-blur"
      style={{ left, top, width: MENU_WIDTH, borderTopColor: "var(--ofuda)", borderTopWidth: 2 }}
    >
      <ul className="flex flex-col p-1.5">
        {characters.map((character) => (
          <li key={character}>
            <button
              type="button"
              onClick={() => onSelect(character)}
              className="w-full text-left rounded-sm px-3 py-2 font-display text-sm tracking-wide hover:bg-ofuda/10 transition-colors"
              style={{ minHeight: MENU_ROW_HEIGHT - 8 }}
            >
              {character}
            </button>
          </li>
        ))}
        {characters.length === 0 && (
          <li className="px-3 py-2 font-body text-sm text-soft">
            No one left here…
          </li>
        )}
      </ul>
    </motion.div>
  );
}