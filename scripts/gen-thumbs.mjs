import { writeFile, readdir } from "node:fs/promises";
import sharp from "sharp";

const CHAR_DIR = "public/img/characters";
const HERO_PATH = "public/img/background/touhou_full.jpg";

const keyFrom = (file) =>
  file.replace(/\.jpg$/i, "").toUpperCase().replace(/[^A-Z0-9]/g, "_");
const nameFrom = (file) => file.replace(/\.jpg$/i, "").replace(/_/g, " ");

async function blurDataUrl(buf) {
  const small = await sharp(buf)
    .resize(16, 16, { fit: "inside" })
    .webp({ quality: 60 })
    .toBuffer();
  return `data:image/webp;base64,${small.toString("base64")}`;
}

const files = (await readdir(CHAR_DIR)).filter((f) => /\.jpg$/i.test(f)).sort();

const chars = [];
for (const file of files) {
  const buf = await sharp(`${CHAR_DIR}/${file}`).toBuffer();
  chars.push({ file, key: keyFrom(file), name: nameFrom(file), blur: await blurDataUrl(buf) });
}

const heroBlur = await blurDataUrl(await sharp(HERO_PATH).toBuffer());

const blurLines = [
  `export const BLUR_HERO = "${heroBlur}";`,
  ...chars.map((c) => `export const BLUR_${c.key} = "${c.blur}";`),
];

const imports = chars.map((c) => `  BLUR_${c.key},`).join("\n");
const entries = chars
  .map((c) => `  ${JSON.stringify(c.name)}: { src: "/img/characters/${c.file}", blurDataUrl: BLUR_${c.key} },`)
  .join("\n");

await writeFile("lib/image-blurs.ts", `${blurLines.join("\n")}\n`);
await writeFile(
  "lib/character-thumbs.ts",
  `import {
${imports}
} from "./image-blurs";

export type CharacterThumb = {
  src: string;
  blurDataUrl: string;
};

export const CHARACTER_THUMBS: Record<string, CharacterThumb> = {
${entries}
};

export function getThumb(name: string): CharacterThumb | null {
  return CHARACTER_THUMBS[name] ?? null;
}
`,
);

console.log(`Wrote ${chars.length} character thumbs + BLUR_HERO.`);