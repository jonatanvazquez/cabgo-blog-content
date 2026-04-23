/**
 * build-index.mjs — regenerate posts/index.json from all posts/<slug>.json.
 *
 * Call this after adding or editing any post so the blog listing page and
 * sitemap pick up the change on the next ISR revalidate.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(__filename));
const POSTS_DIR = join(ROOT, "posts");
const INDEX_PATH = join(POSTS_DIR, "index.json");

const summaries = readdirSync(POSTS_DIR)
  .filter((f) => f.endsWith(".json") && f !== "index.json")
  .map((f) => {
    const post = JSON.parse(readFileSync(join(POSTS_DIR, f), "utf8"));
    return {
      slug: post.slug,
      category: post.category,
      title: post.title,
      excerpt: post.excerpt,
      heroImage: post.heroImage,
      heroImageAlt: post.heroImageAlt,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      readingMinutes: post.readingMinutes,
    };
  })
  .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));

writeFileSync(
  INDEX_PATH,
  JSON.stringify(
    { generatedAt: new Date().toISOString(), posts: summaries },
    null,
    2,
  ),
);

console.log(`build-index: wrote ${summaries.length} posts to index.json`);
