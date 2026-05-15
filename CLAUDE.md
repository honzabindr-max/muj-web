# Good Inventions — kontext pro Claude Code

## O projektu
- **Doména:** good-inventions.work
- **Stack:** Next.js (App Router) + TypeScript
- **Hosting:** Vercel (deploy z `main`, auto)
- **Repo:** honzabindr-max/muj-web-next
- **DNS:** Cloudflare + Wedos

## Struktura
- `public/homepage.html` — produkční statická homepage (single file, vlastní styly inline)
- `app/` — Next.js App Router; route handler serves `public/homepage.html` jako homepage
- Žádné `app/page.tsx` (bylo nahrazeno statickým HTML přes route handler)

## Workflow pro každou změnu
1. Udělej úpravu lokálně
2. Ověř lokálně: `npm run dev` nebo `npm run build`
3. `git add` + commit s rozumnou zprávou (konvence: `fix:`, `feat:`, `chore:`)
4. `git push` na `main` → Vercel deploy proběhne sám
5. Po pushi zkontroluj produkci na good-inventions.work

## Konvence komunikace (uživatel = Honzík)
- Mluvíme česky
- Preferuji **exact copy-paste příkazy**, žádné placeholders
- Pro vícesouborové změny preferuji **jeden heredoc / jeden bash blok**
- Stručně, k věci, žádné dlouhé úvody
- Před commitem na produkci vždy ověř lokálně

## Známé gotchas
- **Vercel Framework Preset musí být "Next.js"** (ne "Other"), jinak App Router nejede
- **Global Vercel Authentication musí být OFF** pro veřejné routy
- **Next.js `<Link prefetch>`** může neočekávaně triggernout auth dialog → použij `prefetch={false}`
- **Supabase REST API** capuje response na 1000 řádků; pro count použij HEAD request s `Prefer: count=exact` a `Range: 0-0`
- Heredoc pasti: pozor na `<< 'EOF'` markery, ať nezůstanou v souboru (stalo se s homepage.html)

## Brand
- "Brain first, then everything else"
- Anti-hype, thoughtful, elegantní zdrženlivost
- Tón v copy: tichý, sebejistý, žádné AI buzzwords
