import Link from "next/link";

export type NavPage = "play" | "ranking" | "credits";

const PAGES: { id: NavPage; label: string; href: string }[] = [
  { id: "play", label: "Play", href: "/" },
  { id: "ranking", label: "Ranking", href: "/leaderboard" },
  { id: "credits", label: "Credits", href: "/credits" },
];

export function SiteNav({ active }: { active: NavPage }) {
  return (
    <nav aria-label="Pages" className="flex items-center gap-5 sm:gap-7">
      {PAGES.map((page) => {
        const isActive = page.id === active;
        return (
          <Link
            key={page.id}
            href={page.href}
            aria-current={isActive ? "page" : undefined}
            className={`group flex flex-col items-center gap-1.5 font-display tracking-[0.2em] text-xs sm:text-sm uppercase transition-colors ${
              isActive ? "text-ofuda" : "text-soft hover:text-ink"
            }`}
          >
            {page.label}
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                isActive
                  ? "bg-ofuda"
                  : "bg-transparent group-hover:bg-line"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
