import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Podmínky použití — Good Inventions",
  description: "Podmínky použití pro projekty Jana Bindra (Good Inventions).",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="label-ui mb-3">Good Inventions</p>
      <h1 className="font-serif text-4xl mb-10" style={{ color: "var(--foreground)" }}>
        Podmínky použití
      </h1>

      <section className="space-y-8 text-[15px] leading-relaxed" style={{ color: "var(--foreground)" }}>
        <p>
          Provozovatel: <strong>Jan Bindr</strong> (Good Inventions).
          Kontakt: <a href="mailto:honza.bindr@gmail.com" className="underline">honza.bindr@gmail.com</a>.
        </p>

        <div>
          <h2 className="font-semibold mb-2">Charakter nástrojů</h2>
          <p>
            Nástroje v tomto projektu (včetně H2 Buddy a H2 Inbox Watcher)
            jsou osobní projekty provozovatele. Nejsou určeny jako veřejná
            služba pro třetí strany.
          </p>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Bez záruk</h2>
          <p>
            Nástroje jsou poskytovány „tak jak jsou", bez záruky dostupnosti,
            bezchybnosti nebo vhodnosti k určitému účelu. Provozovatel
            neodpovídá za škody vzniklé jejich používáním.
          </p>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Kontakt</h2>
          <p>
            Dotazy k podmínkám: <a href="mailto:honza.bindr@gmail.com" className="underline">honza.bindr@gmail.com</a>.
          </p>
        </div>
      </section>

      <hr className="my-12" style={{ borderColor: "var(--border)" }} />

      <section
        className="space-y-6 text-sm leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
        <p className="label-ui mb-1">English</p>
        <p>
          Operator: Jan Bindr (Good Inventions). Contact:{" "}
          <a href="mailto:honza.bindr@gmail.com" className="underline">
            honza.bindr@gmail.com
          </a>
          .
        </p>
        <p>
          Tools in this project (including H2 Buddy and H2 Inbox Watcher)
          are the operator&apos;s personal projects, not a public service for
          third parties.
        </p>
        <p>
          Provided &quot;as is&quot;, with no warranty of availability,
          correctness, or fitness for a particular purpose. The operator is
          not liable for damages arising from their use.
        </p>
      </section>
    </main>
  );
}
