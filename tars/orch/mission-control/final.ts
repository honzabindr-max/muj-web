// Mission Control V2-A (final): multi-order and recipe-aware model (TARS-ORCH-001 §2c, §2d).
//
// Data contract read here (all optional, backward compatible with v0 runs):
//   state.json  recipe: { id, version?, steps: [{ role, label?, kind?: "create"|"check"|"deliver"|"owner" }] }
//               recipe_step: index into recipe.steps of the step in progress
//   runs/<id>/.lock  PID of the process working on that order (§2d bod 6); else runs/.lock applies
//   log.jsonl   card: role id of the specialist that made a call (attributes calls to recipe roles)
// Without a recipe the flow is the v0 department flow (vedoucí → zadání → tvůrce → kontrola → doručení).
// Nothing here is guessed: a role or step without data is shown as „nelze ověřit“ / „zatím nedefinováno“.
import type { LogEntry, Order, OrderState } from "../types";
import { headline as legacyHeadline, keyEvents, type Headline, type KeyEvent } from "./story";
import {
  ACTIVE_STATES,
  buildView,
  classifyCalls,
  consequence,
  CREATOR_BY_DEPT,
  formatAgo,
  humanProblem,
  lockFor,
  missionName,
  safe,
  STATE_LABEL,
  type CallInfo,
  type CardDoc,
  type McInput,
  type McView,
  type TeamKey,
} from "./view";

export type Kind = "plan" | "create" | "check" | "deliver" | "owner";

export interface RecipeStep {
  role: string;
  label?: string;
  kind?: Kind;
}
export interface Recipe {
  id: string;
  version?: string;
  steps: RecipeStep[];
}
type OrderWithRecipe = Order & { recipe?: Recipe; recipe_step?: number };

const ROLE_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;

/** Known roles: card role id → display + identity key. */
export const KNOWN: Record<string, { name: string; sub: string; team: TeamKey }> = {
  supervizor: { name: "Vedoucí", sub: "Delivery Lead · supervizor", team: "vedouci" },
  kontrolor: { name: "Kontrolor", sub: "Kontrola jiné rodiny modelů", team: "kontrolor" },
  "copy-studio": { name: "Copywriter", sub: "Copy Studio", team: "copywriter" },
  vizual: { name: "Designér", sub: "Visual/UI Lead", team: "designer" },
  vyvojar: { name: "Vývojář", sub: "Executor · AI Chain", team: "vyvojar" },
  brana: { name: "Brána", sub: "Independent Gate", team: "brana" },
  strazce: { name: "Strážce", sub: "TARS-GUARD · bezpečnostní invarianty", team: "strazce" },
};
const TEAM_TO_ROLE: Record<TeamKey, string> = {
  vedouci: "supervizor",
  kontrolor: "kontrolor",
  copywriter: "copy-studio",
  designer: "vizual",
  vyvojar: "vyvojar",
  brana: "brana",
  strazce: "strazce",
};
const CORE_ORDER = ["supervizor", "copy-studio", "vizual", "vyvojar", "kontrolor", "brana", "strazce"];

/** Work verbs by role (headline templates). */
const VERB: Record<string, { work: string; fix: string; check?: string }> = {
  "copy-studio": { work: "píše texty", fix: "upravuje texty po kontrole" },
  vizual: { work: "navrhuje vizuál", fix: "upravuje vizuál po kontrole" },
  vyvojar: { work: "implementuje změnu", fix: "opravuje změnu po review" },
  reserser: { work: "připravuje podklady", fix: "doplňuje podklady po kontrole" },
  "strazce-hlasu": { work: "hlídá hlas značky", fix: "upravuje návrh hlasu po kontrole" },
  architekt: { work: "navrhuje řešení", fix: "upravuje návrh řešení po kontrole" },
};

export interface Step {
  id: string;
  roleId?: string;
  label: string;
  kind: Kind;
  status: "done" | "current" | "future" | "error" | "paused" | "skipped";
  at?: string;
  note?: string;
  /** Recipe step name (e.g. „Implementace“); equals label when the recipe gives none. */
  stepName: string;
  /** Times work came back from this check to the step before it (FIX loop). */
  returns: number;
  who?: string;
}

export interface LiveOrder {
  id: string;
  mission: string;
  department: string;
  state: OrderState;
  stateLabel: string;
  headline: Headline;
  verified: boolean;
  active: boolean;
  startedAt: string;
  endedAt?: string;
  steps: Step[];
  recipe?: string;
  activeRole?: string;
  activeStep?: Step;
  nextRole?: string;
  nextLabel?: string;
  problem?: { what: string; consequence: string };
  lastEvent?: { at: string; text: string };
  rank: number;
}

export interface Assignment {
  order: string;
  title: string;
  step: string;
  verified: boolean;
}

export interface RoleView {
  id: string;
  name: string;
  sub: string;
  team?: TeamKey;
  status: "working" | "checking" | "waiting" | "idle" | "unknown" | "alarm" | "ok";
  statusLabel: string;
  activity: string;
  model?: string;
  works: Assignment[];
  next: Assignment[];
  callsToday: number;
  workMsToday: number;
  card?: CardDoc;
  responsibility: string;
}

export interface FinalView {
  view: McView;
  status: McView["status"];
  statusLabel: string;
  focus?: LiveOrder;
  /** Other running orders (and ones waiting for the owner), compact rows. */
  running: LiveOrder[];
  orders: LiveOrder[];
  roles: RoleView[];
  events: KeyEvent[];
  phaseKey: string;
}

const RANK: Partial<Record<OrderState, number>> = { WAITING_OWNER: 0, DELIVERED: 1, CHECKING: 2, FIXING: 3, DOING: 4, PLANNED: 5, NEW: 6, PAUSED: 7 };

function recipeOf(o: Order): Recipe | undefined {
  const r = (o as OrderWithRecipe).recipe;
  if (!r || !Array.isArray(r.steps) || !r.steps.length) return undefined;
  const steps = r.steps.filter((s) => s && typeof s.role === "string" && ROLE_RE.test(s.role));
  return steps.length ? { id: safe(String(r.id ?? "recept"), 40), version: r.version ? safe(String(r.version), 20) : undefined, steps } : undefined;
}

export function roleName(id: string, cards: Record<string, CardDoc> = {}, label?: string): string {
  return KNOWN[id]?.name || (label ? safe(label, 40) : "") || safe(cards[id]?.title, 40) || id;
}

function roleOfCall(c: CallInfo): string {
  const card = (c as LogEntry & { card?: string }).card;
  return card && ROLE_RE.test(card) ? card : TEAM_TO_ROLE[c.member];
}

function ownerNeeded(o: Order): boolean {
  if (o.owner_needed !== undefined) return o.owner_needed;
  return o.brief?.department === "dev" || (o.brief?.owner_decisions?.length ?? 0) > 0;
}

/** Steps of the order: planning + recipe (or v0 department flow) + delivery + owner GO when needed. */
export function stepsOf(o: Order, calls: CallInfo[], cards: Record<string, CardDoc>): Step[] {
  const mine = calls.filter((c) => c.order === o.id);
  const modelOf = (role: string) => safe(mine.filter((c) => roleOfCall(c) === role && c.model).at(-1)?.model, 60) || undefined;
  const steps: Step[] = [
    { id: "lead", roleId: "supervizor", label: "Vedoucí", stepName: "Plán zakázky", kind: "plan", status: "future", returns: 0, who: modelOf("supervizor") },
    { id: "brief", roleId: "kontrolor", label: "Zadání", stepName: "Kontrola zadání", kind: "check", status: "future", returns: 0, who: safe(mine.filter((c) => c.phase === "brief" && c.member === "kontrolor").at(-1)?.model, 60) || undefined },
  ];
  const recipe = recipeOf(o);
  const dept = o.brief?.department ?? "";
  if (recipe) {
    recipe.steps.forEach((s, i) =>
      steps.push({ id: `r${i}`, roleId: s.role, label: roleName(s.role, cards, s.label), stepName: s.label ? safe(s.label, 40) : roleName(s.role, cards), kind: s.kind ?? "create", status: "future", returns: 0, who: modelOf(s.role) }),
    );
  } else {
    const creator = CREATOR_BY_DEPT[dept] ? TEAM_TO_ROLE[CREATOR_BY_DEPT[dept]] : undefined;
    const checker = dept === "vizual" ? "brana" : "kontrolor";
    steps.push({ id: "create", roleId: creator, label: creator ? roleName(creator) : "Tvůrce", stepName: "Tvorba", kind: "create", status: "future", returns: 0, who: creator ? modelOf(creator) : undefined });
    steps.push({ id: "check", roleId: checker, label: dept === "dev" ? "Kontrolor · CI" : roleName(checker), stepName: "Kontrola", kind: "check", status: "future", returns: 0, who: safe(mine.filter((c) => c.phase === "work" && (c.member === "kontrolor" || c.member === "brana")).at(-1)?.model, 60) || undefined });
  }
  if (!steps.some((s) => s.kind === "deliver")) steps.push({ id: "delivery", label: "Doručení", stepName: "Doručení", kind: "deliver", status: "future", returns: 0, who: dept === "dev" ? "PR draft" : "Notion DRAFT" });
  if (ownerNeeded(o) && !steps.some((s) => s.kind === "owner")) steps.push({ id: "owner", label: "Moje GO", stepName: "Rozhodnutí vlastníka", kind: "owner", status: "future", returns: 0, who: "vlastník" });

  const body = steps.slice(2);
  const firstBody = (k: Kind) => 2 + Math.max(0, body.findIndex((s) => s.kind === k));
  const recipeIdx = () => {
    const rs = (o as OrderWithRecipe).recipe_step;
    return recipe && Number.isInteger(rs) && rs! >= 0 && rs! < recipe.steps.length ? 2 + rs! : undefined;
  };
  const lastBrief = mine.filter((c) => c.phase === "brief").at(-1);
  const indexOf = (s: OrderState): number => {
    switch (s) {
      case "NEW":
        return lastBrief && (lastBrief.member === "kontrolor" || (lastBrief.member === "vedouci" && lastBrief.result === "ok")) ? 1 : 0;
      case "PLANNED":
      case "DOING":
      case "FIXING":
        return recipeIdx() ?? firstBody("create");
      case "CHECKING":
        return recipeIdx() ?? firstBody("check");
      case "DELIVERED":
        return steps.findIndex((x) => x.kind === "deliver");
      case "WAITING_OWNER":
        return steps.findIndex((x) => x.kind === "owner");
      default:
        return steps.findIndex((x) => x.kind === "deliver");
    }
  };
  const mark = (cur: number, st: Step["status"]) => steps.forEach((x, i) => (x.status = i < cur ? "done" : i === cur ? st : "future"));

  // times we know for sure
  steps[0].at = mine.find((c) => c.member === "vedouci" && c.result === "ok")?.ts;
  steps[1].at = o.history.find((h) => h.event === "planned")?.at;
  if (!recipe) {
    steps[2].at = o.history.find((h) => ["PLANNED", "DOING", "FIXING"].includes(h.from) && h.to === "CHECKING")?.at;
    steps[3].at = o.history.filter((h) => h.from === "CHECKING").at(-1)?.at;
  }
  const dlv = steps.findIndex((x) => x.kind === "deliver");
  steps[dlv].at = o.history.find((h) => h.from === "DELIVERED")?.at;

  if (o.state === "DONE") steps.forEach((x) => (x.status = "done"));
  else if (o.state === "FAILED" || o.state === "UNKNOWN") {
    const last = o.history.at(-1);
    const from = last?.from === "PAUSED" && o.paused_from ? o.paused_from : (last?.from ?? "NEW");
    const i = Math.max(0, indexOf(from));
    mark(i, "error");
    steps[i].at = last?.at;
    steps.slice(i + 1).forEach((x) => (x.status = "skipped"));
  } else if (o.state === "PAUSED") mark(Math.max(0, indexOf(o.paused_from ?? "NEW")), "paused");
  else {
    const i = Math.max(0, indexOf(o.state));
    mark(i, "current");
    if (o.state === "FIXING") steps[i].note = `oprava, kolo ${o.fix_rounds}`;
  }
  for (const x of steps) if (x.status === "future" || x.status === "skipped" || x.status === "current") x.at = undefined;

  // FIX loops: brief returns from real verdicts; work returns from CHECKING→FIXING, attached to the
  // last check step at or before the current position (exact when the recipe has one check step).
  steps[1].returns = mine.filter((c) => c.phase === "brief" && c.member === "kontrolor" && c.result === "FIX").length;
  const workReturns = o.history.filter((h) => h.from === "CHECKING" && h.to === "FIXING").length;
  if (workReturns) {
    const cur = steps.findIndex((x) => x.status !== "done");
    const upto = cur < 0 ? steps.length - 1 : cur + 1;
    const checks = steps.map((x, i) => ({ x, i })).filter(({ x, i }) => i >= 2 && x.kind === "check");
    const target = checks.filter(({ i }) => i <= upto).at(-1) ?? checks[0];
    if (target) target.x.returns = workReturns;
  }
  return steps;
}

function headlineFor(o: Order, steps: Step[], calls: CallInfo[], verified: boolean, problem: string | undefined): Headline {
  if (!recipeOf(o)) return legacyHeadline(o, calls, verified, problem);
  const base = legacyHeadline(o, calls, verified, problem);
  const cur = steps.find((s) => s.status === "current");
  if (!cur || !["PLANNED", "DOING", "FIXING", "CHECKING"].includes(o.state) || base.title === "Stav nelze ověřit") return base;
  const name = cur.label;
  const nx = steps[steps.indexOf(cur) + 1];
  const v = VERB[cur.roleId ?? ""];
  const then = nx ? `Potom práci převezme ${nx.label.toLowerCase()}.` : "";
  if (cur.kind === "check")
    return { ...base, tone: "check", title: `${name} ${o.fix_rounds ? "znovu " : ""}kontroluje výstup`, subtitle: `Ověřuje výstup předchozího kroku receptu. ${then}`.trim() };
  if (o.state === "FIXING")
    return { ...base, tone: "fix", title: `${name} ${v?.fix ?? "upravuje výstup po kontrole"}`, subtitle: `Zapracovává připomínky z ${o.fix_rounds}. kola. Následně proběhne opakovaná kontrola.` };
  return { ...base, tone: "live", title: `${name} ${v?.work ?? "pracuje na svém kroku"}`, subtitle: `Krok ${steps.indexOf(cur) - 1} z ${steps.filter((s, i) => i >= 2 && s.kind !== "deliver" && s.kind !== "owner").length} receptu ${safe(recipeOf(o)!.id, 30)}. ${then}`.trim() };
}

function liveOrder(input: McInput, o: Order, calls: CallInfo[], cards: Record<string, CardDoc>, view: McView): LiveOrder {
  const active = ACTIVE_STATES.includes(o.state);
  const verified = active && o.state !== "PAUSED" && lockFor(input, o.id).alive;
  const steps = stepsOf(o, calls, cards);
  const ov = view.orders.find((x) => x.id === o.id);
  const problem = o.state === "FAILED" || o.state === "UNKNOWN" ? { what: humanProblem(o.failure_reason), consequence: consequence(o.state) } : undefined;
  const hl = headlineFor(o, steps, calls, verified, problem?.what);
  const cur = steps.find((s) => s.status === "current");
  const nx = cur ? steps[steps.indexOf(cur) + 1] : undefined;
  return {
    id: o.id,
    mission: missionName(o.mission),
    department: ov?.department ?? "",
    state: o.state,
    stateLabel: STATE_LABEL[o.state],
    headline: hl,
    verified,
    active,
    startedAt: o.created_at,
    endedAt: active || o.state === "WAITING_OWNER" ? undefined : o.updated_at,
    steps,
    recipe: recipeOf(o) ? `${recipeOf(o)!.id}${recipeOf(o)!.version ? ` v${recipeOf(o)!.version}` : ""}` : undefined,
    activeRole: cur?.roleId,
    activeStep: cur,
    nextRole: nx?.roleId,
    nextLabel: nx ? `${nx.label}${nx.who && !/nevolán/.test(nx.who) ? ` · ${nx.who}` : ""}` : undefined,
    problem,
    lastEvent: ov?.lastEvent,
    rank: RANK[o.state] ?? 9,
  };
}

export function buildFinal(input: McInput, focusId?: string): FinalView {
  const view = buildView(input);
  const orders = [...input.orders].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const calls = classifyCalls(orders, input.log);
  const cards = input.cardDocs ?? {};
  const all = orders.map((o) => liveOrder(input, o, calls, cards, view));
  const open = all.filter((o) => o.active || o.state === "WAITING_OWNER").sort((a, b) => a.rank - b.rank || a.startedAt.localeCompare(b.startedAt));
  const focus = all.find((o) => o.id === focusId) ?? open[0] ?? all.at(-1);
  const running = open.filter((o) => o !== focus);

  // status across orders (any verified work → working; active but unverified → unknown)
  let status = view.status;
  const activeAll = all.filter((o) => o.active && o.state !== "PAUSED");
  if (!input.unavailable) {
    if (view.guard && !view.guard.ok) status = "problem";
    else if (activeAll.some((o) => o.verified)) status = "working";
    else if (activeAll.length) status = "unknown";
  }

  // roles: core + recipe roles + every card on disk
  const ids = new Set<string>(CORE_ORDER);
  for (const o of input.orders) recipeOf(o)?.steps.forEach((s) => (s.kind ?? "create") !== "deliver" && (s.kind ?? "create") !== "owner" && ids.add(s.role));
  for (const k of Object.keys(cards)) if (ROLE_RE.test(k)) ids.add(k);
  const labelOf = new Map<string, string>();
  for (const o of input.orders) recipeOf(o)?.steps.forEach((s) => s.label && labelOf.set(s.role, s.label));
  const today = calls.filter((c) => new Date(c.ts).toDateString() === new Date(input.now).toDateString());
  const guardLast = input.log.filter((e) => e.kind === "guard").at(-1);
  const roles: RoleView[] = [...ids].map((id) => {
    const known = KNOWN[id];
    const mine = calls.filter((c) => roleOfCall(c) === id);
    const works: Assignment[] = [];
    const next: Assignment[] = [];
    for (const o of all) {
      if (!o.active || o.state === "PAUSED") continue;
      if (o.activeRole === id) works.push({ order: o.id, title: o.headline.title, step: o.activeStep?.stepName ?? "", verified: o.verified });
      else if (o.nextRole === id && o.verified) next.push({ order: o.id, title: o.headline.title, step: o.nextLabel ?? "", verified: true });
    }
    const verifiedWork = works.filter((w) => w.verified);
    const isCheck = all.some((o) => o.activeRole === id && o.activeStep?.kind === "check" && o.verified);
    let status: RoleView["status"] = "idle";
    let statusLabel = "V klidu";
    let activity = mine.length ? `Naposledy ${formatAgo(mine.at(-1)!.ts, input.now)}` : "Dnes zatím bez práce";
    if (id === "strazce") {
      status = !guardLast ? "unknown" : guardLast.result === "OK" ? "ok" : "alarm";
      statusLabel = status === "ok" ? "Vše v pořádku" : status === "alarm" ? "Poplach" : "Nelze ověřit";
      activity = guardLast ? `Poslední kontrola ${formatAgo(guardLast.ts, input.now)}` : "Žádný záznam kontroly";
    } else if (verifiedWork.length) {
      status = isCheck ? "checking" : "working";
      statusLabel = isCheck ? "Kontroluje" : "Pracuje";
      activity = verifiedWork.length > 1 ? `Na ${verifiedWork.length} zakázkách` : verifiedWork[0].title;
    } else if (works.length) {
      status = "unknown";
      statusLabel = "Nelze ověřit";
      activity = "Záznam říká, že je na řadě, ale proces neběží";
    } else if (next.length) {
      status = "waiting";
      statusLabel = "Převezme dál";
      activity = next[0].title;
    }
    const card = cards[id];
    const fallbackResp: Record<string, string> = {
      kontrolor: "Kontroluje zadání i výstupy; vždy jiná rodina modelů než tvůrce (TARS-ORCH-001 §1).",
      strazce: "Před během ověřuje bezpečnostní invarianty; při poplachu se supervizor zastaví (TARS-ORCH-001 §6).",
    };
    return {
      id,
      name: roleName(id, cards, labelOf.get(id)),
      sub: known?.sub || safe(card?.title, 60) || "role z receptu",
      team: known?.team,
      status,
      statusLabel,
      activity,
      model: id === "strazce" ? "deterministický skript" : safe(mine.filter((c) => c.model).at(-1)?.model, 70) || undefined,
      works,
      next,
      callsToday: id === "strazce" ? input.log.filter((e) => e.kind === "guard" && new Date(e.ts).toDateString() === new Date(input.now).toDateString()).length : today.filter((c) => roleOfCall(c) === id).length,
      workMsToday: today.filter((c) => roleOfCall(c) === id).reduce((a, c) => a + (c.duration_ms ?? 0), 0),
      card,
      responsibility: safe(card?.mission, 260) || fallbackResp[id] || "Zatím nedefinováno",
    };
  });

  const titles = new Map(all.map((o) => [o.id, o.headline.technical]));
  return {
    view,
    status,
    statusLabel: { working: "Pracuje", waiting: "Čeká", paused: "Pozastaveno", problem: "Problém", unavailable: "Nedostupné", unknown: "Nelze ověřit" }[status],
    focus,
    running,
    orders: all.slice().reverse(),
    roles,
    events: keyEvents(orders, input.log, calls, titles, 12, (card) => roleName(card, cards, labelOf.get(card))),
    phaseKey: focus ? `${focus.id}|${focus.state}|${focus.activeStep?.id ?? ""}|${focus.verified ? 1 : 0}` : "none",
  };
}

/** Role page data: role + its documented history across orders. */
export interface RolePage {
  role: RoleView;
  history: { at: string; order: string; title: string; what: string; result?: string; durationMs?: number; model?: string }[];
  orders: { id: string; title: string; state: string; at: string }[];
}

export function buildRolePage(input: McInput, id: string): RolePage | undefined {
  if (!ROLE_RE.test(id)) return undefined;
  const f = buildFinal(input);
  const role = f.roles.find((r) => r.id === id);
  if (!role) return undefined;
  const orders = [...input.orders].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const calls = classifyCalls(orders, input.log);
  const title = new Map(f.orders.map((o) => [o.id, o.headline.technical]));
  const RESULT: Record<string, string> = { PASS: "schváleno", FIX: "vráceno k opravě", BLOCK: "zastaveno", ok: "dokončeno", error: "chyba" };
  const history =
    id === "strazce"
      ? input.log
          .filter((e) => e.kind === "guard")
          .map((e) => ({ at: e.ts, order: "-", title: "", what: "Kontrola invariantů TARS-GUARD", result: e.result === "OK" ? "OK" : safe(e.result, 30) }))
      : calls
          .filter((c) => roleOfCall(c) === id)
          .map((c) => ({
            at: c.ts,
            order: c.order,
            title: title.get(c.order) ?? c.order,
            what: c.phase === "brief" ? (c.member === "vedouci" ? "Napsal zadání" : "Kontrola zadání") : c.member === "kontrolor" || c.member === "brana" ? "Kontrola výstupu" : "Práce na výstupu",
            result: RESULT[c.result ?? ""] ?? safe(c.result, 30),
            durationMs: c.duration_ms,
            model: safe(c.model, 60) || undefined,
          }));
  const seen = new Set(history.map((h) => h.order));
  return {
    role,
    history: history.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40),
    orders: f.orders.filter((o) => seen.has(o.id)).map((o) => ({ id: o.id, title: o.headline.technical, state: o.stateLabel, at: o.startedAt })),
  };
}
