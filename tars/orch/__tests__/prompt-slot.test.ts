// REPORT-adapter O1 + O2: the prompt never passes through the driver's output. The driver types TARS_PROMPT_SLOT, the
// gate (PreToolUse hook) replaces it with the exact text of a file outside the MCP workspace (updatedInput), sha256
// stays. No model, no real Chrome, no network: a fake driver and the real hook process.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { AdapterResult, RunOpts, TextAdapter } from "../adapters";
import { chatGptSteps, waitReason } from "../chatgpt-web";
import { buildTask, McpBrowser, UiUnknownError } from "../mcp-browser";
import {
  countCall,
  emptyState,
  gateMcpCall,
  observeResponse,
  readState,
  resolvePromptSlot,
  TARS_PROMPT_SLOT,
  typedTextSha,
  type GateState,
} from "../mcp-gate";

const GATE = path.join(__dirname, "..", "mcp-gate.ts");
const T = "mcp__playwright__browser_type";
const C = "mcp__playwright__browser_click";

const cleanup: Array<() => void> = [];
afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
});
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "slot-"));
  cleanup.push(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
};

/** A synthetic prompt ≥ 48 KB (no real data): plain lines that the snapshot shows one paragraph each. */
const BIG = Array.from(
  { length: 1400 },
  (_, i) => `radek ${i} zadani kontroly bez dat ${"x".repeat(i % 17)} konec`,
).join("\n");

/** Field e5 empty, send button e6 (the last snapshot). */
const readyState = (): GateState => ({
  ...emptyState(),
  calls: 5,
  refs: {
    e5: {
      label: 'textbox "Zeptat se ChatGPT"',
      ok: true,
      submit: false,
      role: "textbox",
      name: "Zeptat se ChatGPT",
      content: "",
    },
    e6: {
      label: 'button "Odeslat výzvu"',
      ok: true,
      submit: true,
      role: "button",
      name: "Odeslat výzvu",
    },
  },
});

/** The page after typing: the field holds `text` (one paragraph per line). */
const typedPage = (text: string) =>
  `### Page\n- Page URL: https://chatgpt.com/\n### Snapshot\n\`\`\`yaml\n- textbox "Zeptat se ChatGPT" [ref=e5]:\n${text
    .split("\n")
    .map((l) => `  - paragraph: ${l}`)
    .join("\n")}\n- button "Odeslat výzvu" [ref=e6]\n\`\`\``;

describe("O1: zástupný token, text vkládá brána", () => {
  it("prompt ≥ 48 KB: slot + správný soubor → updatedInput má přesně bajty souboru; jiné pole beze změny", () => {
    expect(Buffer.byteLength(BIG)).toBeGreaterThanOrEqual(48 * 1024);
    const f = path.join(tmp(), "prompt.txt");
    fs.writeFileSync(f, BIG);
    const r = resolvePromptSlot(
      T,
      { ref: "e5", element: "pole", text: TARS_PROMPT_SLOT },
      typedTextSha(BIG),
      f,
    );
    expect(typeof r).toBe("object");
    const ok = r as { input: Record<string, unknown>; replaced: boolean };
    expect(ok.replaced).toBe(true);
    expect(
      Buffer.from(ok.input.text as string).equals(fs.readFileSync(f)),
    ).toBe(true);
    expect(ok.input).toMatchObject({ ref: "e5", element: "pole" });
  });

  it("fail-closed: bez souboru, změněný soubor, jiný text (i správný prompt ručně), bez sha → zamítnuto, text v důvodu není", () => {
    const d = tmp();
    const f = path.join(d, "prompt.txt");
    const sha = typedTextSha(BIG);
    const slot = { ref: "e5", text: TARS_PROMPT_SLOT };
    // no file
    const missing = resolvePromptSlot(T, slot, sha, path.join(d, "nic.txt"));
    expect(missing).toMatch(/chybí/);
    // file changed after the plan (one byte)
    fs.writeFileSync(f, `${BIG.slice(0, -1)}Y`);
    expect(resolvePromptSlot(T, slot, sha, f)).toMatch(/sha256/);
    // the right text typed by hand: only the slot is allowed
    fs.writeFileSync(f, BIG);
    const byHand = resolvePromptSlot(T, { ref: "e5", text: BIG }, sha, f);
    expect(byHand).toMatch(/jen zástupný token/);
    expect(String(byHand)).not.toContain("radek 1");
    expect(resolvePromptSlot(T, { ref: "e5", text: "jiný" }, sha, f)).toMatch(
      /jen zástupný token/,
    );
    expect(resolvePromptSlot(T, slot, undefined, f)).toMatch(/sha256/);
    // clearing and other tools pass through unchanged (the gate judges them as before)
    expect(resolvePromptSlot(T, { ref: "e5", text: "" }, sha, f)).toEqual({
      input: { ref: "e5", text: "" },
      replaced: false,
    });
    expect(resolvePromptSlot(C, { ref: "e6" }, sha, f)).toEqual({
      input: { ref: "e6" },
      replaced: false,
    });
    // without a prompt file (other runs) nothing changes; the slot itself never matches the sha → deny by the gate
    expect(resolvePromptSlot(T, slot, sha, undefined)).toEqual({
      input: slot,
      replaced: false,
    });
    expect(gateMcpCall(T, slot, readyState(), undefined, sha)).toMatch(
      /sha256/,
    );
  });

  it("nahrazený vstup projde ostatními pravidly brány: po odeslání, overlay, neprázdné pole = zamítnuto; jedno odeslání po ověření pole", () => {
    const f = path.join(tmp(), "prompt.txt");
    fs.writeFileSync(f, BIG);
    const sha = typedTextSha(BIG);
    const typed = (
      resolvePromptSlot(T, { ref: "e5", text: TARS_PROMPT_SLOT }, sha, f) as {
        input: Record<string, unknown>;
      }
    ).input;
    expect(
      gateMcpCall(T, typed, { ...readyState(), submits: 1 }, undefined, sha),
    ).toMatch(/po odeslání/);
    expect(
      gateMcpCall(T, typed, { ...readyState(), overlay: true }, undefined, sha),
    ).toMatch(/menu nebo popover/);
    const dirty = readyState();
    dirty.refs.e5.content = "rozepsáno";
    expect(gateMcpCall(T, typed, dirty, undefined, sha)).toMatch(/prázdné/);
    // the regular way: type (replaced), snapshot shows the prompt, one send; a second send is denied
    const st = readyState();
    expect(gateMcpCall(T, typed, st, undefined, sha)).toBeUndefined();
    countCall(T, typed, st);
    expect(gateMcpCall(C, { ref: "e6" }, st, undefined, sha)).toMatch(
      /neodpovídá/,
    ); // content unknown until a snapshot
    observeResponse(typedPage(BIG), st);
    expect(gateMcpCall(C, { ref: "e6" }, st, undefined, sha)).toBeUndefined();
    countCall(C, { ref: "e6" }, st);
    expect(st.submits).toBe(1);
    expect(gateMcpCall(C, { ref: "e6" }, st, undefined, sha)).toMatch(
      /po odeslání/,
    );
  });

  it("hook proces: slot → exit 0 a updatedInput s přesným textem; bez souboru / změněný soubor → exit 2, nic na stdout, text nikde v chybě", () => {
    const d = tmp();
    const stateFile = path.join(d, "state.json");
    const promptFile = path.join(d, "prompt.txt");
    fs.writeFileSync(promptFile, BIG);
    const sha = typedTextSha(BIG);
    const run = (file: string, state: GateState = readyState()) => {
      fs.writeFileSync(stateFile, JSON.stringify(state));
      return spawnSync("npx", ["tsx", GATE, "pre"], {
        encoding: "utf8",
        input: JSON.stringify({
          tool_name: T,
          tool_input: { ref: "e5", element: "pole", text: TARS_PROMPT_SLOT },
        }),
        timeout: 60_000,
        env: {
          ...process.env,
          TARS_GATE_STATE: stateFile,
          TARS_GATE_TYPE_SHA: sha,
          TARS_GATE_TYPE_FILE: file,
        } as NodeJS.ProcessEnv,
      });
    };
    const ok = run(promptFile);
    expect(ok.status).toBe(0);
    const out = JSON.parse(ok.stdout) as {
      hookSpecificOutput: {
        hookEventName: string;
        permissionDecision: string;
        updatedInput: Record<string, unknown>;
      };
    };
    expect(out.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(out.hookSpecificOutput.permissionDecision).toBe("allow");
    expect(out.hookSpecificOutput.updatedInput).toEqual({
      ref: "e5",
      element: "pole",
      text: BIG,
    });
    const st = readState(stateFile)!;
    expect(st.calls).toBe(6);
    expect(st.typedRef).toBe("e5");
    expect(JSON.stringify(st)).not.toContain("radek 1"); // the state never holds the prompt
    // no file → deny, nothing typed
    const none = run(path.join(d, "nic.txt"));
    expect(none.status).toBe(2);
    expect(none.stdout).toBe("");
    expect(none.stderr).toMatch(/chybí/);
    expect(readState(stateFile)!.calls).toBe(5); // a denied call is not counted
    // file changed after the plan → sha mismatch → deny
    fs.writeFileSync(promptFile, `${BIG}\nnavíc`);
    const changed = run(promptFile);
    expect(changed.status).toBe(2);
    expect(changed.stdout).toBe("");
    expect(changed.stderr).toMatch(/sha256/);
    for (const r of [none, changed]) expect(r.stderr).not.toContain("radek 1");
    // after the send: the slot is denied even with the right file
    fs.writeFileSync(promptFile, BIG);
    const after = run(promptFile, { ...readyState(), submits: 1 });
    expect(after.status).toBe(2);
    expect(after.stdout).toBe("");
  }, 120_000);
});

describe("O1: McpBrowser a úloha ovladače", () => {
  it("úloha ovladače neobsahuje prompt, jen zástupný token", () => {
    const task = buildTask(chatGptSteps(BIG, "MARKER-1"), "shots");
    expect(task).not.toContain("radek 1 zadani");
    expect(task).not.toContain("<<<TEXT");
    expect(task).toContain(`s textem přesně ${TARS_PROMPT_SLOT}`);
  });

  it("run: soubor s promptem leží mimo pracovní složku MCP, má přesné bajty, brána ho dostane přes TARS_GATE_TYPE_FILE a po běhu zmizí; odesláno ≠ 1 = UNKNOWN beze změny", async () => {
    const dir = tmp();
    const script = path.join(dir, "fake-browser.sh");
    fs.writeFileSync(script, "#!/bin/bash\nexit 0\n", { mode: 0o755 });
    const shots = path.join(dir, "order", "shots-r0");
    const seen: { task: string; file: string; bytes: Buffer; sha: string }[] =
      [];
    const cmdOf = (opts: RunOpts) =>
      (
        JSON.parse(opts.settings!) as {
          hooks: { PreToolUse: Array<{ hooks: Array<{ command: string }> }> };
        }
      ).hooks.PreToolUse[0].hooks[0].command;
    const driver: TextAdapter = {
      name: "fake-driver",
      model: "sonnet",
      family: "claude",
      async run(task, opts): Promise<AdapterResult> {
        const cmd = cmdOf(opts);
        const file = /TARS_GATE_TYPE_FILE="([^"]+)"/.exec(cmd)![1];
        const state = /TARS_GATE_STATE="([^"]+)"/.exec(cmd)![1];
        seen.push({
          task,
          file,
          bytes: fs.readFileSync(file),
          sha: /TARS_GATE_TYPE_SHA="([0-9a-f]{64})"/.exec(cmd)![1],
        });
        expect(file.startsWith(opts.cwd!)).toBe(false);
        expect(path.dirname(file)).toBe(path.dirname(state));
        expect(fs.statSync(file).mode & 0o077).toBe(0);
        fs.writeFileSync(state, JSON.stringify({ ...emptyState(), calls: 9 }));
        return {
          ok: true,
          text: "FINAL_URL: https://chatgpt.com/\nRESULT: UNKNOWN obsah-pole",
          limit: false,
          duration_ms: 1,
        };
      },
    };
    const b = new McpBrowser(driver, { script, profileDir: dir });
    const reports: unknown[] = [];
    await expect(
      b.run(chatGptSteps(BIG, "MARKER-1"), shots, (s) => reports.push(s)),
    ).rejects.toThrow(UiUnknownError);
    expect(reports).toEqual([{ submitted: false, url: undefined }]);
    const [s] = seen;
    expect(s.task).not.toContain("radek 1 zadani");
    const filled = (
      chatGptSteps(BIG, "MARKER-1").find((x) => x.kind === "fill") as {
        value: string;
      }
    ).value;
    expect(s.bytes.equals(Buffer.from(filled))).toBe(true);
    expect(s.sha).toBe(typedTextSha(filled));
    expect(fs.existsSync(s.file)).toBe(false); // removed with the gate state
  });
});

describe("O2: pravdivý důvod místo „odpověď nedorazila“", () => {
  it("Playwright timeout před odesláním, zabitý ovladač, skutečně pozdní odpověď", () => {
    const pw = new UiUnknownError(
      "text nebyl odeslán právě jednou po ověření obsahu pole (odesláno: 0; ovladač: Timeout 5000ms exceeded waiting for element to be visible, enabled and stable)",
      [],
    );
    expect(waitReason(pw, false)).toMatch(
      /^krok v prohlížeči nedoběhl v časovém limitu \(prvek nereagoval\): .*Timeout 5000ms.*; nic neodesláno$/,
    );
    expect(waitReason(pw, false)).not.toMatch(/nedorazila/);
    const killed = new Error("ovladač prohlížeče selhal: timeout");
    expect(waitReason(killed, false)).toBe(
      "ovladač prohlížeče nedokončil kroky v limitu běhu; nic neodesláno",
    );
    expect(waitReason(killed, "unknown")).toBe(
      "ovladač prohlížeče nedokončil kroky v limitu běhu; odeslání nejde potvrdit",
    );
    expect(
      waitReason(new UiUnknownError("krok selhal: timeout", []), true),
    ).toBe("odpověď ChatGPT nedorazila v časovém limitu");
  });
});
