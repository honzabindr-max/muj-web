"""Single Haiku call per new Inbox item, strict JSON via Structured Outputs.

The model only proposes. validate.py decides what is allowed; render.py and
apply.py map enums to labels/emoji deterministically.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta

import anthropic

from . import config

TYPES = ["TASK", "WAITING", "EVENT", "INFO", "BLOCK", "NOTE", "COMMAND", "UNKNOWN"]
NOTE_SUBTYPES = ["idea", "journal", "person", "other"]
LIVES = ["povinnost", "fokus", "regenerace", "lide", "domov", "zazitky"]
CONTEXTS = ["telefon", "doma", "venku"]
AREAS = [
    "prace",
    "projekty",
    "zdravi",
    "rodina",
    "vztah",
    "domacnost",
    "zvirata",
    "urady",
    "finance",
    "pohyb",
]


def _nullable(schema: dict) -> dict:
    return {"anyOf": [schema, {"type": "null"}]}


OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": TYPES},
        "title": {"type": "string"},
        "context": _nullable({"type": "string", "enum": CONTEXTS}),
        "area": _nullable({"type": "string", "enum": AREAS}),
        "due_date": _nullable({"type": "string"}),
        "due_time": _nullable({"type": "string"}),
        "deadline_date": _nullable({"type": "string"}),
        "start": _nullable({"type": "string"}),
        "end": _nullable({"type": "string"}),
        "all_day_date": _nullable({"type": "string"}),
        "all_day_end_date": _nullable({"type": "string"}),
        "note_subtype": _nullable({"type": "string", "enum": NOTE_SUBTYPES}),
        "life": _nullable({"type": "string", "enum": LIVES}),
        "duration_min": _nullable({"type": "integer", "enum": [15, 30, 60, 120]}),
        "multiple_items": {"type": "boolean"},
        "reason": {"type": "string"},
    },
    "required": [
        "type",
        "title",
        "context",
        "area",
        "due_date",
        "due_time",
        "deadline_date",
        "start",
        "end",
        "all_day_date",
        "all_day_end_date",
        "note_subtype",
        "life",
        "duration_min",
        "multiple_items",
        "reason",
    ],
    "additionalProperties": False,
}

SYSTEM_PROMPT = """Třídíš jednu položku z Todoist Doručených podle H2 Planning OS v0.3. Vstup je často diktovaný, česky, může obsahovat překlepy. Vrať jen JSON podle schématu.

TYPY
- TASK: něco, co mám udělat já. Bez pevného času.
- WAITING: čekám na někoho/něco („čekám až…", „až pošle…", „ozve se…").
- EVENT: MŮJ pevný závazek — já jsem aktér („mám", „jdu", „jedu", „schůzka s…", lékař, kontrola). Musí mít datum; čas začátku jen když je ve vstupu uveden (jinak all_day_date, viz níže).
- INFO: plán nebo pohyb JINÉ osoby, kde já nejsem aktér — podmětem je někdo jiný („Markétka přijede v 19:30", „děti odjíždí", „mamka bude pryč", „Markétka má akci"). I když je uveden přesný čas, je to INFO, ne EVENT.
- BLOCK: vyhrazuji si čas na práci na úkolu, který by jinak byl v seznamu úkolů („v sobotu 10–12 dělám na…", „zítra 14–16 vyřídit papíry", „odnést sedačku", „opravit skříň", „zablokuj mi…"). BLOCK vždy s výslovným časem začátku — bez něj to není BLOCK.
- Časový ROZSAH („od 10 do 11", „10–12", „9 až 10") u mé vlastní činnosti = BLOCK s start i end, nikdy TASK („Zítra od 10 do 11 volám Patrikovi" = BLOCK, life fokus). TASK s due_time jen při jednom časovém bodu („v 10 zavolat Patrikovi").
- EVENT s výslovným časem začátku → start (a end, je-li uveden). EVENT, kde vstup říká jen DEN bez přesného času (celodenní činnost s lidmi/zážitek: „v pondělí jedu se Sašenkou na houby"; pevný termín bez uvedeného času: „kontrola u zubaře v úterý", „schůzka ve čtvrtek, čas nevím"; výslovné „celý den") → all_day_date (ten den) a life, start nikdy nevymýšlej. Vícedenní EVENT („od pátku do neděle na horách", „dovolená 20.–25. 9.") → all_day_date (první den) + all_day_end_date (poslední den), bez start/end. Úplně bez dne i bez času („strávit večer s Markétkou bez mobilu", „někdy si zajít do kina") je to TASK.
- Čas bez dne („ve 14") = dnes; pokud dnes už ten čas minul, zítra.
- Věci „cestou" („cestou z baráku koupit žárovky ve 14") = TASK s časem (připomenutí se přidá samo), NIKDY BLOCK ani EVENT.
- „Podívat se", „nezapomenout", „připomeň mi" = TASK s datem (a časem, pokud zazní), NIKDY kalendář (EVENT/BLOCK/INFO).
- Rituály a oběd (cigaretka, kafe, oběd — bez konkrétního člověka) nezakládej, ani když zazní čas: type UNKNOWN, reason „rituál spravuje Plánovač". Oběd s konkrétním člověkem („oběd s dětmi", „oběd s tátou") je EVENT lide.
- EVENT vs BLOCK: EVENT = samotná naplánovaná činnost nebo závazek (lékař, schůzka, večeře, kolo, jóga, kino, výlet); BLOCK = vyhrazený čas na odpracování úkolu.
- Nová věc + žádost o připomenutí („připomeň mi…", „přidej připomenutí", „upozorni mě…") je TASK (s due_date a due_time, pokud je čas uveden), NIKDY COMMAND. „Přidej připomenutí" k nové věci není změna existující položky.
- COMMAND: (a) pokyn ke změně něčeho, co už existuje v Todoistu, kalendáři nebo H2 („smaž…", „přesuň úkol…", „přejmenuj…", „zruš…", „posuň…", „odlož…", „označ jako hotové"); (b) stavová aktualizace existujícího úkolu — hlášení, co se stalo s něčím, co už řeším („hotovo…", „nedovolal jsem se X, napsal jsem mu a čekám", „zavolal jsem do servisu, auto bude v pátek", „nestihl jsem…, přesuň to", „účetní se neozvala, zkusím to znovu ve čtvrtek"), i když obsahuje „čekám" nebo „připomeň mi to". COMMAND jen když se text týká něčeho, co už existuje (odkazuje na dřívější úkol, událost nebo to, co se už stalo). Celé hlášení je JEDEN COMMAND, multiple_items = false. Nikdy z toho nedělej TASK ani WAITING. Pozor: „přesunout gauč do obýváku" je nový fyzický úkol (TASK) a „čekám až mi Petr pošle smlouvu" bez hlášení o proběhlé akci je nové WAITING.
- Obyčejný úkol bez dne a času je v pořádku („koupit mléko, chleba a vajíčka") = TASK bez due_date, NE UNKNOWN.
- „Napadlo mě…", „nápad:", „co kdyby…" bez výslovného pokynu něco udělat = NOTE idea, ne TASK. TASK jen když vstup říká, že to mám udělat („vymyslet krytí balkónu").
- NOTE: poznámka bez akce a bez termínu — nápad (idea), deník/pocity (journal), informace o člověku (person), jiná informace k zapamatování (other). Nic k vykonání, nic do kalendáře.
- UNKNOWN: nesrozumitelné nebo nesmyslné vstupy. Pevný termín bez jasného času už NENÍ UNKNOWN — je to EVENT s all_day_date (viz výše). V reason napiš česky krátce proč.
- Dvě a více samostatných akcí nebo termínů v jednom vstupu („vyzvednout léky a v pátek v 17:00 kadeřník"): multiple_items = true a type UNKNOWN. Nikdy nevybírej jen první věc. Jinak multiple_items = false.

POLE
- title: krátký český název v rozkazovacím/věcném tvaru, bez emoji, bez data a času, velké první písmeno, max 80 znaků. Oprav zjevné překlepy diktování.
- context: telefon (volat i psát zprávu), doma, venku — jen když pomáhá rozhodnout, kde/jak to udělat; jinak null. U WAITING vždy null.
- area: jen když je oblast jasná, jinak null. prace = placená práce/klienti; projekty = vlastní projekty a vývoj; zdravi; rodina; vztah = partnerka Markétka; domacnost = byt, nákupy, opravy; zvirata; urady = úřady a administrativa; finance; pohyb = sport.
- due_date (YYYY-MM-DD): JEN když vstup výslovně říká den, kdy to chci dělat („zítra", „v pondělí"). Jinak null. U WAITING = den follow-upu, pokud je uveden.
- due_time (HH:MM): jen u TASK/WAITING, když je výslovně uveden čas a jde o úkol, ne schůzku. Jinak null.
- deadline_date (YYYY-MM-DD): JEN výslovný termín „do…" („do pátku", „nejpozději 30. 9."). „Do pátku" je deadline, ne due_date.
- start/end (YYYY-MM-DDTHH:MM, místní čas Praha): u EVENT, BLOCK a časovaného INFO. end jen když je uveden konec nebo délka.
- all_day_date (YYYY-MM-DD): u INFO bez času, a u EVENT když je znám jen den bez přesného času (viz TYPY). all_day_end_date (YYYY-MM-DD): poslední den vícedenní akce (EVENT nebo INFO) — jen když all_day_date je vyplněné a akce trvá víc než jeden den, jinak null.
- Nikdy si nevymýšlej datum ani čas, které ve vstupu nejsou. Relativní dny přepočítej podle tabulky níže.
- Den v týdnu („v pátek", „ve čtvrtek") = NEJBLIŽŠÍ takový den z tabulky od zítřka dál (dnešní den jen se slovem „dnes"); „příští pátek" = o týden později. Datum vždy ověř v tabulce.
- title: jen samotná činnost, bez dne a času („Pivo s Petrem", ne „Jít v pátek v 18 s Petrem na pivo").
- Pevný termín (lékař, kontrola, schůzka) bez výslovného času ve vstupu = EVENT s all_day_date, ne UNKNOWN. start nikdy nevyplňuj bez času ze vstupu, ani jako 00:00.
- Telefonát nebo zpráva s časem („zítra v 8 zavolat do školky") je TASK s due_date + due_time a context telefon, ne EVENT. EVENT je jen schůzka, návštěva nebo termín u někoho.
- life: u TASK a BLOCK vždy vyplň. U EVENT vyplň jen když je z textu jasné, co doopravdy dělám, nebo jde o výslovnou povinnost (lékař, úřad, schůzka s klientem/pronajímatelkou…, viz níže); když to jasné není, nech life null — NIKDY nehádej povinnost jen proto, že jde o závazek, o kategorii rozhodne Plánovač. Příklad: „v úterý v 17 mám workshop" bez dalšího kontextu — nevíš, jestli je to práce, koníček nebo zážitek — life null, ne povinnost. Jinak (TASK/BLOCK) null. Rozhoduje, co při tom SKUTEČNĚ DĚLÁM, ne čeho se věc týká:
  povinnost = svět určuje můj čas, musím tam být nebo to po mně vyžaduje instituce či zdraví (lékař, rehabilitace, úřad, STK, KAŽDÁ pracovní schůzka nebo schůzka s klientem/účetní, vlak; u úkolů „objednat se k lékaři", „zajít na úřad pro občanku");
  fokus = pracuji hlavou (telefonáty, deep work, papíry, finance, rešerše, e-maily, „najít sedačku na internetu");
  regenerace = pečuji o tělo a energii (sport, kolo, procházka, jóga, sauna, odpočinek, meditace);
  lide = skutečně věnuji čas lidem (večeře s Markétkou, oběd s dětmi, kamarádi, popřát k narozeninám);
  domov = fyzicky pečuji o byt rukama (odnést sedačku, opravit skříň, sklep, stěhování);
  zazitky = žiju, cestuji, bavím se (výlet, kino, koncert, restaurace, dovolená, Burčákový pochod).
  Když je hlavní náplní čas s konkrétním člověkem (pivo s Petrem, večeře s Markétkou, oběd s dětmi, houby se Sašenkou, výlet s dětmi, návštěva kamaráda), je to lide, i když je to výlet, hospoda nebo restaurace. „Mám kluky" (děti jsou u mě) = lide, NE INFO. zazitky jen bez důrazu na konkrétní osobu (kino, pochod, koncert, dovolená).
  🚗 jízda autem nebo pochůzka NENÍ kategorie — life určuje její ÚČEL: k lékaři / na úřad / na STK = povinnost; na barák pracovat, stěhovat, rozdělat ložnici = domov; výlet = zazitky (s konkrétním člověkem lide).
  „Vymyslet / objednat / prodat / najít online / podívat se po" = fokus (hlava); fyzické provedení = domov (ruce).
  Plánování zážitku nebo administrativa kvůli lidem (zavolat, zarezervovat, domluvit) = fokus. Program jiných lidí = INFO, ne life.
  Příklady úkolů: „najít sedačku online" = fokus, „odnést sedačku" = domov, „vyčistit pračku" = domov, „zarezervovat hotel" = fokus, „jít si zaběhat" = regenerace, „popřát mámě k narozeninám" = lide, „jít do kina" = zazitky, „objednat se k lékaři" = povinnost, „domluvit s Petrem pivo" = fokus (domlouvání je administrativa, ne čas s ním), „schůzka s Honzou z Optimia" = povinnost.
- duration_min: jen u TASK odhad, kolik čistého času úkol zabere: 15, 30, 60 nebo 120 minut (nejbližší). Jinak null.
- note_subtype: jen u NOTE (idea | journal | person | other), jinak null. NOTE nemá žádné datum ani čas.
- reason: jedna krátká česká věta, proč tento typ."""


def date_context(now: datetime) -> str:
    names = ["pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota", "neděle"]
    local = now.astimezone(config.TZ)
    rows = []
    for i in range(15):
        d = (local + timedelta(days=i)).date()
        label = {0: " (dnes)", 1: " (zítra)", 2: " (pozítří)"}.get(i, "")
        rows.append(f"{d.isoformat()} {names[d.weekday()]}{label}")
    return f"Teď je {local.strftime('%Y-%m-%d %H:%M')} ({names[local.weekday()]}), Praha.\n" + "\n".join(rows)


@dataclass
class ClassifyResult:
    data: dict | None
    in_tokens: int
    out_tokens: int
    error: str | None
    cache_write: int = 0
    cache_read: int = 0


# The static part (rules + schema) is identical for every call, so it is cached.
# Haiku 4.5 only caches prefixes of >= 4096 tokens; the system prompt plus the
# output schema is above that (measured with count_tokens, see DEC-009 add. 10).
SYSTEM_BLOCKS = [{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}]


def request_params(text: str, description: str, now: datetime) -> dict:
    """Shared by the live watcher and the batch eval, so both hit the same cache."""
    return {
        "model": config.MODEL,
        "max_tokens": 600,
        "system": SYSTEM_BLOCKS,
        "messages": [{"role": "user", "content": build_user_message(text, description, now)}],
        "output_config": {"format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
    }


def parse_response(resp) -> ClassifyResult:
    usage = resp.usage
    in_tok, out_tok = usage.input_tokens, usage.output_tokens
    cw = getattr(usage, "cache_creation_input_tokens", 0) or 0
    cr = getattr(usage, "cache_read_input_tokens", 0) or 0
    if resp.stop_reason != "end_turn":
        return ClassifyResult(None, in_tok, out_tok, f"stop_reason={resp.stop_reason}", cw, cr)
    text_blocks = [b.text for b in resp.content if b.type == "text"]
    if not text_blocks:
        return ClassifyResult(None, in_tok, out_tok, "no text block", cw, cr)
    try:
        data = json.loads(text_blocks[0])
    except json.JSONDecodeError:
        return ClassifyResult(None, in_tok, out_tok, "invalid JSON", cw, cr)
    return ClassifyResult(data, in_tok, out_tok, None, cw, cr)


def build_user_message(text: str, description: str, now: datetime) -> str:
    body = f"POLOŽKA:\n{text.strip()}"
    if description and description.strip():
        body += f"\n\nPOPIS:\n{description.strip()}"
    return f"{date_context(now)}\n\n{body}"


def classify(
    client: anthropic.Anthropic, text: str, description: str, now: datetime
) -> ClassifyResult:
    return parse_response(client.messages.create(**request_params(text, description, now)))
