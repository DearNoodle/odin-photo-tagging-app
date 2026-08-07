import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        line: "var(--line)",
        ink: "var(--ink)",
        soft: "var(--soft)",
        ofuda: "var(--ofuda)",
        gold: "var(--gold)",
        mauve: "var(--mauve)",
        paper: "var(--paper)",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;