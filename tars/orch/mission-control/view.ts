// TARS Mission Control — view model.
// Pure function: documented data (state.json, log.jsonl, run lock, specialist cards) → everything the
// owner sees. No LLM, no guesses: every status and number is computed here from the input, and every
// value carries enough origin to be traced (zadání §5 „Pravda nad vizuálním efektem“).
import { redactPaths, scanSecrets } from "../secret-scan";
import type { LogEntry, Order, OrderState } from "../types";

export type SysStatus = "working" | "waiting" | "paused" | "problem" | "unavailable" | "unknown";

export const SYS_LABEL: Record<SysStatus, string> = {
  working: "Pracuje",
  waiting: "Čeká",
  paused: "Pozastaveno",
  problem: "Problém",
  unavailable: "Nedostupné",
  unknown: "Nelze ověřit",
};

export interface LockInfo {
  /** runs/.lock exists. */
  present: boolean;
  /** The PID in the lock belongs to a live process. */
  alive: boolean;
  mtime?: string;
}

/** Parsed specialist card (tars/orch/specialists/<mise>/<role>.md). */
export interface CardDoc {
  role: string;
  title: string;
  model?: string;
  family?: string;
  adapter?: string;
  rung?: string;
  file: string;
  /** First sentence of „1. Mise role a model“. */
  mission?: string;
  /** Lines of section „Postup“ (§2c); undefined = not defined in the card. */
  postup?: string[];
  /** Lines of section „Dosah“ (§2c); undefined = not defined in the card. */
  dosah?: string[];
}

export interface McInput {
  orders: Order[];
  log: LogEntry[];
  lock: LockInfo;
  /** role key of a card → first sentence of „1. Mise role a model“. */
  cards: Record<string, string>;
  /** Order id → artifact file names (relative to runs/<id>/). */
  files: Record<string, string[]>;
  /** launchd job installed? undefined = not checked. */
  scheduler?: boolean;
  now: string;
  /** Demo mode: fixture data, always labelled „Ukázková data“. */
  demo?: boolean;
  /** Full specialist cards (role page). Optional: older callers pass only `cards`. */
  cardDocs?: Record<string, CardDoc>;
  /** Per-order run locks (TARS-ORCH-001 §2d); when absent the global lock applies. */
  orderLocks?: Record<string, LockInfo>;
  /** Data source could not be read at all. */
  unavailable?: string;
  /** Order directories whose state.json is missing fields, broken or unreadable (never guessed). */
  unreadable?: string[];
}

export type TeamKey = "vedouci" | "copywriter" | "designer" | "vyvojar" | "kontrolor" | "brana" | "strazce";
export type MemberStatus = "working" | "checking" | "waiting" | "idle" | "unknown" | "alarm" | "ok";

export interface Member {
  key: TeamKey;
  name: string;
  role: string;
  responsibility: string;
  /** Model from logged calls only; undefined = not documented. */
  model?: string;
  status: MemberStatus;
  statusLabel: string;
  activity: string;
  /** Sum of logged call durations today (ms). */
  workMs: number;
  calls: number;
  /** Documented history (newest first, max 6). */
  history: { at: string; text: string; result?: string }[];
}

export type StepStatus = "done" | "current" | "future" | "error" | "paused" | "skipped";

export interface FlowStep {
  key: "lead" | "brief" | "creator" | "checker" | "delivery" | "owner";
  label: string;
  who: string;
  status: StepStatus;
  /** When the step finished (or stopped). */
  at?: string;
  note?: string;
}

export interface OrderView {
  id: string;
  title: string;
  mission: string;
  department: string;
  state: OrderState;
  stateLabel: string;
  tone: "live" | "check" | "wait" | "bad" | "ok" | "mute" | "unknown";
  sentence: string;
  /** Activity verified by a live orchestrator process. */
  verified: boolean;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  flow: FlowStep[];
  problem?: { what: string; consequence: string };
  lastEvent?: { at: string; text: string };
  deliveredUrl?: string;
  ownerCardUrl?: string;
}

export interface TimelineItem {
  at: string;
  order: string;
  orderTitle: string;
  who: string;
  text: string;
  tone: "ok" | "bad" | "wait" | "mute" | "live";
  durationMs?: number;
}

export interface Decision {
  order: string;
  title: string;
  why: string;
  recommendation: string;
  links: { label: string; url: string }[];
}

export interface Delivery {
  order: string;
  title: string;
  creator: string;
  checker: string;
  at: string;
  url: string;
  status: string;
}

export interface McView {
  demo: boolean;
  now: string;
  status: SysStatus;
  statusLabel: string;
  statusSentence: string;
  mission: string;
  workingCount: number;
  decisionsCount: number;
  lastContact?: string;
  current?: OrderView;
  team: Member[];
  decisions: Decision[];
  moreDecisions: number;
  deliveries: Delivery[];
  timeline: TimelineItem[];
  next: { what: string; who: string; blocker?: string };
  today: { total: number; delivered: number; failed: number; unknown: number };
  orders: OrderView[];
  guard?: { at: string; ok: boolean };
  /** Number of orders whose state.json cannot be used; > 0 = the overview cannot be verified. */
  unreadable: number;
  /** Orders with proven live work across all missions (header „Pracuje“). */
  liveOrders: number;
  /** Orders outside the main mission: active now or ended today. */
  background: BackgroundItem[];
}

export const ACTIVE_STATES: readonly OrderState[] = ["NEW", "PLANNED", "DOING", "CHECKING", "FIXING", "DELIVERED", "PAUSED"];

export const STATE_LABEL: Record<OrderState | "SUPERSEDED", string> = {
  NEW: "Plánuje se",
  PLANNED: "Zadání schváleno",
  DOING: "Tvorba",
  CHECKING: "Kontrola",
  FIXING: "Opravy",
  DELIVERED: "Doručuje se",
  WAITING_OWNER: "Čeká na tvoje GO",
  DONE: "Hotovo",
  PAUSED: "Pozastaveno",
  FAILED: "Selhalo",
  UNKNOWN: "Nelze ověřit",
  SUPERSEDED: "Nahrazeno",
};

/**
 * SUPERSEDED (introduced by the dispatch bridge, run 3): the order was replaced by a newer one.
 * Not active, never waits for the owner, never in Owner Desk; shown as „Nahrazeno“.
 */
export const isSuperseded = (o: { state: string }) => o.state === "SUPERSEDED";

const MISSION_NAME: Record<string, string> = { "mezi-vami": "MEZI VÁMI" };
export const missionName = (m: string) => MISSION_NAME[m] ?? (safe(m, 60) || "—");

const DEPT_NAME: Record<string, string> = { copy: "Copy a kreativa", dev: "Vývoj", vizual: "Vizuál" };

export const TEAM_BASE: Record<TeamKey, { name: string; role: string; card?: string; fallback: string }> = {
  vedouci: { name: "Vedoucí", role: "Delivery Lead · supervizor", card: "supervizor", fallback: "Vybírá další zakázku z HANDOFF a píše zadání; sám netvoří ani nekontroluje." },
  copywriter: { name: "Copywriter", role: "Copy Studio", card: "copy-studio", fallback: "Píše zákaznickou komunikaci mise." },
  designer: { name: "Designér", role: "Visual/UI Lead", card: "vizual", fallback: "Navrhuje vizuální směr a rozhraní." },
  vyvojar: { name: "Vývojář", role: "Executor · AI Chain", card: "vyvojar", fallback: "Implementuje změny v kódu jako PR draft." },
  kontrolor: { name: "Kontrolor", role: "Kontrola jiné rodiny modelů", fallback: "Kontroluje zadání i výstupy; vždy jiná rodina modelů než tvůrce (TARS-ORCH-001 §1)." },
  brana: { name: "Brána", role: "Independent Gate", card: "brana", fallback: "Nezávislá fresh-context kontrola výstupu." },
  strazce: { name: "Strážce", role: "TARS-GUARD", fallback: "Před během ověřuje bezpečnostní invarianty; při poplachu se supervizor zastaví (TARS-ORCH-001 §6)." },
};

export const CREATOR_BY_DEPT: Record<string, TeamKey> = { copy: "copywriter", vizual: "designer", dev: "vyvojar" };

/**
 * Run lock that proves work on one order (TARS-ORCH-001 §2d bod 6): the order's own lock when it
 * exists, otherwise the global runs/.lock. A dead order lock is never overridden by a live global one.
 */
export function lockFor(input: McInput, id: string | undefined): LockInfo {
  const own = id !== undefined ? input.orderLocks?.[id] : undefined;
  if (own) return own;
  // the global runs/.lock is the orchestrator's; it runs only wo-* orders and proves nothing about
  // dev-* runs of the dispatch bridge (or any other id), whatever mission is shown as main
  return id === undefined || id.startsWith("wo-") ? input.lock : { present: false, alive: false };
}

/** Text from data is shown only when it carries no secret pattern. */
export function safe(text: string | undefined | null, max = 240): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (!scanSecrets(t).clean) return "[skryto: text obsahoval citlivý údaj]";
  const p = redactPaths(t); // no local paths on the page
  return p.length > max ? `${p.slice(0, max - 1)}…` : p;
}

const ms = (iso?: string) => (iso ? Date.parse(iso) : NaN);

export function formatDuration(totalMs: number): string {
  if (!Number.isFinite(totalMs) || totalMs < 0) return "—";
  const s = Math.round(totalMs / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60} s`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export function formatAgo(fromIso: string | undefined, nowIso: string): string {
  const d = ms(nowIso) - ms(fromIso);
  if (!Number.isFinite(d)) return "nelze ověřit";
  const s = Math.max(0, Math.round(d / 1000));
  if (s < 60) return "před chvílí";
  const m = Math.floor(s / 60);
  if (m < 60) return `před ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `před ${h} h ${m % 60} min`;
  return `před ${Math.floor(h / 24)} d`;
}

/** Same calendar day in Prague time (the owner's day). */
export function sameDay(a: string, b: string): boolean {
  const f = (x: string) => new Date(x).toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" });
  return f(a) === f(b);
}

/** Deterministic Czech wording of a failure reason (never invents a cause). */
export function humanProblem(reason: string | undefined): string {
  const r = safe(reason, 400);
  if (!r) return "Důvod nebyl zaznamenán.";
  const rules: Array<[RegExp, (m: RegExpExecArray) => string]> = [
    [/^manual abort: (?:přerušeno: )?(.*)$/i, (m) => `Ručně přerušeno: ${m[1]}`],
    [/^checker BLOCK: (?:BLOCK ?)?(.*)$/i, (m) => `Kontrolor zastavil výstup ${m[1]}`],
    [/^supervisor brief invalid: brief check FIX: (.*)$/i, (m) => `Kontrolor vrátil zadání vedoucího k opravě: ${m[1]}`],
    [/^supervisor brief invalid: (.*)$/i, (m) => `Zadání vedoucího neprošlo: ${m[1]}`],
    [/^preflight: (.*)$/i, (m) => `Kontrola před startem neprošla: ${m[1]}`],
    [/^creator: UI_UNKNOWN: (.*)$/i, (m) => `Prohlížeč nedokončil krok tvůrce: ${m[1]}`],
    [/UI_UNKNOWN: (.*)$/i, (m) => `Prohlížeč nedokončil krok: ${m[1]}`],
    [/^fix limit (\d+) exhausted/i, (m) => `Vyčerpán limit ${m[1]} kol oprav.`],
    [/^owner REJECT/i, () => "Vlastník dal REJECT."],
  ];
  for (const [re, f] of rules) {
    const m = re.exec(r);
    if (m) return safe(f(m), 260);
  }
  return safe(r, 260);
}

export function consequence(state: OrderState): string {
  if (state === "FAILED") return "Zakázka skončila bez doručeného výstupu. Další práci vybere vedoucí při příštím běhu.";
  if (state === "UNKNOWN") return "Nic se nedoručilo a výsledek nelze potvrdit. Neber to jako úspěch.";
  return "";
}

export interface CallInfo extends LogEntry {
  member: TeamKey;
  phase: "brief" | "work";
}

function plannedAt(o: Order): string | undefined {
  return o.history.find((h) => h.event === "planned")?.at;
}

/** Attributes each logged call to one team member (role in log + department + phase of the order). */
export function classifyCalls(orders: Order[], log: LogEntry[]): CallInfo[] {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const out: CallInfo[] = [];
  for (const e of log) {
    if (e.kind !== "call") continue;
    const o = byId.get(e.order);
    const dept = o?.brief?.department ?? "";
    const pa = o ? plannedAt(o) : undefined;
    const phase: CallInfo["phase"] = !pa || e.ts <= pa ? "brief" : "work";
    let member: TeamKey | undefined;
    if (e.role === "supervisor") member = "vedouci";
    else if (e.role === "checker") member = phase === "work" && dept === "vizual" ? "brana" : "kontrolor";
    else if (e.role === "creator") member = CREATOR_BY_DEPT[dept];
    // model names come from the log (data): filtered once here, so no consumer can leak them
    if (member) out.push({ ...e, model: e.model === undefined ? undefined : safe(e.model, 80) || undefined, member, phase });
  }
  return out;
}

function lastCall(calls: CallInfo[], order: string): CallInfo | undefined {
  return calls.filter((c) => c.order === order).at(-1);
}

/** Which step an order is on, given the state it is (or was) in. */
function stepOfState(s: OrderState, o: Order, calls: CallInfo[]): FlowStep["key"] {
  switch (s) {
    case "NEW": {
      const lc = lastCall(calls, o.id);
      return lc && lc.member === "vedouci" && lc.result === "ok" ? "brief" : lc?.member === "kontrolor" ? "brief" : "lead";
    }
    case "PLANNED":
    case "DOING":
    case "FIXING":
      return "creator";
    case "CHECKING":
      return "checker";
    case "DELIVERED":
      return "delivery";
    case "WAITING_OWNER":
      return "owner";
    default:
      return "delivery";
  }
}

function ownerStepNeeded(o: Order): boolean {
  if (o.owner_needed !== undefined) return o.owner_needed;
  return o.brief?.department === "dev" || (o.brief?.owner_decisions?.length ?? 0) > 0;
}

function modelOf(calls: CallInfo[], order: string, member: TeamKey): string | undefined {
  return calls.filter((c) => c.order === order && c.member === member && c.model).at(-1)?.model;
}

export function buildFlow(o: Order, calls: CallInfo[]): FlowStep[] {
  const dept = o.brief?.department;
  const creatorKey = dept ? CREATOR_BY_DEPT[dept] : undefined;
  const checkerKey: TeamKey = dept === "vizual" ? "brana" : "kontrolor";
  const steps: FlowStep[] = [
    { key: "lead", label: "Vedoucí", who: modelOf(calls, o.id, "vedouci") ?? "model nedoložen", status: "future" },
    { key: "brief", label: "Zadání", who: "kontrola zadání", status: "future" },
    { key: "creator", label: creatorKey ? TEAM_BASE[creatorKey].name : "Tvůrce", who: creatorKey ? modelOf(calls, o.id, creatorKey) ?? "zatím nevolán" : "oddělení nevybráno", status: "future" },
    { key: "checker", label: dept === "dev" ? "Kontrolor · CI" : TEAM_BASE[checkerKey].name, who: modelOf(calls, o.id, checkerKey) ?? "zatím nevolán", status: "future" },
    { key: "delivery", label: "Doručení", who: dept === "dev" ? "PR draft" : "Notion DRAFT", status: "future" },
  ];
  if (ownerStepNeeded(o)) steps.push({ key: "owner", label: "Moje GO", who: "vlastník", status: "future" });

  const bk = modelOf(calls, o.id, "kontrolor");
  const briefCall = calls.filter((c) => c.order === o.id && c.member === "kontrolor" && c.phase === "brief").at(-1);
  if (briefCall?.model) steps[1].who = briefCall.model;
  else if (bk && !plannedAt(o)) steps[1].who = bk;

  // finish times from history
  const leftAt = (keys: OrderState[]) => o.history.find((h) => keys.includes(h.from) && !keys.includes(h.to))?.at;
  const firstSupervisorOk = calls.find((c) => c.order === o.id && c.member === "vedouci" && c.result === "ok")?.ts;
  steps[0].at = firstSupervisorOk;
  steps[1].at = plannedAt(o);
  steps[2].at = leftAt(["PLANNED", "DOING", "FIXING"]);
  steps[3].at = o.history.filter((h) => h.from === "CHECKING").at(-1)?.at;
  steps[4].at = leftAt(["DELIVERED"]);
  if (steps[5]) steps[5].at = o.history.find((h) => h.from === "WAITING_OWNER")?.at;

  const idx = (k: FlowStep["key"]) => steps.findIndex((s) => s.key === k);
  const mark = (cur: number, status: StepStatus) => {
    steps.forEach((s, i) => {
      s.status = i < cur ? "done" : i === cur ? status : "future";
    });
  };

  const s = o.state;
  if (s === "DONE") steps.forEach((x) => (x.status = "done"));
  else if (isSuperseded(o)) {
    // replaced: the step it stopped in and everything after is skipped, nothing waits for anyone
    const last = o.history.at(-1);
    const i = Math.max(0, idx(stepOfState(last?.from ?? "NEW", o, calls)));
    mark(i, "skipped");
    steps[i].note = "nahrazeno";
    steps.slice(i + 1).forEach((x) => (x.status = "skipped"));
  } else if (s === "FAILED" || s === "UNKNOWN") {
    const last = o.history.at(-1);
    const from = last?.from ?? "NEW";
    const k = from === "PAUSED" && o.paused_from ? stepOfState(o.paused_from, o, calls) : stepOfState(from, o, calls);
    const i = Math.max(0, idx(k));
    mark(i, "error");
    steps[i].at = last?.at;
    steps.slice(i + 1).forEach((x) => (x.status = "skipped"));
    if (from === "WAITING_OWNER") steps[i].note = "REJECT";
  } else if (s === "PAUSED") {
    mark(Math.max(0, idx(stepOfState(o.paused_from ?? "NEW", o, calls))), "paused");
  } else {
    const i = Math.max(0, idx(stepOfState(s, o, calls)));
    mark(i, "current");
    if (s === "FIXING") steps[i].note = `oprava, kolo ${o.fix_rounds}`;
    if (s === "PLANNED") steps[i].note = "startuje";
  }
  for (const st of steps) if (st.status !== "done" && st.status !== "error") st.at = st.status === "current" ? undefined : st.at;
  return steps;
}

function memberName(k: TeamKey | undefined): string {
  return k ? TEAM_BASE[k].name : "Tvůrce";
}

function orderView(o: Order, calls: CallInfo[], lock: LockInfo, log: LogEntry[]): OrderView {
  const dept = o.brief?.department;
  const creator = memberName(dept ? CREATOR_BY_DEPT[dept] : undefined);
  const checker = dept === "vizual" ? "Brána" : "Kontrolor";
  const active = ACTIVE_STATES.includes(o.state);
  const verified = active && lock.alive && o.state !== "PAUSED";
  const flow = buildFlow(o, calls);
  const cur = flow.find((f) => f.status === "current" || f.status === "error" || f.status === "paused");
  let sentence = "";
  let tone: OrderView["tone"] = "mute";
  const title = safe(o.brief?.title, 160) || (o.state === "NEW" ? "Nová zakázka — vedoucí vybírá práci" : "Zakázka bez schváleného zadání");
  if (isSuperseded(o)) {
    sentence = "Zakázku nahradila novější. Nic dalšího se s ní neděje a nečeká na tvoje rozhodnutí.";
    tone = "mute";
  } else switch (o.state) {
    case "NEW":
      sentence =
        cur?.key === "brief"
          ? `Kontrolor prověřuje zadání od vedoucího. Po schválení ho převezme ${dept ? creator.toLowerCase() : "specialista oddělení"}.`
          : "Vedoucí vybírá další práci z HANDOFF a píše zadání. Potom ho zkontroluje kontrolor z jiné rodiny modelů.";
      tone = "live";
      break;
    case "PLANNED":
      sentence = `Zadání prošlo kontrolou. ${creator} se připravuje na start.`;
      tone = "live";
      break;
    case "DOING":
      sentence = `${creator} pracuje na zakázce. Následně výstup převezme ${checker.toLowerCase()}.`;
      tone = "live";
      break;
    case "FIXING":
      sentence = `${creator} zapracovává připomínky kontroly (kolo ${o.fix_rounds}). Potom proběhne nová kontrola.`;
      tone = "live";
      break;
    case "CHECKING":
      sentence = `${checker} kontroluje výstup, který vytvořil ${creator.toLowerCase()}. Výsledek bude PASS, opravy, nebo zastavení.`;
      tone = "check";
      break;
    case "DELIVERED":
      sentence = "Výstup prošel kontrolou a doručuje se jako DRAFT.";
      tone = "live";
      break;
    case "WAITING_OWNER":
      sentence = "Výstup je doručený a čeká na tvoje GO nebo REJECT.";
      tone = "wait";
      break;
    case "DONE":
      sentence = "Zakázka je hotová, výstup doručen.";
      tone = "ok";
      break;
    case "PAUSED":
      sentence = `Pozastaveno kvůli limitu předplatného. Pokračuje ${o.resume_after ? "po obnovení limitu" : "po obnovení (čas nezaznamenán)"}.`;
      tone = "wait";
      break;
    case "FAILED":
      sentence = `Zakázka se zastavila v kroku ${cur?.label ?? "—"}.`;
      tone = "bad";
      break;
    case "UNKNOWN":
      sentence = `Výsledek nelze ověřit. Zakázka skončila v kroku ${cur?.label ?? "—"}.`;
      tone = "unknown";
      break;
  }
  if (active && o.state !== "PAUSED" && !lock.alive) {
    sentence = `Podle záznamu je zakázka ve stavu „${STATE_LABEL[o.state]}“, ale orchestrátor teď neběží. Nelze ověřit, zda práce pokračuje.`;
    tone = "unknown";
  }
  const evs = log.filter((e) => e.order === o.id && (e.kind === "transition" || e.kind === "call"));
  const le = evs.at(-1);
  return {
    id: o.id,
    title,
    mission: missionName(o.mission),
    department: dept ? DEPT_NAME[dept] ?? dept : "oddělení zatím nevybráno",
    state: o.state,
    stateLabel: STATE_LABEL[o.state],
    tone,
    sentence,
    verified,
    startedAt: o.created_at,
    updatedAt: o.updated_at,
    endedAt: active || o.state === "WAITING_OWNER" ? undefined : o.updated_at,
    flow,
    problem: o.state === "FAILED" || o.state === "UNKNOWN" ? { what: humanProblem(o.failure_reason), consequence: consequence(o.state) } : undefined,
    lastEvent: le ? { at: le.ts, text: eventText(le, calls, o.state) } : undefined,
    deliveredUrl: safeUrl(o.delivered_url),
    ownerCardUrl: safeUrl(o.owner_card_url),
  };
}

export function safeUrl(u?: string): string | undefined {
  if (!u || !/^https:\/\/[^\s"'<>]+$/.test(u) || !scanSecrets(u).clean) return undefined;
  return u;
}

export const RESULT_TEXT: Record<string, string> = { PASS: "PASS", FIX: "vrátil k opravě", BLOCK: "zastavil (BLOCK)", ok: "dokončeno", error: "chyba" };

const TRANSITION_TEXT: Partial<Record<OrderState | "SUPERSEDED", string>> = {
  PLANNED: "Zadání schváleno kontrolorem",
  DOING: "Tvůrce spuštěn",
  CHECKING: "Výstup předán ke kontrole",
  FIXING: "Výstup vrácen k opravě",
  DELIVERED: "Kontrola PASS, výstup se doručuje",
  WAITING_OWNER: "Doručeno, čeká na GO vlastníka",
  DONE: "Zakázka hotová",
  PAUSED: "Pozastaveno (limit předplatného)",
  FAILED: "Zakázka selhala",
  UNKNOWN: "Výsledek nelze ověřit",
  SUPERSEDED: "Nahrazeno novější zakázkou",
};

function eventText(e: LogEntry, calls: CallInfo[], state?: string): string {
  // „čeká na GO“ only while the order really waits (not after GO, REJECT or SUPERSEDED)
  if (e.kind === "transition" && e.to === "WAITING_OWNER" && state !== undefined && state !== "WAITING_OWNER") return "Doručeno k rozhodnutí vlastníka";
  if (e.kind === "transition") return TRANSITION_TEXT[e.to as OrderState] ?? `Přechod ${safe(e.from, 20)} → ${safe(e.to, 20)}`;
  const c = calls.find((x) => x.ts === e.ts && x.order === e.order && x.role === e.role);
  if (!c) return e.role === "transport" ? `Doručení: ${e.result === "error" ? "chyba" : "dokončeno"}` : `Systém: ${safe(e.result, 60)}`;
  const who = TEAM_BASE[c.member].name;
  if (e.result === "error") return `${who} narazil na chybu`;
  if (c.member === "vedouci") return `${who} napsal zadání`;
  if (c.member === "kontrolor" && c.phase === "brief") return `Kontrola zadání: ${RESULT_TEXT[e.result ?? ""] ?? safe(e.result, 40)}`;
  if (c.member === "kontrolor" || c.member === "brana") return `${who} vrátil verdikt: ${RESULT_TEXT[e.result ?? ""] ?? safe(e.result, 40)}`;
  return `${who} odevzdal výstup`;
}

function membersFor(input: McInput, calls: CallInfo[], current: Order | undefined, currentView: OrderView | undefined): Member[] {
  const today = calls.filter((c) => sameDay(c.ts, input.now));
  const curStep = currentView?.flow.find((f) => f.status === "current");
  const activeVerified = Boolean(currentView?.verified);
  const unknownActive = Boolean(current && ACTIVE_STATES.includes(current.state) && current.state !== "PAUSED" && !lockFor(input, current.id).alive);
  const dept = current?.brief?.department;
  const curMember: TeamKey | undefined = (() => {
    if (!curStep || !current) return undefined;
    if (curStep.key === "lead") return "vedouci";
    if (curStep.key === "brief") return "kontrolor";
    if (curStep.key === "creator") return dept ? CREATOR_BY_DEPT[dept] : undefined;
    if (curStep.key === "checker") return dept === "vizual" ? "brana" : "kontrolor";
    return undefined;
  })();
  const nextMember: TeamKey | undefined = (() => {
    if (!curStep || !current) return undefined;
    if (curStep.key === "lead") return "kontrolor";
    if (curStep.key === "brief") return dept ? CREATOR_BY_DEPT[dept] : undefined;
    if (curStep.key === "creator") return dept === "vizual" ? "brana" : "kontrolor";
    return undefined;
  })();

  const keys: TeamKey[] = ["vedouci", "copywriter", "designer", "vyvojar", "kontrolor", "brana", "strazce"];
  return keys.map((k) => {
    const base = TEAM_BASE[k];
    const mine = calls.filter((c) => c.member === k);
    const mineToday = today.filter((c) => c.member === k);
    const m: Member = {
      key: k,
      name: base.name,
      role: base.role,
      responsibility: safe(base.card ? input.cards[base.card] : undefined, 220) || base.fallback,
      model: safe(mine.at(-1)?.model, 80) || undefined,
      status: "idle",
      statusLabel: "Neaktivní",
      activity: mine.length ? `Naposledy ${formatAgo(mine.at(-1)!.ts, input.now)}` : "Dnes zatím bez práce",
      workMs: mineToday.reduce((a, c) => a + (c.duration_ms ?? 0), 0),
      calls: mineToday.length,
      history: mine
        .slice(-6)
        .reverse()
        .map((c) => ({
          at: c.ts,
          text: `${c.member === "kontrolor" && c.phase === "brief" ? "Kontrola zadání" : "Práce na zakázce"} ${c.order}`,
          result: RESULT_TEXT[c.result ?? ""] ?? safe(c.result, 40),
        })),
    };
    if (k === "strazce") {
      const g = input.log.filter((e) => e.kind === "guard");
      const last = g.at(-1);
      m.calls = g.filter((e) => sameDay(e.ts, input.now)).length;
      m.model = "deterministický skript";
      m.history = g
        .slice(-6)
        .reverse()
        .map((e) => ({ at: e.ts, text: "Kontrola invariantů TARS-GUARD", result: e.result === "OK" ? "OK" : safe(e.result, 40) }));
      if (!last) {
        m.status = "unknown";
        m.statusLabel = "Nelze ověřit";
        m.activity = "Žádný záznam kontroly";
      } else if (last.result === "OK") {
        m.status = "ok";
        m.statusLabel = "Vše v pořádku";
        m.activity = `Poslední kontrola ${formatAgo(last.ts, input.now)}`;
      } else {
        m.status = "alarm";
        m.statusLabel = "Poplach";
        m.activity = `Poplach ${formatAgo(last.ts, input.now)} — supervizor stojí`;
      }
      return m;
    }
    if (k === curMember) {
      if (unknownActive) {
        m.status = "unknown";
        m.statusLabel = "Nelze ověřit";
        m.activity = "Záznam říká, že je na řadě, ale orchestrátor neběží";
      } else if (activeVerified) {
        m.status = k === "kontrolor" || k === "brana" ? "checking" : "working";
        m.statusLabel = m.status === "checking" ? "Kontroluje" : "Pracuje";
        m.activity =
          curStep?.key === "brief"
            ? "Kontroluje zadání od vedoucího"
            : curStep?.key === "lead"
              ? "Vybírá práci a píše zadání"
              : curStep?.key === "checker"
                ? "Kontroluje výstup zakázky"
                : current?.state === "FIXING"
                  ? `Zapracovává připomínky (kolo ${current.fix_rounds})`
                  : "Tvoří výstup zakázky";
      }
    } else if (k === nextMember && activeVerified) {
      m.status = "waiting";
      m.statusLabel = "Čeká na předání";
      m.activity = "Převezme práci v dalším kroku";
    }
    return m;
  });
}

export function buildView(input: McInput): McView {
  const orders = [...input.orders].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const calls = classifyCalls(orders, input.log);
  const main = mainMission(orders);
  const mainOrders = orders.filter((o) => !isBackground(o, main));
  const active = mainOrders.filter((o) => ACTIVE_STATES.includes(o.state));
  // Owner Desk: every mission's GO waits for the owner (a superseded order never does)
  const waiting = orders.filter((o) => o.state === "WAITING_OWNER");
  const current = active.at(-1) ?? mainOrders.filter((o) => o.state === "WAITING_OWNER").at(-1) ?? mainOrders.at(-1);
  const liveOrders = countLive(input, orders);
  const background = buildBackground(input, orders, main);
  const views = orders.map((o) => orderView(o, calls, proofLock(input, o, main), input.log));
  const currentView = current ? views.find((v) => v.id === current.id) : undefined;
  const team = membersFor(input, calls, current, currentView);
  const guardLast = input.log.filter((e) => e.kind === "guard").at(-1);
  const unreadable = input.unreadable?.length ?? 0;
  const mainActive = Boolean(current && ACTIVE_STATES.includes(current.state) && current.state !== "PAUSED");
  const activeAnywhere = orders.some((o) => ACTIVE_STATES.includes(o.state) && o.state !== "PAUSED");

  // status (zadání §3A: pracuje, čeká, pozastaveno, problém, nedostupné, neznámé)
  let status: SysStatus;
  let statusSentence: string;
  if (input.unavailable) {
    status = "unavailable";
    statusSentence = `Data nejsou dostupná: ${safe(input.unavailable, 120)}`;
  } else if (guardLast && guardLast.result !== "OK") {
    status = "problem";
    statusSentence = "Strážce hlásí poplach. Supervizor se zastavil.";
  } else if (unreadable) {
    status = "unknown";
    statusSentence = unreadableSentence(unreadable);
  } else if (mainActive && lockFor(input, current!.id).alive) {
    status = "working";
    statusSentence = "Tým pracuje na zakázce.";
  } else if (liveOrders) {
    // same rule as the main page: proven work anywhere → working
    status = "working";
    statusSentence = mainActive ? `Práce běží (${liveOrders}×), ale rozpracovanou zakázku hlavní mise nelze ověřit.` : `Na pozadí běží práce (${liveOrders}×). Hlavní mise teď nepracuje.`;
  } else if (activeAnywhere) {
    // …and active but unproven anywhere (main or background) → cannot be verified
    status = "unknown";
    statusSentence = mainActive ? "Zakázka je podle záznamu rozpracovaná, ale orchestrátor neběží." : "Na pozadí je podle záznamu rozpracovaná zakázka, ale její běh nelze ověřit.";
  } else if (current?.state === "PAUSED") {
    status = "paused";
    statusSentence = "Práce je pozastavená kvůli limitu předplatného.";
  } else if (waiting.length) {
    status = "waiting";
    statusSentence = "Tým čeká na tvoje rozhodnutí.";
  } else if (input.lock.alive) {
    status = "working";
    statusSentence = "Supervizor zahajuje běh.";
  } else if (current && (current.state === "FAILED" || current.state === "UNKNOWN")) {
    status = "problem";
    statusSentence = current.state === "FAILED" ? "Poslední zakázka selhala. Tým teď nepracuje." : "Výsledek poslední zakázky nelze ověřit. Tým teď nepracuje.";
  } else if (!current) {
    status = "waiting";
    statusSentence = "Zatím žádná zakázka. Tým čeká na první běh supervizora.";
  } else {
    status = "waiting";
    statusSentence = "Tým je v klidu a čeká na další běh supervizora.";
  }

  const decisionsAll: Decision[] = waiting
    .slice()
    .reverse()
    .map((o) => ({
      order: o.id,
      title: safe(o.brief?.title, 140) || o.id,
      why: (o.owner_reasons ?? []).map((r) => safe(r, 200)).filter(Boolean).slice(0, 2).join(" · ") || "Výstup čeká na GO / REJECT.",
      recommendation: "Doporučení vedoucího: nezaznamenáno — nelze ověřit.",
      links: [
        ...(safeUrl(o.owner_card_url) ? [{ label: "GO karta v Notionu", url: o.owner_card_url! }] : []),
        ...(safeUrl(o.delivered_url) ? [{ label: "Podklad", url: o.delivered_url! }] : []),
      ],
    }));

  const deliveries: Delivery[] = orders
    .filter((o) => o.delivered_url && safeUrl(o.delivered_url))
    .map((o) => {
      const at = o.history.find((h) => h.to === "DELIVERED")?.at ?? o.updated_at;
      const dept = o.brief?.department;
      const creatorKey = dept ? CREATOR_BY_DEPT[dept] : undefined;
      const pass = calls.filter((c) => c.order === o.id && c.phase === "work" && (c.member === "kontrolor" || c.member === "brana") && c.result === "PASS").at(-1);
      return {
        order: o.id,
        title: safe(o.brief?.title, 140) || o.id,
        creator: `${memberName(creatorKey)} · ${(creatorKey && safe(modelOf(calls, o.id, creatorKey), 60)) || "model nedoložen"}`,
        checker: pass ? `${TEAM_BASE[pass.member].name} · ${safe(pass.model, 60)} · PASS` : "Kontrola nedoložena",
        at,
        url: o.delivered_url!,
        status: o.state === "DONE" ? "Hotovo" : isSuperseded(o) ? "Nahrazeno" : o.state === "WAITING_OWNER" ? "DRAFT · čeká na GO" : "DRAFT",
      };
    })
    .filter((d) => sameDay(d.at, input.now))
    .reverse();

  const titleOf = new Map(views.map((v) => [v.id, v.title]));
  const timeline: TimelineItem[] = input.log
    .filter((e) => (e.kind === "transition" || e.kind === "call") && e.role !== "transport" && titleOf.has(e.order))
    .map((e) => {
      const c = calls.find((x) => x.ts === e.ts && x.order === e.order && x.role === e.role && e.kind === "call");
      const tone: TimelineItem["tone"] =
        e.kind === "transition"
          ? e.to === "FAILED" || e.to === "UNKNOWN"
            ? "bad"
            : e.to === "WAITING_OWNER" || e.to === "PAUSED"
              ? "wait"
              : e.to === "DONE" || e.to === "DELIVERED"
                ? "ok"
                : "live"
          : e.result === "PASS" || e.result === "ok"
            ? "ok"
            : e.result === "FIX"
              ? "wait"
              : e.result === "BLOCK" || e.result === "error"
                ? "bad"
                : "mute";
      return {
        at: e.ts,
        order: e.order,
        orderTitle: titleOf.get(e.order) ?? e.order,
        who: c ? TEAM_BASE[c.member].name : "Orchestrátor",
        text: eventText(e, calls, orders.find((o) => o.id === e.order)?.state),
        tone,
        durationMs: e.kind === "call" ? e.duration_ms : undefined,
      };
    })
    .reverse()
    .slice(0, 10);

  // next step
  let next: McView["next"];
  if (status === "unavailable") next = { what: "Nelze ověřit", who: "—", blocker: "Data nejsou dostupná." };
  else if (currentView && ACTIVE_STATES.includes(currentView.state)) {
    const i = currentView.flow.findIndex((f) => f.status === "current" || f.status === "paused");
    const nx = currentView.flow[i + 1];
    next = {
      what: nx ? `${nx.label} převezme práci po kroku ${currentView.flow[i]?.label ?? "—"}` : "Dokončení zakázky",
      who: nx?.label ?? "—",
      blocker: !lockFor(input, currentView.id).alive && currentView.state !== "PAUSED" ? "Orchestrátor neběží — žádný proces nedrží běhový zámek." : currentView.state === "PAUSED" ? "Limit předplatného." : undefined,
    };
  } else if (waiting.length) next = { what: "Rozhodnutí GO / REJECT", who: "Ty", blocker: "Bez tvého rozhodnutí zakázka nepokračuje." };
  else
    next = {
      what: "Vedoucí vybere další zakázku z HANDOFF",
      who: "Vedoucí",
      blocker:
        input.scheduler === false
          ? "Automatický běh (launchd) není nainstalovaný — další běh spustí jen ruční start supervizora."
          : input.scheduler === undefined
            ? "Čas dalšího běhu nelze ověřit."
            : undefined,
    };

  if (unreadable && status !== "unavailable") next = { ...next, blocker: next.blocker ?? `${unreadableSentence(unreadable)} Další krok nelze ověřit.` };

  const todayOrders = orders.filter((o) => sameDay(o.created_at, input.now));
  const contactCandidates = [
    ...input.log.map((e) => e.ts),
    ...orders.map((o) => o.updated_at),
    ...(input.lock.alive && input.lock.mtime ? [input.lock.mtime] : []),
    ...Object.values(input.orderLocks ?? {}).flatMap((l) => (l.alive && l.mtime ? [l.mtime] : [])),
  ].filter((x) => Number.isFinite(ms(x)));
  const lastContact = contactCandidates.sort().at(-1);

  return {
    demo: Boolean(input.demo),
    now: input.now,
    status,
    statusLabel: SYS_LABEL[status],
    statusSentence,
    mission: current ? missionName(current.mission) : "—",
    workingCount: team.filter((m) => m.status === "working" || m.status === "checking").length,
    decisionsCount: decisionsAll.length,
    lastContact,
    current: currentView,
    team,
    decisions: decisionsAll.slice(0, 3),
    moreDecisions: Math.max(0, decisionsAll.length - 3),
    deliveries,
    timeline,
    next,
    today: {
      total: todayOrders.length,
      delivered: todayOrders.filter((o) => o.delivered_url).length,
      failed: todayOrders.filter((o) => o.state === "FAILED").length,
      unknown: todayOrders.filter((o) => o.state === "UNKNOWN").length,
    },
    orders: views.slice().reverse(),
    guard: guardLast ? { at: guardLast.ts, ok: guardLast.result === "OK" } : undefined,
    unreadable,
    liveOrders,
    background,
  };
}

/**
 * The mission shown in the main card: the mission of the newest orchestrator order (wo-*),
 * else of the newest order. Orders of other missions (e.g. dev-* from the dispatch bridge) are background.
 */
export function mainMission(orders: Order[]): string | undefined {
  const byNew = [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (byNew.find((o) => o.id.startsWith("wo-")) ?? byNew[0])?.mission;
}

export const isBackground = (o: Order, main: string | undefined) => main !== undefined && o.mission !== main;

/**
 * Lock that proves work on an order. A background order (another mission, e.g. the dispatch bridge)
 * is proven only by its own runs/<id>/.lock – the orchestrator's global lock says nothing about it.
 */
export function proofLock(input: McInput, o: Order, main = mainMission(input.orders)): LockInfo {
  return isBackground(o, main) ? (input.orderLocks?.[o.id] ?? { present: false, alive: false }) : lockFor(input, o.id);
}

/** Order states whose text from a running process (meta.last_step, info log) is still current. */
const RUNNING_TEXT_OK = (o: Order) => ACTIVE_STATES.includes(o.state) && o.state !== "PAUSED";

/** Orders whose work is proven right now: active, not paused, run lock held by a live process. */
export function isLive(input: McInput, o: Order, main = mainMission(input.orders)): boolean {
  return ACTIVE_STATES.includes(o.state) && o.state !== "PAUSED" && proofLock(input, o, main).alive;
}

export function countLive(input: McInput, orders: Order[] = input.orders): number {
  const main = mainMission(orders);
  return orders.filter((o) => isLive(input, o, main)).length;
}

export interface BackgroundItem {
  id: string;
  title: string;
  mission: string;
  status: "working" | "done" | "failed" | "unknown" | "superseded" | "waiting" | "paused";
  statusLabel: string;
  lastStep: string;
  startedAt: string;
  endedAt?: string;
  live: boolean;
}

const BG_LABEL: Record<BackgroundItem["status"], string> = {
  working: "Pracuje",
  done: "Hotovo",
  failed: "Selhalo",
  unknown: "Nelze ověřit",
  superseded: "Nahrazeno",
  waiting: "Čeká na tvoje GO",
  paused: "Pozastaveno",
};

/** „Na pozadí“: orders outside the main mission that are active now or ended today (Prague day). */
export function buildBackground(input: McInput, orders: Order[] = input.orders, main = mainMission(orders)): BackgroundItem[] {
  const items = orders
    .filter((o) => isBackground(o, main))
    .filter((o) => ACTIVE_STATES.includes(o.state) || o.state === "WAITING_OWNER" || sameDay(o.updated_at, input.now))
    .map((o): BackgroundItem => {
      const active = ACTIVE_STATES.includes(o.state);
      const live = isLive(input, o, main);
      const status: BackgroundItem["status"] = isSuperseded(o)
        ? "superseded"
        : o.state === "DONE"
          ? "done"
          : o.state === "FAILED"
            ? "failed"
            : o.state === "WAITING_OWNER"
              ? "waiting"
              : o.state === "PAUSED"
                ? "paused"
                : live
                  ? "working"
                  : "unknown"; // UNKNOWN, or active without a live process
      // a running order may say what it is doing now; a finished one only what the record proves,
      // so a stale „Čeká na tvoje GO“ in meta.last_step never outlives the state
      const running = RUNNING_TEXT_OK(o);
      const lastLog = input.log.filter((e) => e.order === o.id && (running ? e.kind === "info" || e.kind === "transition" || e.kind === "error" : e.kind === "transition")).at(-1);
      const fromLog = lastLog ? (lastLog.kind === "transition" ? eventText(lastLog, [], o.state) : lastLog.kind === "error" ? `Chyba: ${safe(lastLog.result, 120)}` : safe(lastLog.reason ?? lastLog.result, 160)) : "";
      const lastStep = isSuperseded(o)
        ? "Nahrazeno novější zakázkou"
        : o.state === "FAILED"
          ? humanProblem(o.failure_reason)
          : (running ? safe(o.meta?.last_step, 160) : "") || fromLog || STATE_LABEL[o.state] || "Nelze ověřit";
      return {
        id: o.id,
        title: safe(o.brief?.title, 140) || o.id,
        mission: missionName(o.mission),
        status,
        statusLabel: BG_LABEL[status],
        lastStep: status === "unknown" && active ? `${lastStep} · proces neběží, nelze ověřit` : lastStep,
        startedAt: o.created_at,
        endedAt: active ? undefined : o.updated_at,
        live,
      };
    });
  return items.sort((a, b) => Number(b.live) - Number(a.live) || (b.endedAt ?? input.now).localeCompare(a.endedAt ?? input.now));
}

/** Wording for orders whose state.json cannot be used. */
export function unreadableSentence(n: number): string {
  const z = n === 1 ? "1 zakázku" : n >= 2 && n <= 4 ? `${n} zakázky` : `${n} zakázek`;
  return `Nelze ověřit: ${z} nejde přečíst (state.json je poškozený nebo neúplný). Přehled může být neúplný.`;
}

/** Focus Mode: full documented chronology of one order. */
export interface FocusView {
  order: OrderView;
  brief?: { milestone: string; why: string; goal: string; acceptance: string[]; ownerDecisions: string[] };
  chronology: { at: string; who: string; text: string; tone: TimelineItem["tone"]; durationMs?: number; detail?: string }[];
  handoffs: { at: string; from: string; to: string }[];
  verdicts: { at: string; who: string; model: string; result: string; reason: string }[];
  artifacts: { name: string; shot: boolean }[];
  fixRounds: number;
  manualInterventions: number;
}

export function buildFocus(input: McInput, id: string): FocusView | undefined {
  const o = input.orders.find((x) => x.id === id);
  if (!o) return undefined;
  const calls = classifyCalls(input.orders, input.log);
  const ov = orderView(o, calls, proofLock(input, o), input.log);
  const mine = input.log.filter((e) => e.order === id && (e.kind === "transition" || e.kind === "call" || e.kind === "error"));
  const chronology = mine.map((e) => {
    const c = calls.find((x) => x.ts === e.ts && x.order === e.order && x.role === e.role && e.kind === "call");
    return {
      at: e.ts,
      who: c ? `${TEAM_BASE[c.member].name}${c.model ? ` · ${safe(c.model, 60)}` : ""}` : e.role === "transport" ? "Doručení" : "Orchestrátor",
      text: e.kind === "error" ? `Chyba: ${safe(e.result, 80)}` : eventText(e, calls, o.state),
      tone: (e.kind === "error" || e.result === "BLOCK" || e.result === "error" || e.to === "FAILED" || e.to === "UNKNOWN"
        ? "bad"
        : e.result === "FIX"
          ? "wait"
          : e.result === "PASS" || e.to === "DONE"
            ? "ok"
            : "live") as TimelineItem["tone"],
      durationMs: e.kind === "call" ? e.duration_ms : undefined,
      detail: e.kind === "call" && e.reason ? safe(e.reason, 300) : undefined,
    };
  });
  const dept = o.brief?.department;
  const creatorName = memberName(dept ? CREATOR_BY_DEPT[dept] : undefined);
  const checkerName = dept === "vizual" ? "Brána" : "Kontrolor";
  const handoffs = o.history
    .map((h) => {
      if (h.to === "PLANNED") return { at: h.at, from: "Kontrolor (zadání)", to: creatorName };
      if (h.to === "CHECKING") return { at: h.at, from: creatorName, to: checkerName };
      if (h.to === "FIXING") return { at: h.at, from: checkerName, to: creatorName };
      if (h.to === "DELIVERED") return { at: h.at, from: checkerName, to: "Doručení" };
      if (h.to === "WAITING_OWNER") return { at: h.at, from: "Doručení", to: "Vlastník" };
      return undefined;
    })
    .filter((x): x is { at: string; from: string; to: string } => Boolean(x));
  const verdicts = calls
    .filter((c) => c.order === id && (c.member === "kontrolor" || c.member === "brana"))
    .map((c) => ({
      at: c.ts,
      who: c.phase === "brief" ? "Kontrolor zadání" : TEAM_BASE[c.member].name,
      model: safe(c.model, 60) || "model nedoložen",
      result: safe(c.result, 20),
      reason: safe(c.reason, 300),
    }));
  return {
    order: ov,
    brief: o.brief
      ? {
          milestone: safe(o.brief.milestone, 20),
          why: safe(o.brief.why, 500),
          goal: safe(o.brief.goal, 600),
          acceptance: (o.brief.acceptance ?? []).map((a) => safe(a, 240)).slice(0, 12),
          ownerDecisions: (o.brief.owner_decisions ?? []).map((a) => safe(a, 240)).slice(0, 8),
        }
      : undefined,
    chronology,
    handoffs,
    verdicts,
    artifacts: (input.files[id] ?? []).map((n) => ({ name: n, shot: n.endsWith(".png") })),
    fixRounds: o.fix_rounds,
    manualInterventions: o.manual_interventions,
  };
}
