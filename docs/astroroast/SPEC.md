# AstroRoast.ai — MVP spec

Route: `https://www.good-inventions.work/astroroast`. Source brief: Notion "ASTRO ROAST — side projekt" (2026-11-26).
Claim: **Hvězdy tě nešetří.** EN sub-claim: *The stars have jokes.* Language of the product: Czech.

## Goal
Viral, mobile-first comedy-astrology web. Give one instant, shareable punch without registration. Then the
visitor shares it ("A teď to zkus na sebe") and the receiver makes their own. Monetization hooks are present but light.

## Hard rules
- **Privacy:** birth date never leaves the browser. Sign computed client-side. Share links, OG images and the
  server only see `sign + level + topic + target + seed` (code from `encodeShare`). No birth date in a URL, a
  card, a log or storage.
- **No LLM, no paid API, no DB, no secrets** in the MVP. The humor engine is deterministic and template-based over a
  hand-written original Czech content library. Zero cost per generation, no abuse vector, instant.
- **Humor safety:** punch at the sign stereotype, never at real traits. No jokes about body, health, ethnicity,
  religion, sexuality, disability, money trouble, death, or real persons. Level 5 is absurd and cosmic, not cruel.
  `target: "friend"` caps level at 3. Couples cap level at 3 and both partners take equal hits.
- Disclaimer visible: "Zábava, ne předpověď. Hvězdy si dělají legraci, ne diagnózu."
- Original content only. Do not copy jokes from the internet.
- Isolated segment: all styles scoped under `.ar` root class in `app/astroroast/astroroast.css`. Do not change
  global CSS, other routes, `app/layout.tsx`, or `FontLinks.tsx`.

## Brand / visual direction ("crazy, but crafted")
- Deep space background `#0B0420` with grain. Neon hot pink `#FF2E88`, acid lime `#C6FF3D`, electric violet
  `#7B5CFF`, cream text `#FFF6E9`. Tokens as CSS custom properties on `.ar`.
- Chunky display type (next/font/google, e.g. "Bricolage Grotesque" 800 or "Unbounded" 800) + readable body
  ("Inter"/"DM Sans"). Use only fonts with latin-ext (Czech diacritics).
- Sticker, sticky-note and tabloid vibe: rotated badges, thick outlines, hard offset shadows, emoji as icons.
- **Spice meter 🌶️ 1–5** is the hero control. UI escalates with the level. Level 4 shows a red glow. Level 5 shows
  "KOSMICKÁ POPRAVA" with a screen shake and flames (respect `prefers-reduced-motion`).
- Big tap targets (≥44px). Works at 360px width. No horizontal scroll.

## Pages (all under `app/astroroast/`)
| Route | What |
|---|---|
| `/astroroast` | Hero + generator (date input → sign, cusp confirm; or pick sign directly), spice meter, topic chips (vztahy, práce, život, přátelé, narozeniny), self/friend toggle. Result inline with animated reveal. Below: "Denní roast" for all 12 signs (today), series teasers, couple CTA, footer disclaimer. |
| `/astroroast/r/[code]` | Shareable result page (server-rendered from code). OG image. Big CTA "A teď to zkus na sebe". |
| `/astroroast/znameni/[sign]` | 12 SEO pages: tagline, motifs, catalog jokes by series, today's daily roast, CTA to generator preset to the sign. `generateStaticParams`. |
| `/astroroast/par` | Couple Roast / Astro Battle: two signs (or two dates) → dialogue scene, fake compatibility, share. Soft cross-sell box to `/mezi-vami`: "To byla nadsázka. Chcete vidět, jaké vztahové motivy nabízí hlubší výklad?" Opt-in link only. |
| `/astroroast/p/[code]` | Shareable couple result page + OG image. |
| `/astroroast/sitemap.xml` | via `app/astroroast/sitemap.ts`. |

## Share
- Web Share API with a fallback to copy link. Also "Stáhnout kartu" (PNG 1080×1920 story) and 1200×630 OG.
- Image route: `app/astroroast/api/karta/route.tsx` (GET `?c=<code>&f=story|og`), `next/og` ImageResponse,
  nodejs runtime, fonts from TTF files committed in the repo (reuse `mezi-vami/fonts/Jost.ttf`, or add an OFL
  TTF under `astroroast/fonts/`). Cache headers: public, immutable (deterministic output).
- Share text: `"{headline}" — hvězdy mě právě roastnuly 🌶️ Zkus to na sebe:` + URL.

## Monetization hooks (MVP = measure intent, no payments)
- "Rozšířený roast (celý rok, 12 kapitol) — 49 Kč" and "Narozeninové PDF pro kámoše — 149 Kč": fake-door
  buttons. They open a "Brzy! Zatím zdarma tohle 👇" sheet. Track the click.
- Cross-sell to MEZI VÁMI only on the couple page, opt-in.
- Analytics: `astroroast/analytics.ts` exports `track(event, props)`. It pushes to `window.dataLayer` when
  present and is a no-op otherwise. Never pass a birth date. Events: generate, share, download, fake_door,
  crosssell, couple_generate.

## Engine (`astroroast/engine/`)
Pure TS, no React, unit-tested with vitest (`astroroast/**/*.test.ts` is added to `vitest.config.ts`).
- `signs.ts`: 12 `SignInfo` entries (Czech names, glyphs, ranges, motifs, taglines).
- `resolve.ts`: `resolveSign(month, day)` with cusp detection (±1 day of a boundary).
- `rng.ts`: seeded PRNG (mulberry32) and pick helpers.
- `roast.ts`: `generateRoast`. It combines sign motifs × level-specific templates × topic-specific situations.
  Each sign × level must produce ≥ 30 distinct combinations. Grammar must be correct Czech (no `{name}`
  declension problems; write templates that avoid declension or carry pre-declined forms in `SignInfo`).
- `couple.ts`: `generateCouple`.
- `daily.ts`: `dailyRoast(sign, isoDate)`, deterministic from date + sign.
- `share.ts`: encode/decode. Compact, url-safe, versioned (`v1`). Invalid codes return null.
- `index.ts`: re-exports.
Content library (`astroroast/content/`): `catalog.ts` (CatalogJoke[], ≥ 8 per sign across the series:
"Sejde se 10…", "Na dovolené", "Jak odpovídá na zprávu", "Co říká vs. co tím myslí", one-liners) and
`fragments.ts` (template fragments the engine uses).

## Out of scope for MVP
Payments, accounts, LLM generation, email capture, i18n, audio/video.

## Text models (internal comparison tool)
Every user-facing text exists in three variants. The id stays stable (used by `?m=` and `localStorage`); the label says who
really wrote it (`MODEL_LABELS` in `astroroast/types.ts`, verified from agent transcripts and `codex exec` headers):

| id | Label | Who wrote it |
|---|---|---|
| `claude` | Sonnet 5.5 · high + medium | `claude-sonnet-5-5`: UI copy and catalog at effort high (MVP), roasts after the humor expansion at effort medium. No writing skills. |
| `codex` | GPT-6.1-sol · xhigh | Codex CLI 0.166.0, `gpt-6.1-sol`, reasoning effort xhigh. |
| `skills` | Sonnet 5.5 · high + skills | `claude-sonnet-5-5` effort high, rewriting the claude draft with the skills `cesky-humor`, `humanizer-czech` (konverzační), `anti-slop-writing`, `copywriting` 2.3.6. |

A sticky strip "interní · Texty píše: [...]" switches them instantly. The choice is `?m=claude|codex|skills` (wins), then
`localStorage["ar-model"]`, else `claude`. Share codes (v1), `/r`, `/p`, OG and karta stay claude-only. No analytics event.
- Content: `astroroast/content/<model>/{signs/<sign>.ts, shared.ts, catalog.ts, signinfo.ts}`, assembled in
  `astroroast/content/index.ts` (`CONTENT[model]`). Topics are per level: `t: Record<Topic, Five<string[]>>`.
- UI copy: `astroroast/copy/{types,claude,codex,skills,index}.ts` (`COPY[model]`, typed by `UiCopy`).
- Engine: `generateRoast(input)` reads `input.model`, `generateCouple(a,b,level,seed,model)`, `dailyRoast(sign,iso,model)`, `signText(sign,model)`.
- Copy lint: `npm run lint:astroroast-copy` (typopo `cs` typography + cspell `cs-cz` spelling, offline, per model). Project words in
  `astroroast/cspell.json`. Report only, not in CI yet: typopo also flags missing non-breaking spaces (fix at render time later)
  and has false positives (it moves a full stop inside quotes after a fragment).

### How to remove the model toggle
1. Quick off: set `MODEL_TOGGLE_ENABLED = false` in `astroroast/copy/index.ts`. No toggle is rendered, the model is always
   `claude`, `<T>` renders only the claude variant (no hidden codex HTML).
2. Full removal: delete `app/astroroast/_components/{ModelProvider,ModelToggle,T}.tsx` and the block between
   "INTERNAL MODEL TOGGLE" and "END INTERNAL MODEL TOGGLE" at the end of `astroroast.css`; make the layout render
   `<div className="ar">` instead of `<ModelProvider>` and replace `useCopy()`/`<T>` with `COPY.claude`; delete
   `astroroast/content/codex/` and `astroroast/copy/codex.ts`, drop the `model` parameters.
