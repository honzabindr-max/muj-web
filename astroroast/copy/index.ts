// AstroRoast.ai: registr UI textů podle modelu.
//
// INTERNÍ NÁSTROJ NA SROVNÁNÍ MODELŮ. Přepínač Claude/Codex je dočasný a později se odstraní.
// Jak: nastav MODEL_TOGGLE_ENABLED = false (přepínač zmizí, vždy se vrací "claude", žádné skryté HTML),
// nebo ho smaž úplně (viz "How to remove the model toggle" v docs/astroroast/SPEC.md).

import type { ModelId } from "../types";
import { claude } from "./claude";
import { codex } from "./codex";
import type { UiCopy } from "./types";

export const MODEL_TOGGLE_ENABLED = true;

export const COPY: Record<ModelId, UiCopy> = { claude, codex };

export type { UiCopy } from "./types";
