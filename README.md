# cabgo-blog-content

Content repo for the [cabgo.app/blog](https://cabgo.app/blog) — public, read
by `cabgoai` at runtime via `fetch` + Next.js ISR (`revalidate: 3600`).

This repo is intentionally separate from the main cabgoai product repo so a
daily blog-writer agent can work here without ever touching product code.

## Layout

```
posts/
  index.json           # summaries of every post, sorted by publishedAt desc
  <slug>.json          # full post body (title, excerpt, blocks, SEO, CTA)
images/
  <slug>.jpg           # hero image, 1920w, ~120KB, cinematic isometric style
scripts/
  generate-hero-image.mjs   # wraps Gemini 3.1 Flash Image + sharp
backlog.md             # topic ideas an agent can pull from
package.json
```

## Agent flow — how to add a post

An autonomous agent (Claude Code CLI on the Mac Mini, triggered by launchd)
runs once a day. It:

1. Reads `backlog.md` to pick an unused topic, or proposes a new one that
   doesn't collide with any existing `posts/*.json`.
2. Writes the article in Spanish first (see **Editorial structure** below),
   then produces an English parallel — not a literal translation.
3. Drops a new `posts/<slug>.json` following `BlogPost` shape (see schema).
4. Calls `node scripts/generate-hero-image.mjs --slug=<slug>` which reads the
   `heroImagePrompt` field from the JSON, hits Gemini, post-processes with
   sharp, writes `images/<slug>.jpg`.
5. Regenerates `posts/index.json` with `node scripts/build-index.mjs`.
6. `git add posts/<slug>.json images/<slug>.jpg posts/index.json` +
   `git commit -m "feat: <slug>" && git push`.

That's it. `cabgoai` picks it up within 1 hour via ISR.

## BlogPost schema

```ts
type BlogCategory = "strategy" | "product" | "market";

interface BlogPost {
  slug: string;                        // kebab-case ES, 3-5 words, unique
  category: BlogCategory;
  title: { es: string; en: string };
  excerpt: { es: string; en: string }; // 140-200 chars, 1-2 sentences
  heroImage: string;                   // full URL to raw GitHub image
  heroImageAlt: { es: string; en: string };
  heroImagePrompt: string;             // English, for the Gemini image script
  publishedAt: string;                 // ISO "YYYY-MM-DD"
  updatedAt?: string;
  readingMinutes: number;              // round(wordsES / 200)
  keywords: { es: string[]; en: string[] };  // 5-8 per locale
  blocks: BlogBlock[];
  cta: { heading, body, buttonLabel: I18n; buttonHref: string };
  seo: {
    metaTitle: { es: string; en: string };     // ≤ 60 chars, ends with " | Cabgo"
    metaDescription: { es: string; en: string }; // ≤ 160 chars, declarative
  };
  author: { name: string; role: { es: string; en: string } };
}

type BlogBlock =
  | { type: "paragraph"; text: { es: string; en: string } }
  | { type: "heading"; level: 2 | 3; id: string; text: I18n }
  | { type: "list"; style?: "bullet" | "number"; intro?: I18n; items: { es: string[]; en: string[] } }
  | { type: "callout"; variant?: "info" | "tip" | "warning"; text: I18n }
  | { type: "quote"; text: I18n; attribution?: I18n };
```

Default author is `Equipo Cabgo` — use unless a specific byline applies.

Default CTA points to `/empezar` — override only when the article naturally
leads elsewhere.

## Editorial structure

Follow this skeleton unless the piece demands a different shape:

1. **Opening — 2 paragraphs**: direct thesis in paragraph 1, scope + audience
   in paragraph 2. No clichés, no rhetorical questions.
2. **5-7 H2 sections**: each with 1-3 substantive paragraphs and optionally
   a bullet list (max 7 items). Max one `callout` across the whole post.
3. **One `quote`** with attribution — real or stylized operator voice.
4. **Closing section** (2 paragraphs) tying thesis to behavior change.
5. **CTA** — let the Next.js layout render it from `post.cta`.

**Length**: 1500-2000 words per locale, parallel not literal.
**Tone**: professional, opinionated, data-backed with plausible ranges
("$2,500-4,500 USD/mes", "12-18 months"). Spanish uses "tú", not "usted".

**Brand name**: "Cabgo" (lowercase after C in prose). Never "CabGoAI" or
"CabGo". In competitor comparisons, refer to Cabgo as "the platform" — the
explicit brand mention is for the CTA.

**Anti-patterns to avoid**:

- Buzzwords: "revolucionario", "disruptivo", "ecosistema completo".
- Invented stats. If a number appears, use plausible defensible ranges.
- H2s like "Introducción" / "Problema" / "Solución". Each H2 earns its
  title by promising something concrete.
- Closing with "¿Listo para empezar?" — the CTA component handles that.
- Repeating the thesis of a prior post. Every post contributes a new angle.

## SEO

- `slug`: kebab-case ES, includes the primary keyword
- `metaTitle`: ≤ 60 chars, suffix `" | Cabgo"`
- `metaDescription`: ≤ 160 chars, declarative (no CTA)
- `publishedAt`: the day the post ships. Never backdate.
- `keywords`: 5-8 per locale, mix exact phrase and long-tail variants.

cabgoai injects sitemap entries, JSON-LD `Article`, canonical + hreflang
alternates, and OpenGraph automatically from the JSON — nothing extra
required here.

## Image style

`scripts/generate-hero-image.mjs` appends a fixed brand-style suffix to every
prompt:

```
Wide 16:9 cinematic composition. Modern flat isometric illustration with a
3D depth feel. Deep indigo and violet gradient (hex #4F46E5 to #7C3AED) with
a soft teal (#14B8A6) highlight. Clean geometric shapes, smooth shadows,
subtle glow, no photoreal faces, high contrast, premium tech product
illustration. Negative space on the lower right for potential text overlay.
```

`heroImagePrompt` in each post JSON should describe the 2-4 concrete
isometric elements — leave the brand style to the script.

Example:
```
"Split composition: on the left, a messy tangle of wires and half-built
blocks representing custom development. On the right, a clean finished
isometric platform with ready dashboards, a phone mockup and a rocket."
```

## Pre-commit checklist

- [ ] `posts/<slug>.json` parses as valid JSON
- [ ] `es` and `en` arrays within lists have identical length
- [ ] All `heading.id` values are unique within the post
- [ ] `slug` does not collide with existing files
- [ ] `metaTitle` ≤ 60 chars, `metaDescription` ≤ 160 chars
- [ ] `images/<slug>.jpg` exists and is < 250 KB
- [ ] `posts/index.json` rebuilt with `node scripts/build-index.mjs`
- [ ] No "CabGoAI" / "CabGo" in prose — only "Cabgo"
