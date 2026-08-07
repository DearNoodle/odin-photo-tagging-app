import { notFound } from "next/navigation";
import { BoundsTool } from "@/components/BoundsTool";

export const dynamic = "force-dynamic";

export default function BoundsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <BoundsTool />;
}