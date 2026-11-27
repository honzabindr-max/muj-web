// AstroRoast.ai: registr obsahu. CONTENT[model] skládá per-model soubory (signs/*, shared, catalog, signinfo).
// Oba modely musí mít shodnou strukturu (hlídá test). Codex složka je zatím kopie claude.

import { DEFAULT_MODEL, SIGN_IDS, type CatalogJoke, type ModelId, type SignId } from "../types";
import { toSignFragments } from "./build";
import type { ModelContent, RawSign } from "./types";

import claude_beran from "./claude/signs/beran";
import claude_byk from "./claude/signs/byk";
import claude_blizenci from "./claude/signs/blizenci";
import claude_rak from "./claude/signs/rak";
import claude_lev from "./claude/signs/lev";
import claude_panna from "./claude/signs/panna";
import claude_vahy from "./claude/signs/vahy";
import claude_stir from "./claude/signs/stir";
import claude_strelec from "./claude/signs/strelec";
import claude_kozoroh from "./claude/signs/kozoroh";
import claude_vodnar from "./claude/signs/vodnar";
import claude_ryby from "./claude/signs/ryby";
import * as claudeShared from "./claude/shared";
import * as claudeCatalog from "./claude/catalog";
import { SIGN_TEXT as claudeSignText } from "./claude/signinfo";
import codex_beran from "./codex/signs/beran";
import codex_byk from "./codex/signs/byk";
import codex_blizenci from "./codex/signs/blizenci";
import codex_rak from "./codex/signs/rak";
import codex_lev from "./codex/signs/lev";
import codex_panna from "./codex/signs/panna";
import codex_vahy from "./codex/signs/vahy";
import codex_stir from "./codex/signs/stir";
import codex_strelec from "./codex/signs/strelec";
import codex_kozoroh from "./codex/signs/kozoroh";
import codex_vodnar from "./codex/signs/vodnar";
import codex_ryby from "./codex/signs/ryby";
import * as codexShared from "./codex/shared";
import * as codexCatalog from "./codex/catalog";
import { SIGN_TEXT as codexSignText } from "./codex/signinfo";

function assemble(
  raws: Record<SignId, RawSign>,
  shared: typeof claudeShared,
  catalog: typeof claudeCatalog,
  signText: typeof claudeSignText,
): ModelContent {
  const fragments = {} as ModelContent["fragments"];
  for (const id of SIGN_IDS) fragments[id] = toSignFragments(raws[id]);
  return {
    fragments,
    kickers: shared.KICKERS,
    friendKickers: shared.FRIEND_KICKERS,
    topicStats: shared.TOPIC_STATS,
    coupleSituations: shared.COUPLE_SITUATIONS,
    couplePairs: shared.COUPLE_PAIRS,
    coupleOutros: shared.COUPLE_OUTROS,
    stejneEcho: shared.STEJNE_ECHO,
    catalog: catalog.CATALOG,
    seriesLabels: catalog.SERIES_LABELS,
    signText,
  };
}

const claudeRaws: Record<SignId, RawSign> = {
  beran: claude_beran,
  byk: claude_byk,
  blizenci: claude_blizenci,
  rak: claude_rak,
  lev: claude_lev,
  panna: claude_panna,
  vahy: claude_vahy,
  stir: claude_stir,
  strelec: claude_strelec,
  kozoroh: claude_kozoroh,
  vodnar: claude_vodnar,
  ryby: claude_ryby,
};
const codexRaws: Record<SignId, RawSign> = {
  beran: codex_beran,
  byk: codex_byk,
  blizenci: codex_blizenci,
  rak: codex_rak,
  lev: codex_lev,
  panna: codex_panna,
  vahy: codex_vahy,
  stir: codex_stir,
  strelec: codex_strelec,
  kozoroh: codex_kozoroh,
  vodnar: codex_vodnar,
  ryby: codex_ryby,
};

export const CONTENT: Record<ModelId, ModelContent> = {
  claude: assemble(claudeRaws, claudeShared, claudeCatalog, claudeSignText),
  codex: assemble(codexRaws, codexShared, codexCatalog, codexSignText),
};

export { COMPAT_BASE } from "./compat";
export { SERIES_ORDER, toSignFragments } from "./build";
export type { ElementPairKey, ModelContent, RawSign, SignFragments } from "./types";

/** Popisky sérií (výchozí model). Pro konkrétní model použij CONTENT[model].seriesLabels. */
export const SERIES_LABELS: Record<CatalogJoke["series"], string> = CONTENT[DEFAULT_MODEL].seriesLabels;

export function catalogFor(
  sign: SignId,
  series?: CatalogJoke["series"],
  model: ModelId = DEFAULT_MODEL,
): CatalogJoke[] {
  return CONTENT[model].catalog.filter((j) => j.sign === sign && (series === undefined || j.series === series));
}
