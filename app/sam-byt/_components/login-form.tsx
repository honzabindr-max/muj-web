"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState<"sam" | "honzik">("sam");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "rate_limited">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/sam-byt/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.status === 429) {
        setStatus("rate_limited");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        return;
      }
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-3xl font-extrabold text-zinc-950">SAM-BYT</h1>
        <p className="mt-1 text-sm font-medium text-zinc-600">Soukromý výběr bytu pro Sama a Honzíka.</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex gap-2">
          {(["sam", "honzik"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setUsername(option)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                username === option ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {option === "sam" ? "Sam" : "Honzík"}
            </button>
          ))}
        </div>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Heslo"
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
        <button
          type="submit"
          disabled={status === "loading" || !password}
          className="rounded-xl bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {status === "loading" ? "Přihlašuji…" : "Přihlásit se"}
        </button>
        {status === "error" && <p className="text-sm text-red-600">Špatné jméno nebo heslo.</p>}
        {status === "rate_limited" && (
          <p className="text-sm text-red-600">Příliš mnoho pokusů. Zkus to za chvíli znovu.</p>
        )}
      </form>
    </div>
  );
}
