import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 text-zinc-950 px-6">
      <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-center">
        Good Inventions
      </h1>
      <p className="mt-4 text-lg text-zinc-500 text-center max-w-md">
        Analyzujeme, co lidé v Česku hledají na internetu.
      </p>
      <Link
        href="/suggest" prefetch={false}
        className="mt-8 inline-flex items-center rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100 hover:text-zinc-950"
      >
        Otevřít dashboard →
      </Link>
    </div>
  );
}
