import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import type { Bounds } from "../../../lib/domain";

export const dynamic = "force-dynamic";

type CharacterInput = { name: string; bounds: Bounds };

function isAuthorized(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const adminSecret = process.env.BOUNDS_ADMIN_SECRET;
  if (!adminSecret) return false;
  return request.headers.get("x-bounds-secret") === adminSecret;
}

function isBounds(b: unknown): b is Bounds {
  if (typeof b !== "object" || b === null) return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.xMin === "number" &&
    typeof o.xMax === "number" &&
    typeof o.yMin === "number" &&
    typeof o.yMax === "number"
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await prisma.characterLocation.findMany();
  const characters = rows.map((r) => ({
    name: r.character,
    bounds: r.bounds as Bounds,
  }));
  return NextResponse.json({ characters });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const list = Array.isArray(body?.characters) ? body.characters : null;
  if (!list) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const clean: CharacterInput[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    if (!name || seen.has(name) || !isBounds(item?.bounds)) continue;
    const b = item.bounds as Bounds;
    seen.add(name);
    clean.push({
      name,
      bounds: {
        xMin: Math.min(b.xMin, b.xMax),
        xMax: Math.max(b.xMin, b.xMax),
        yMin: Math.min(b.yMin, b.yMax),
        yMax: Math.max(b.yMin, b.yMax),
      },
    });
  }

  await prisma.$transaction([
    prisma.characterLocation.deleteMany({}),
    ...clean.map((c) =>
      prisma.characterLocation.create({
        data: { character: c.name, bounds: c.bounds },
      }),
    ),
  ]);

  return NextResponse.json({ ok: true, count: clean.length });
}