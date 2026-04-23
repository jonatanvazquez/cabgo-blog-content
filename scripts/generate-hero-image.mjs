/**
 * generate-hero-image.mjs
 *
 * Reads posts/<slug>.json, calls Gemini 3.1 Flash Image with the post's
 * heroImagePrompt + the fixed brand-style suffix, post-processes with sharp,
 * and writes images/<slug>.jpg.
 *
 * Usage:
 *   node scripts/generate-hero-image.mjs --slug=<slug>          # generate one
 *   node scripts/generate-hero-image.mjs --slug=<slug> --force  # overwrite
 *   node scripts/generate-hero-image.mjs --slug=<slug> --dry    # print prompt only
 *
 * Requires GEMINI_API_KEY in the environment (inherited from launchd plist).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(__filename));
const POSTS_DIR = join(ROOT, "posts");
const IMAGES_DIR = join(ROOT, "images");

const BRAND_STYLE = [
  "Wide 16:9 cinematic composition.",
  "Modern flat isometric illustration with a 3D depth feel.",
  "Deep indigo and violet gradient background (hex #4F46E5 to #7C3AED), with a soft teal (#14B8A6) highlight.",
  "Clean geometric shapes, smooth shadows, subtle glow, no noise, no photoreal faces.",
  "Minimal text is acceptable but avoid logos and avoid legible copy.",
  "High contrast, crisp edges, premium tech product illustration aesthetic.",
  "No clutter, large negative space on the lower right for potential text overlay.",
].join(" ");

const MODEL = "gemini-3.1-flash-image-preview";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, "").split("=");
    return [k, rest.join("=") || true];
  }),
);
const SLUG = typeof args.slug === "string" ? args.slug : null;
const FORCE = Boolean(args.force);
const DRY = Boolean(args.dry) || Boolean(args["dry-run"]);

if (!SLUG) {
  console.error("Usage: node scripts/generate-hero-image.mjs --slug=<slug>");
  process.exit(1);
}

const postPath = join(POSTS_DIR, `${SLUG}.json`);
if (!existsSync(postPath)) {
  console.error(`Post not found: ${postPath}`);
  process.exit(1);
}

const post = JSON.parse(readFileSync(postPath, "utf8"));
const imagePrompt = post.heroImagePrompt;
if (!imagePrompt) {
  console.error(
    `Post '${SLUG}' has no heroImagePrompt. Add one describing 2-4 isometric elements.`,
  );
  process.exit(1);
}

const prompt = `${imagePrompt} ${BRAND_STYLE}`;
const outPath = join(IMAGES_DIR, `${SLUG}.jpg`);

if (DRY) {
  console.log(`[dry-run] would call ${MODEL}`);
  console.log(`[dry-run] prompt:`);
  console.log(prompt);
  console.log(`[dry-run] output: ${outPath}`);
  process.exit(0);
}

if (existsSync(outPath) && !FORCE) {
  console.log(`skip: ${outPath} already exists (use --force to regenerate)`);
  process.exit(0);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY not set. Add it to the environment.");
  process.exit(1);
}

async function callGemini() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) {
    throw new Error(`No image in response: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return Buffer.from(img.inlineData.data, "base64");
}

async function main() {
  mkdirSync(IMAGES_DIR, { recursive: true });
  console.log(`generating image for '${SLUG}'...`);
  const start = Date.now();
  const raw = await callGemini();
  const optimized = await sharp(raw)
    .resize({ width: 1920, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true, progressive: true })
    .toBuffer();
  writeFileSync(outPath, optimized);
  const rawKb = Math.round(raw.length / 1024);
  const optKb = Math.round(optimized.length / 1024);
  console.log(
    `done: ${outPath} (${rawKb}KB → ${optKb}KB, ${Date.now() - start}ms)`,
  );
}

main().catch((err) => {
  console.error(`failed: ${err.message}`);
  process.exit(1);
});
