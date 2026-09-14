/**
 * Prezentační pomocníci pro zobrazení dat z _data/**. Datová vrstva se
 * nemění — tyto funkce jen upravují, jak se hodnoty vykreslí uživateli.
 */

/**
 * Odstraní inline citaci SOURCE_PACKu z konce věty, např.
 * "Přístup a lodní provoz ověřit. (SP:81)" → "Přístup a lodní provoz ověřit."
 * Číslo samotné zůstává dostupné přes samostatné pole `sp` na objektu
 * (zobrazuje se jen pod přepínačem "Zdroje").
 */
export function stripSpNote(text: string): string {
  return text.replace(/\s*\(SP:[\d–\-, ]+\)\s*$/i, "").trim();
}
