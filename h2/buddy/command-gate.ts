import { detectFastPathControlCommand, type FastPathControlCommand } from "@/h2/ingestion/control-fast-path";

/**
 * Command Gate (BUILD-10 plán, DEC-007 bod 3-5) — první stage v §7.1
 * runtime pipeline, uvnitř už claimnutého jobu.
 *
 * Re-detekuje `detectFastPathControlCommand()` (sdílené s BUILD-04) nad
 * dešifrovaným textem zprávy. Shoda je strukturální důkaz, že
 * `bumpOwnerControlEpochWithClient()` už proběhl PŘI INGESTU (stejná
 * transakce jako raw_event/job insert, `h2/ingestion/ingest-message.ts`)
 * — tenhle Gate nesmí bumpnout epoch znovu (žádný nový sloupec/marker,
 * dvě volání stejné čisté funkce nad stejným textem dají stejný výsledek).
 * Job se dokončí jako no-op s potvrzením, celý zbytek pipeline (entity/
 * intent/stance/Sonnet) se přeskočí.
 *
 * ÚMYSLNĚ užší scope, než §8.1 popisuje v plné šíři: holé "stop"/"pause"
 * v přirozené větě, `IGNORE` s cílem a `DELETE`/`HARD_DELETE`/
 * `RECONSIDER`/`CORRECT` příkazy jsou podle BUILD-10-PLAN.md taky
 * Command Gate odpovědnost, ale jejich přesná protokolová syntaxe (I7.7 —
 * "control intent má být protokolová struktura, ne odvozený z přirozeného
 * jazyka") není v žádném dostupném zdroji (BUILD-10-PLAN.md, DECISIONS.md)
 * — jen v uzamčené Notion Technical Architecture §8.1, ke které Code nemá
 * plný přístup. Hádat syntaxi by riskovalo přesně tu chybu, kterou I7.6
 * zakazuje (chybná klasifikace nevratně bere zprávě normální zpracování).
 * Zůstává mimo scope téhle implementace — forward-pointer, ne provedeno.
 */
export type CommandGateResult =
  | { isControlCommand: true; command: FastPathControlCommand; confirmationText: string }
  | { isControlCommand: false };

const CONFIRMATION_TEXT: Readonly<Record<FastPathControlCommand, string>> = {
  STOP: "STOP přijato. Buddy do odvolání nereaguje — napiš /resume, až budeš chtít pokračovat.",
  PAUSE: "PAUSE přijato. Buddy do odvolání nereaguje — napiš /resume, až budeš chtít pokračovat.",
  RESUME: "RESUME přijato. Buddy zase reaguje normálně.",
};

export function runCommandGate(messageText: string): CommandGateResult {
  const command = detectFastPathControlCommand(messageText);
  if (!command) {
    return { isControlCommand: false };
  }
  return { isControlCommand: true, command, confirmationText: CONFIRMATION_TEXT[command] };
}
