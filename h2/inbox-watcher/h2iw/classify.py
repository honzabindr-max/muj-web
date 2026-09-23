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
        "note_subtype": _nullable({"type": "string", "enum": NOTE_SUBTYPES}),
        "life": _nullable({"type": "string", "enum": LIVES}),
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
        "note_subtype",
        "life",
        "multiple_items",
        "reason",
    ],
    "additionalProperties": False,
}

SYSTEM_PROMPT = """Třídíš jednu položku z Todoist Doručených podle H2 Planning OS v0.3. Vstup je často diktovaný, česky, může obsahovat překlepy. Vrať jen JSON podle schématu.

TYPY
- TASK: něco, co mám udělat já. Bez pevného času.
- WAITING: čekám na někoho/něco („čekám až…", „až pošle…", „ozve se…").
- EVENT: MŮJ pevný závazek s konkrétním časem — já jsem aktér („mám", „jdu", „jedu", „schůzka s…", lékař, kontrola). Musí mít datum I čas začátku.
- INFO: plán nebo pohyb JINÉ osoby, kde já nejsem aktér — podmětem je někdo jiný („Markétka přijede v 19:30", „děti odjíždí", „mamka bude pryč", „Markétka má akci"). I když je uveden přesný čas, je to INFO, ne EVENT.
- BLOCK: vyhrazuji si čas na práci na úkolu, který by jinak byl v seznamu úkolů („v sobotu 10–12 dělám na…", „zítra 14–16 vyřídit papíry", „odnést sedačku", „opravit skříň", „zablokuj mi…").
- EVENT vs BLOCK: EVENT = samotná naplánovaná činnost nebo závazek (lékař, schůzka, večeře, kolo, jóga, kino, výlet); BLOCK = vyhrazený čas na odpracování úkolu.
- Nová věc + žádost o připomenutí („připomeň mi…", „přidej připomenutí", „upozorni mě…") je TASK (s due_date a due_time, pokud je čas uveden), NIKDY COMMAND. „Přidej připomenutí" k nové věci není změna existující položky.
- COMMAND: (a) pokyn ke změně něčeho, co už existuje v Todoistu, kalendáři nebo H2 („smaž…", „přesuň úkol…", „přejmenuj…", „zruš…", „posuň…", „odlož…", „označ jako hotové"); (b) stavová aktualizace existujícího úkolu — hlášení, co se stalo s něčím, co už řeším („hotovo…", „nedovolal jsem se X, napsal jsem mu a čekám", „zavolal jsem do servisu, auto bude v pátek", „nestihl jsem…, přesuň to", „účetní se neozvala, zkusím to znovu ve čtvrtek"), i když obsahuje „čekám" nebo „připomeň mi to". COMMAND jen když se text týká něčeho, co už existuje (odkazuje na dřívější úkol, událost nebo to, co se už stalo). Celé hlášení je JEDEN COMMAND, multiple_items = false. Nikdy z toho nedělej TASK ani WAITING. Pozor: „přesunout gauč do obýváku" je nový fyzický úkol (TASK) a „čekám až mi Petr pošle smlouvu" bez hlášení o proběhlé akci je nové WAITING.
- NOTE: poznámka bez akce a bez termínu — nápad (idea), deník/pocity (journal), informace o člověku (person), jiná informace k zapamatování (other). Nic k vykonání, nic do kalendáře.
- UNKNOWN: nesrozumitelné, nesmyslné, nebo pevný termín bez jasného času. V reason napiš česky krátce proč.
- Dvě a více samostatných akcí nebo termínů v jednom vstupu („vyzvednout léky a v pátek v 17:00 kadeřník"): multiple_items = true a type UNKNOWN. Nikdy nevybírej jen první věc. Jinak multiple_items = false.

POLE
- title: krátký český název v rozkazovacím/věcném tvaru, bez emoji, bez data a času, velké první písmeno, max 80 znaků. Oprav zjevné překlepy diktování.
- context: telefon (volat i psát zprávu), doma, venku — jen když pomáhá rozhodnout, kde/jak to udělat; jinak null. U WAITING vždy null.
- area: jen když je oblast jasná, jinak null. prace = placená práce/klienti; projekty = vlastní projekty a vývoj; zdravi; rodina; vztah = partnerka Markétka; domacnost = byt, nákupy, opravy; zvirata; urady = úřady a administrativa; finance; pohyb = sport.
- due_date (YYYY-MM-DD): JEN když vstup výslovně říká den, kdy to chci dělat („zítra", „v pondělí"). Jinak null. U WAITING = den follow-upu, pokud je uveden.
- due_time (HH:MM): jen u TASK/WAITING, když je výslovně uveden čas a jde o úkol, ne schůzku. Jinak null.
- deadline_date (YYYY-MM-DD): JEN výslovný termín „do…" („do pátku", „nejpozději 30. 9."). „Do pátku" je deadline, ne due_date.
- start/end (YYYY-MM-DDTHH:MM, místní čas Praha): u EVENT, BLOCK a časovaného INFO. end jen když je uveden konec nebo délka.
- all_day_date (YYYY-MM-DD): jen u INFO bez času (celodenní).
- Nikdy si nevymýšlej datum ani čas, které ve vstupu nejsou. Relativní dny přepočítej podle tabulky níže.
- Den v týdnu („v pátek", „ve čtvrtek") = NEJBLIŽŠÍ takový den z tabulky od zítřka dál (dnešní den jen se slovem „dnes"); „příští pátek" = o týden později. Datum vždy ověř v tabulce.
- title: jen samotná činnost, bez dne a času („Pivo s Petrem", ne „Jít v pátek v 18 s Petrem na pivo").
- Pevný termín (lékař, kontrola, schůzka) bez výslovného času ve vstupu = UNKNOWN. start nikdy nevyplňuj bez času ze vstupu, ani jako 00:00.
- Telefonát nebo zpráva s časem („zítra v 8 zavolat do školky") je TASK s due_date + due_time a context telefon, ne EVENT. EVENT je jen schůzka, návštěva nebo termín u někoho.
- life: jen u EVENT a BLOCK, jinak null. Rozhoduje, co v tom čase SKUTEČNĚ DĚLÁM, ne čeho se věc týká:
  povinnost = svět určuje můj čas, musím tam být (lékař, rehabilitace, úřad, STK, povinná pracovní schůzka, vlak, pevný termín s jinými lidmi kvůli povinnosti);
  fokus = pracuji hlavou (telefonáty, deep work, papíry, finance, rešerše, e-maily, „najít sedačku na internetu");
  regenerace = pečuji o tělo a energii (sport, kolo, procházka, jóga, sauna, odpočinek, meditace);
  lide = skutečně věnuji čas lidem (večeře s Markétkou, oběd s dětmi, kamarádi, popřát k narozeninám);
  domov = fyzicky pečuji o byt rukama (odnést sedačku, opravit skříň, sklep, stěhování);
  zazitky = žiju, cestuji, bavím se (výlet, kino, koncert, restaurace, dovolená, Burčákový pochod).
  Když je hlavní náplní čas s konkrétním člověkem (pivo s Petrem, večeře s Markétkou, oběd s dětmi, návštěva kamaráda), je to lide, i když se odehrává v hospodě nebo restauraci. zazitky jen když je hlavní náplní samotný zážitek (kino, pochod, výlet, koncert, cesta).
  Plánování zážitku nebo administrativa kvůli lidem (zavolat, zarezervovat) = fokus. Program jiných lidí = INFO, ne life.
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


def build_user_message(text: str, description: str, now: datetime) -> str:
    body = f"POLOŽKA:\n{text.strip()}"
    if description and description.strip():
        body += f"\n\nPOPIS:\n{description.strip()}"
    return f"{date_context(now)}\n\n{body}"


def classify(
    client: anthropic.Anthropic, text: str, description: str, now: datetime
) -> ClassifyResult:
    resp = client.messages.create(
        model=config.MODEL,
        max_tokens=600,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": build_user_message(text, description, now)}],
        output_config={"format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
    )
    usage = resp.usage
    in_tok, out_tok = usage.input_tokens, usage.output_tokens
    if resp.stop_reason != "end_turn":
        return ClassifyResult(None, in_tok, out_tok, f"stop_reason={resp.stop_reason}")
    text_blocks = [b.text for b in resp.content if b.type == "text"]
    if not text_blocks:
        return ClassifyResult(None, in_tok, out_tok, "no text block")
    try:
        data = json.loads(text_blocks[0])
    except json.JSONDecodeError:
        return ClassifyResult(None, in_tok, out_tok, "invalid JSON")
    return ClassifyResult(data, in_tok, out_tok, None)
