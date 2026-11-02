// Mission Control V2 — the "story" layer on top of the view model.
// Human headline, adaptive team order, flow with FIX loops and the list of important events are all
// composed by CODE from the order state, the role and the log (zadání V2 bod 2). No model writes text.
import type { LogEntry, Order } from "../types";
import {
  ACTIVE_STATES,
  buildView,
  classifyCalls,
  CREATOR_BY_DEPT,
  humanProblem,
  lockFor,
  safe,
  TEAM_BASE,
  type CallInfo,
  type FlowStep,
  type McInput,
  type McView,
  type Member,
  type TeamKey,
} from "./view";

export interface Headline {
  title: string;
  subtitle: string;
  /** Technical order title and id — secondary only. */
  technical: string;
  id: string;
  tone: "live" | "check" | "fix" | "wait" | "bad" | "ok" | "unknown";
  /** Verified by a live orchestrator process. */
  live: boolean;
}

export type StepKind = "plan" | "create" | "check" | "deliver" | "owner";

export interface StoryStep extends FlowStep {
  kind: StepKind;
  /** How many times work was returned from this step to the previous one (FIX loop). */
  returns: number;
}

export interface KeyEvent {
  at: string;
  order: string;
  orderTitle: string;
  kind: "handoff" | "verdict-ok" | "verdict-fix" | "verdict-stop" | "delivery" | "problem";
  text: string;
}

export interface Story {
  view: McView;
  headline?: Headline;
  /** Changes only when the phase really changes (drives the one-shot transition animation). */
  phaseKey: string;
  primary?: Member;
  secondary?: Member;
  others: Member[];
  flow: StoryStep[];
  nextHandoff?: string;
  events: KeyEvent[];
}

const OBJECT: Record<string, { work: string; fix: string; check: string }> = {
  copy: { work: "píše texty", fix: "upravuje texty po kontrole", check: "kontroluje texty" },
  vizual: { work: "navrhuje vizuál", fix: "upravuje vizuál po kontrole", check: "kontroluje vizuál" },
  dev: { work: "implementuje změnu", fix: "opravuje změnu po review", check: "kontroluje změnu kódu" },
};
const GENERIC = { work: "pracuje na výstupu", fix: "upravuje výstup po kontrole", check: "kontroluje výstup" };

const ORDINAL = ["", "prvního", "druhého", "třetího", "čtvrtého"];
const ordinal = (n: number) => ORDINAL[n] ?? `${n}.`;

function roles(o: Order) {
  const dept = o.brief?.department ?? "";
  const creatorKey: TeamKey | undefined = CREATOR_BY_DEPT[dept];
  const checkerKey: TeamKey = dept === "vizual" ? "brana" : "kontrolor";
  return {
    dept,
    creator: creatorKey ? TEAM_BASE[creatorKey].name : "Specialista",
    checker: TEAM_BASE[checkerKey].name,
    obj: OBJECT[dept] ?? GENERIC,
  };
}

/** Human title and subtitle from state + role (templates, deterministic). */
export function headline(o: Order, calls: CallInfo[], lockAlive: boolean, problem?: string): Headline {
  const { creator, checker, obj, dept } = roles(o);
  const technical = safe(o.brief?.title, 200) || "Zadání zatím nevzniklo";
  const base = { technical, id: o.id, live: false };
  const active = ACTIVE_STATES.includes(o.state) && o.state !== "PAUSED";
  if (active && !lockAlive)
    return {
      ...base,
      tone: "unknown",
      title: "Stav nelze ověřit",
      subtitle: "Záznam říká, že zakázka běží, ale orchestrátor teď nepracuje. Nic z toho nepovažuj za živou práci.",
    };
  const live = active && lockAlive;
  const r = o.fix_rounds;
  const briefPhase = !o.history.some((h) => h.event === "planned");
  const lastBriefCall = calls.filter((c) => c.order === o.id && c.phase === "brief").at(-1);
  const briefReturns = calls.filter((c) => c.order === o.id && c.phase === "brief" && c.member === "kontrolor" && c.result === "FIX").length;
  switch (o.state) {
    case "NEW":
      if (briefPhase && lastBriefCall?.member === "vedouci" && lastBriefCall.result === "ok")
        return { ...base, live, tone: "check", title: "Kontrolor prověřuje nové zadání", subtitle: "Ověřuje, že zadání vychází z HANDOFF a dá se splnit. Potom práci převezme specialista oddělení." };
      if (briefReturns > 0)
        return { ...base, live, tone: "fix", title: "Vedoucí přepisuje zadání po kontrole", subtitle: `Kontrolor vrátil zadání ${briefReturns}× k opravě. Následně ho prověří znovu.` };
      return { ...base, live, tone: "live", title: "Vedoucí připravuje další zakázku", subtitle: "Vybírá práci z HANDOFF a píše zadání. Potom ho prověří kontrolor z jiné rodiny modelů." };
    case "PLANNED":
      return { ...base, live, tone: "live", title: `${creator} přebírá zadání`, subtitle: "Zadání prošlo kontrolou. Tvorba právě začíná." };
    case "DOING":
      return { ...base, live, tone: "live", title: `${creator} ${obj.work}`, subtitle: `Pracuje na první verzi. Následně ji převezme ${checker.toLowerCase()}.` };
    case "FIXING":
      return { ...base, live, tone: "fix", title: `${creator} ${obj.fix}`, subtitle: `Zapracovává připomínky z ${ordinal(r)} kola. Následně proběhne opakovaná kontrola.` };
    case "CHECKING":
      return {
        ...base,
        live,
        tone: "check",
        title: `${checker} ${r > 0 ? "znovu " : ""}${obj.check}`,
        subtitle: r > 0 ? `Opakovaná kontrola po ${ordinal(r)} kole oprav. Výsledek: schválení, další oprava, nebo zastavení.` : `Ověřuje výstup, který vytvořil ${creator.toLowerCase()}. Výsledek: schválení, vrácení k opravě, nebo zastavení.`,
      };
    case "DELIVERED":
      return { ...base, live, tone: "ok", title: "Výstup prošel kontrolou", subtitle: dept === "dev" ? "Doručuje se jako PR draft." : "Doručuje se jako DRAFT v Notionu." };
    case "WAITING_OWNER":
      return { ...base, tone: "wait", title: "Výstup čeká na tvoje rozhodnutí", subtitle: `${checker} ho schválil a je doručený. Rozhodni GO nebo REJECT.` };
    case "DONE":
      return { ...base, tone: "ok", title: "Zakázka je hotová", subtitle: "Výstup prošel kontrolou a je doručený." };
    case "PAUSED":
      return { ...base, tone: "wait", title: "Práce je pozastavená", subtitle: "Narazila na limit předplatného. Pokračuje po jeho obnovení." };
    case "FAILED":
      return { ...base, tone: "bad", title: o.failure_reason?.startsWith("manual abort") ? "Zakázka byla ručně přerušena" : "Zakázka se zastavila", subtitle: problem ?? humanProblem(o.failure_reason) };
    case "UNKNOWN":
      return { ...base, tone: "bad", title: "Výsledek zakázky nelze ověřit", subtitle: `${problem ?? humanProblem(o.failure_reason)} Neber to jako úspěch.` };
  }
}

function stepKind(k: FlowStep["key"]): StepKind {
  return k === "lead" || k === "brief" ? "plan" : k === "creator" ? "create" : k === "checker" ? "check" : k === "delivery" ? "deliver" : "owner";
}

/** Flow with real return loops: brief FIX calls (zadání → vedoucí) and CHECKING→FIXING (kontrola → tvůrce). */
export function storyFlow(o: Order, flow: FlowStep[], calls: CallInfo[]): StoryStep[] {
  const briefReturns = calls.filter((c) => c.order === o.id && c.phase === "brief" && c.member === "kontrolor" && c.result === "FIX").length;
  const workReturns = o.history.filter((h) => h.from === "CHECKING" && h.to === "FIXING").length;
  return flow.map((s) => ({ ...s, kind: stepKind(s.key), returns: s.key === "brief" ? briefReturns : s.key === "checker" ? workReturns : 0 }));
}

/** Important events only: handoffs, verdicts, delivery, stops. Newest first. */
/** `cardName` resolves a logged `card` (recipe role) to a display name; recipe calls then read "X předal výstup dál". */
export function keyEvents(orders: Order[], log: LogEntry[], calls: CallInfo[], titles: Map<string, string>, limit = 12, cardName?: (card: string) => string): KeyEvent[] {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const out: KeyEvent[] = [];
  // a stop that a verdict already explains (same order, within 5 s) is not repeated
  const stops = calls.filter((c) => (c.member === "kontrolor" || c.member === "brana") && (c.result === "BLOCK" || c.result === "FIX"));
  const explained = (e: LogEntry) => stops.some((c) => c.order === e.order && Math.abs(Date.parse(c.ts) - Date.parse(e.ts)) <= 5000);
  for (const e of log) {
    const o = byId.get(e.order);
    if (!o) continue;
    const { creator, checker } = roles(o);
    const ev = (kind: KeyEvent["kind"], text: string) => out.push({ at: e.ts, order: e.order, orderTitle: titles.get(e.order) ?? e.order, kind, text });
    if (e.kind === "call") {
      const c = calls.find((x) => x.ts === e.ts && x.order === e.order && x.role === e.role);
      if (!c) continue;
      if (c.member === "vedouci" && e.result === "ok") ev("handoff", "Vedoucí předal zadání ke kontrole");
      else if (c.member === "kontrolor" && c.phase === "brief") {
        if (e.result === "PASS") ev("verdict-ok", `Kontrolor schválil zadání → ${creator}`);
        else if (e.result === "FIX") ev("verdict-fix", "Kontrolor vrátil zadání vedoucímu");
      } else if (cardName && (e as LogEntry & { card?: string }).card && c.role === "creator") {
        const n = cardName((e as LogEntry & { card?: string }).card!);
        if (e.result === "ok") ev("handoff", `${n} předal výstup dál`);
        else if (e.result === "error") ev("problem", `${n} narazil na chybu`);
      } else if (c.member === CREATOR_BY_DEPT[o.brief?.department ?? ""]) {
        if (e.result === "ok") ev("handoff", `${creator} předal výstup → ${checker}`);
        else if (e.result === "error") ev("problem", `${creator} narazil na chybu`);
      } else if (c.member === "kontrolor" || c.member === "brana") {
        if (e.result === "PASS") ev("verdict-ok", `${checker} schválil výstup`);
        else if (e.result === "FIX") ev("verdict-fix", `${checker} vrátil výstup k opravě → ${creator}`);
        else if (e.result === "BLOCK") ev("verdict-stop", `${checker} zastavil zakázku`);
      }
    } else if (e.kind === "transition") {
      if (e.to === "WAITING_OWNER") ev("delivery", "Doručeno jako DRAFT — čeká na tvoje GO");
      else if (e.to === "DONE") ev("delivery", "Doručeno — zakázka hotová");
      else if ((e.to === "FAILED" || e.to === "UNKNOWN") && !explained(e)) {
        if (e.event === "fail" && (o.failure_reason ?? "").startsWith("manual abort")) ev("problem", "Zakázka ručně přerušena");
        else if (e.to === "UNKNOWN") ev("problem", "Výsledek nelze ověřit — zakázka se nedoručila");
        else ev("problem", "Zakázka se zastavila");
      }
    }
  }
  return out.reverse().slice(0, limit);
}

export function buildStory(input: McInput): Story {
  const view = buildView(input);
  const orders = [...input.orders].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const calls = classifyCalls(orders, input.log);
  const cur = view.current ? orders.find((o) => o.id === view.current!.id) : undefined;
  const alive = cur ? lockFor(input, cur.id).alive : input.lock.alive;
  const hl = cur ? headline(cur, calls, alive, view.current?.problem?.what) : undefined;
  const rank = (m: Member) => (m.status === "working" || m.status === "checking" || (m.status === "unknown" && m.key !== "strazce") ? 0 : m.status === "waiting" ? 1 : 2);
  const primary = view.team.find((m) => rank(m) === 0);
  const secondary = view.team.find((m) => rank(m) === 1);
  const others = view.team.filter((m) => m !== primary && m !== secondary);
  const flow = cur && view.current ? storyFlow(cur, view.current.flow, calls) : [];
  const i = flow.findIndex((s) => s.status === "current");
  const nx = i >= 0 ? flow[i + 1] : undefined;
  const titles = new Map(view.orders.map((o) => [o.id, o.title]));
  return {
    view,
    headline: hl,
    phaseKey: cur ? `${cur.id}|${cur.state}|${cur.fix_rounds}|${alive ? 1 : 0}` : "none",
    primary,
    secondary,
    others,
    flow,
    nextHandoff: nx ? `${nx.label}${nx.who && !/nevolán|nevybráno/.test(nx.who) ? ` · ${nx.who}` : ""}` : undefined,
    events: keyEvents(orders, input.log, calls, titles),
  };
}

export const IDENTITY: Record<TeamKey, { mono: string; hue: string }> = {
  vedouci: { mono: "Ve", hue: "258" },
  copywriter: { mono: "Co", hue: "32" },
  designer: { mono: "De", hue: "322" },
  vyvojar: { mono: "Vý", hue: "205" },
  kontrolor: { mono: "Ko", hue: "168" },
  brana: { mono: "Br", hue: "190" },
  strazce: { mono: "St", hue: "140" },
};

/** Minimal geometric mark per role (inline SVG, currentColor). */
export function symbol(k: TeamKey, size = 28): string {
  const p: Record<TeamKey, string> = {
    // north star: the one who sets direction
    vedouci: '<path d="M16 3 L19 13 L29 16 L19 19 L16 29 L13 19 L3 16 L13 13 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="16" cy="16" r="2" fill="currentColor"/>',
    // pen nib stroke: words
    copywriter: '<path d="M7 25 C11 12, 18 9, 25 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M7 25 L12 24" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="25" cy="7" r="2.2" fill="currentColor"/>',
    // two overlapping circles: form and composition
    designer: '<circle cx="12.5" cy="16" r="7.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="19.5" cy="16" r="7.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    // brackets: code
    vyvojar: '<path d="M12 7 L6 16 L12 25" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 7 L26 16 L20 25" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 9 L14.5 23" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    // diamond with check: review
    kontrolor: '<path d="M16 4 L28 16 L16 28 L4 16 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M11.5 16.2 L14.8 19.4 L20.8 12.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    // arch gate: independent release gate
    brana: '<path d="M7 27 V14 A9 9 0 0 1 25 14 V27" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4 27 H28" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M16 9 V27" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2.5"/>',
    // hexagon: guard of invariants
    strazce: '<path d="M16 3.5 L27 9.75 V22.25 L16 28.5 L5 22.25 V9.75 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="16" cy="16" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  };
  return `<svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true" focusable="false">${p[k]}</svg>`;
}
