import { LeaderboardPage } from "@/components/LeaderboardPage";
import { isDifficultyId } from "@/lib/game/session-utils";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ difficulty?: string }>;
}) {
  const params = await searchParams;
  const difficulty = isDifficultyId(params.difficulty) ? params.difficulty : "all";
  return <LeaderboardPage initialDifficulty={difficulty} />;
}
