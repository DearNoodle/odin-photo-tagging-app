import type { Metadata } from "next";
import { CreditsPage } from "@/components/CreditsPage";

export const metadata: Metadata = {
  title: "Credits · Touhou Ensemble",
};

export default function Page() {
  return <CreditsPage />;
}
