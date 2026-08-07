"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { BLUR_HERO } from "@/lib/image-blurs";
import type { Bounds } from "@/lib/domain";

type Box = { id: number; name: string; bounds: Bounds };
type Draft = { x1: number; y1: number; x2: number; y2: number };

const EXTRAS_KEY = "bounds-tool-extras-v1";
const HIDDEN_KEY = "bounds-tool-hidden-v1";
const ZOOM_LEVELS = [1, 1.5, 2, 3, 4];
const IMAGE_SRC = "/img/background/touhou_full.jpg";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round4 = (v: number) => Math.round(v * 10000) / 10000;
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

export function BoundsTool() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [dbNames, setDbNames] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const nextId = useRef(1);
  const boardRef = useRef<HTMLDivElement>(null);

  const loadFromDb = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/characters", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        characters: { name: string; bounds: Bounds }[];
      };
      const loaded = data.characters.map((c) => ({
        id: nextId.current++,
        name: c.name,
        bounds: { ...c.bounds },
      }));
      setBoxes(loaded);
      setDbNames(new Set(loaded.map((b) => b.name)));
      setDirty(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFromDb();
    try {
      const raw = localStorage.getItem(EXTRAS_KEY);
      if (raw) setExtras(JSON.parse(raw) as string[]);
      const rawH = localStorage.getItem(HIDDEN_KEY);
      if (rawH) setHidden(new Set(JSON.parse(rawH) as string[]));
    } catch {
      /* ignore */
    }
  }, [loadFromDb]);

  useEffect(() => {
    try {
      localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras));
    } catch {
      /* ignore */
    }
  }, [extras]);

  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
    } catch {
      /* ignore */
    }
  }, [hidden]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") {
        setDraft(null);
        setSelectedId(null);
        setActiveName(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId != null) {
        setBoxes((prev) => prev.filter((b) => b.id !== selectedId));
        setSelectedId(null);
        setDirty(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const names = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of [...boxes.map((b) => b.name), ...extras]) {
      const trimmed = n.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        out.push(trimmed);
      }
    }
    return out;
  }, [boxes, extras]);

  const byName = useMemo(() => {
    const m = new Map<string, Box>();
    for (const b of boxes) if (b.name) m.set(b.name, b);
    return m;
  }, [boxes]);

  const markedCount = names.filter((n) => byName.has(n)).length;
  const unnamedCount = boxes.filter((b) => !b.name).length;

  function toNorm(e: React.PointerEvent): { x: number; y: number } | null {
    const el = boardRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const p = toNorm(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    setSelectedId(null);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draft) return;
    const p = toNorm(e);
    if (!p) return;
    setDraft((d) => (d ? { ...d, x2: p.x, y2: p.y } : d));
  }

  function handlePointerUp() {
    if (!draft) return;
    const { x1, y1, x2, y2 } = draft;
    setDraft(null);
    if (Math.abs(x2 - x1) < 0.002 || Math.abs(y2 - y1) < 0.002) return;
    const bounds: Bounds = {
      xMin: Math.min(x1, x2),
      xMax: Math.max(x1, x2),
      yMin: Math.min(y1, y2),
      yMax: Math.max(y1, y2),
    };
    setBoxes((prev) => {
      const rest = activeName ? prev.filter((b) => b.name !== activeName) : prev;
      return [...rest, { id: nextId.current++, name: activeName ?? "", bounds }];
    });
    setDirty(true);
  }

  function handleBoxPointerDown(e: React.PointerEvent, box: Box) {
    e.stopPropagation();
    setSelectedId(box.id);
    if (box.name) setActiveName(box.name);
  }

  function pickName(name: string) {
    setActiveName((prev) => (prev === name ? null : name));
    if (selectedId != null) {
      setBoxes((prev) =>
        prev.map((b) => (b.id === selectedId ? { ...b, name } : b)),
      );
      setSelectedId(null);
      setDirty(true);
    }
  }

  function addName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setExtras((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setActiveName(trimmed);
  }

  function handleBulkAdd() {
    for (const line of bulkText.split(/[\n,]+/)) addName(line);
    setBulkText("");
  }

  function removeName(name: string) {
    setExtras((prev) => prev.filter((n) => n !== name));
    setBoxes((prev) => prev.filter((b) => b.name !== name));
    setActiveName((prev) => (prev === name ? null : prev));
  }

  function nextUnmarked() {
    const next = names.find((n) => !byName.has(n));
    if (next) setActiveName(next);
  }

  function toggleHidden(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleClearAll() {
    if (!confirm("清除所有已標記的框？角色清單保留。")) return;
    setBoxes([]);
    setDirty(true);
  }

  function zoomAt(delta: number) {
    const i = ZOOM_LEVELS.indexOf(zoom);
    const next = ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, i + delta))];
    setZoom(next);
  }

  async function handleRefresh() {
    if (dirty && !confirm("有未儲存的變更，重新載入會捨捨棄。繼續？")) return;
    await loadFromDb();
  }

  async function handleSave() {
    const payload = boxes
      .filter((b) => b.name)
      .map((b) => ({
        name: b.name,
        bounds: {
          xMin: round4(b.bounds.xMin),
          xMax: round4(b.bounds.xMax),
          yMin: round4(b.bounds.yMin),
          yMax: round4(b.bounds.yMax),
        },
      }));
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characters: payload }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { count: number };
      setDirty(false);
      setDbNames(new Set(payload.map((p) => p.name)));
      setSavedMsg(`已儲存 ${data.count} 個角色到 DB ✓`);
      setTimeout(() => setSavedMsg(null), 2500);
    } catch {
      setSavedMsg("儲存失敗 ✗");
      setTimeout(() => setSavedMsg(null), 2500);
    } finally {
      setSaving(false);
    }
  }

  const exportText = useMemo(() => {
    const order = new Map(names.map((n, i) => [n, i]));
    const sorted = [...boxes]
      .filter((b) => b.name)
      .sort((a, b) => {
        const ao = order.get(a.name) ?? 1e9;
        const bo = order.get(b.name) ?? 1e9;
        return ao - bo || a.name.localeCompare(b.name);
      });
    const entries = sorted
      .map((b) => {
        const { xMin, xMax, yMin, yMax } = b.bounds;
        return `  { name: ${JSON.stringify(b.name)}, bounds: { xMin: ${round4(xMin)}, xMax: ${round4(xMax)}, yMin: ${round4(yMin)}, yMax: ${round4(yMax)} } },`;
      })
      .join("\n");
    return `export type Bounds = {\n  xMin: number;\n  xMax: number;\n  yMin: number;\n  yMax: number;\n};\n\nexport type CharacterSeed = {\n  name: string;\n  bounds: Bounds;\n};\n\nexport const CHARACTERS: CharacterSeed[] = [\n${entries}\n];\n`;
  }, [boxes, names]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <main className="min-h-screen bg-bg p-4 text-ink">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-72">
          <header>
            <h1 className="font-display text-xl">Bounds 標記工具</h1>
            <p className="mt-1 text-sm text-soft">
              在圖片上拖曳畫框，指派角色後儲存到 DB。
            </p>
          </header>

          <div className="rounded-sm border border-line bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-soft">
                {loading
                  ? "載入中…"
                  : loadError
                    ? "載入失敗"
                    : `目前標記：${activeName ?? "（未指定）"}`}
              </p>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="rounded-sm border border-line px-2 py-1 text-xs text-soft transition hover:bg-line/40 disabled:opacity-50"
              >
                重新載入
              </button>
            </div>
            {!loading && !loadError && (
              <p className="mt-1 text-xs text-soft">
                已標 {markedCount}/{names.length}
                {unnamedCount > 0 && `，未指定框 ${unnamedCount}`}
                {dirty && <span className="text-amber-400">（未儲存）</span>}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={nextUnmarked}
                className="rounded-sm bg-ofuda px-2 py-1 font-display text-xs text-paper transition hover:brightness-110"
              >
                下一個未標記
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="rounded-sm border border-line px-2 py-1 font-display text-xs text-soft transition hover:text-ink"
              >
                全部清除
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-soft">縮放</span>
              <button
                type="button"
                onClick={() => zoomAt(-1)}
                className="w-6 rounded-sm border border-line transition hover:bg-line/40"
              >
                −
              </button>
              <span className="w-8 text-center">{zoom}×</span>
              <button
                type="button"
                onClick={() => zoomAt(1)}
                className="w-6 rounded-sm border border-line transition hover:bg-line/40"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="text-xs text-soft underline-offset-2 hover:underline"
              >
                重置
              </button>
            </div>
          </div>

          <div className="rounded-sm border border-line bg-surface p-3">
            <h2 className="text-xs uppercase tracking-wide text-soft">角色清單</h2>
            <ul className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
              {names.map((name) => {
                const box = byName.get(name);
                const isActive = activeName === name;
                const isPending = extras.includes(name) && !dbNames.has(name);
                const isHidden = hidden.has(name) && !!box;
                return (
                  <li key={name} className="flex items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => pickName(name)}
                      className={`flex-1 rounded-sm px-2 py-1 text-left text-sm transition ${
                        isActive ? "bg-ofuda text-paper" : "hover:bg-line/40"
                      } ${isHidden ? "opacity-40" : ""}`}
                    >
                      <span className="mr-1">{box ? (isHidden ? "◐" : "●") : "○"}</span>
                      <span className="font-bold">{name}</span>
                      {box && (
                        <span className="block text-[10px] opacity-70">
                          x {round4(box.bounds.xMin)}–{round4(box.bounds.xMax)} / y{" "}
                          {round4(box.bounds.yMin)}–{round4(box.bounds.yMax)}
                        </span>
                      )}
                    </button>
                    {box && (
                      <button
                        type="button"
                        aria-label={isHidden ? `顯示 ${name}` : `隱藏 ${name}`}
                        title={isHidden ? "顯示框" : "隱藏框"}
                        onClick={() => toggleHidden(name)}
                        className="rounded-sm border border-line px-1 text-xs text-soft transition hover:bg-line/40"
                      >
                        {isHidden ? "○" : "●"}
                      </button>
                    )}
                    {isPending && (
                      <button
                        type="button"
                        aria-label={`刪除 ${name}`}
                        onClick={() => removeName(name)}
                        className="rounded-sm border border-line px-1 text-xs text-soft transition hover:border-red-400 hover:text-red-400"
                      >
                        ×
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-sm border border-line bg-surface p-3">
            <h2 className="text-xs uppercase tracking-wide text-soft">新增角色</h2>
            <div className="mt-2 flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addName(newName);
                    setNewName("");
                  }
                }}
                placeholder="角色英文全名"
                className="min-w-0 flex-1 rounded-sm border border-line bg-bg px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  addName(newName);
                  setNewName("");
                }}
                className="rounded-sm border border-line px-2 py-1 text-xs transition hover:bg-line/40"
              >
                新增
              </button>
            </div>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={3}
              placeholder="也可貼上多個名字（逗號或換行分隔）"
              className="mt-2 w-full rounded-sm border border-line bg-bg px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={handleBulkAdd}
              className="mt-1 w-full rounded-sm border border-line py-1 text-xs transition hover:bg-line/40"
            >
              批次新增
            </button>
          </div>

          <div className="rounded-sm border border-line bg-surface p-3">
            <h2 className="text-xs uppercase tracking-wide text-soft">儲存 / 匯出</h2>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || boxes.length === 0}
              className="mt-2 w-full rounded-sm bg-gold py-2 font-display text-paper transition hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "儲存中…" : "儲存到 DB（寫入全部）"}
            </button>
            {savedMsg && (
              <p className="mt-1 text-center text-xs text-soft">{savedMsg}</p>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-soft">
              儲存會清空 DB 後寫入目前所有已命名的框。未命名框與未畫框的角色不會寫入。
            </p>
            <button
              type="button"
              onClick={handleCopy}
              disabled={boxes.length === 0}
              className="mt-3 w-full rounded-sm border border-line py-2 font-display text-xs text-soft transition hover:text-ink disabled:opacity-50"
            >
              {copied ? "已複製 ✓" : "複製 seed 檔內容（備份）"}
            </button>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-soft">
                預覽輸出
              </summary>
              <pre className="mt-2 max-h-56 overflow-auto rounded-sm bg-bg p-2 text-[10px] leading-relaxed">
                {exportText}
              </pre>
            </details>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div
            className="overflow-auto rounded-sm border border-line bg-surface"
            style={{ maxHeight: "88vh" }}
          >
            <div
              ref={boardRef}
              className="relative aspect-[2893/1158] w-full cursor-crosshair touch-none select-none"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <Image
                src={IMAGE_SRC}
                alt="遊戲主圖"
                fill
                priority
                placeholder="blur"
                blurDataURL={BLUR_HERO}
                draggable={false}
                sizes="(max-width: 1536px) 100vw, 1536px"
                className="pointer-events-none select-none"
              />

              {draft && (
                <div
                  className="absolute border-2 border-amber-300/90 bg-amber-300/10"
                  style={{
                    left: pct(Math.min(draft.x1, draft.x2)),
                    top: pct(Math.min(draft.y1, draft.y2)),
                    width: pct(Math.abs(draft.x2 - draft.x1)),
                    height: pct(Math.abs(draft.y2 - draft.y1)),
                  }}
                />
              )}

              {boxes.map((box) => {
                const isSelected = box.id === selectedId;
                const isHidden = !!box.name && hidden.has(box.name);
                if (isHidden) {
                  return (
                    <div
                      key={box.id}
                      className="pointer-events-none absolute border border-dashed border-zinc-500/40"
                      style={{
                        left: pct(box.bounds.xMin),
                        top: pct(box.bounds.yMin),
                        width: pct(box.bounds.xMax - box.bounds.xMin),
                        height: pct(box.bounds.yMax - box.bounds.yMin),
                      }}
                    />
                  );
                }
                const boxColor = isSelected
                  ? "border-amber-300 bg-amber-300/10"
                  : box.name
                    ? "border-emerald-400/90 bg-emerald-400/10"
                    : "border-sky-400/90 bg-sky-400/10";
                return (
                  <div
                    key={box.id}
                    onPointerDown={(e) => handleBoxPointerDown(e, box)}
                    className={`absolute border-2 ${boxColor}`}
                    style={{
                      left: pct(box.bounds.xMin),
                      top: pct(box.bounds.yMin),
                      width: pct(box.bounds.xMax - box.bounds.xMin),
                      height: pct(box.bounds.yMax - box.bounds.yMin),
                    }}
                  >
                    {box.name && (
                      <span className="absolute left-0 top-0 whitespace-nowrap bg-black/70 px-1 text-[10px] leading-4 text-white">
                        {box.name}
                      </span>
                    )}
                    {isSelected && (
                      <button
                        type="button"
                        aria-label="刪除框"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => {
                          setBoxes((prev) => prev.filter((b) => b.id !== box.id));
                          setSelectedId(null);
                          setDirty(true);
                        }}
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-xs text-soft">
            拖曳畫框 → 點左側角色指派（或先點角色再畫框）→ 按「儲存到 DB」。
            Delete 刪除選中的框，Esc 取消選擇。儲存後寫入 DB，遊戲頁重新整理即生效。
          </p>
        </section>
      </div>
    </main>
  );
}