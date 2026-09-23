import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zásady ochrany soukromí — Good Inventions",
  description: "Zásady ochrany soukromí pro projekty Jana Bindra (Good Inventions).",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="label-ui mb-3">Good Inventions</p>
      <h1 className="font-serif text-4xl mb-10" style={{ color: "var(--foreground)" }}>
        Zásady ochrany soukromí
      </h1>

      <section className="space-y-8 text-[15px] leading-relaxed" style={{ color: "var(--foreground)" }}>
        <p>
          Provozovatel: <strong>Jan Bindr</strong> (Good Inventions).
          Kontakt: <a href="mailto:honza.bindr@gmail.com" className="underline">honza.bindr@gmail.com</a>.
        </p>

        <div>
          <h2 className="font-semibold mb-2">Osobní nástroje H2</h2>
          <p>
            Nástroje H2 (H2 Buddy, H2 Inbox Watcher) jsou osobní automatizace a
            používá je výhradně provozovatel. Neslouží veřejnosti ani třetím
            stranám.
          </p>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Přístup ke Google Kalendáři</h2>
          <p>
            Přístup ke Google Kalendáři slouží pouze k vytváření událostí a
            čtení seznamu kalendářů v rámci vlastního účtu provozovatele.
            Data z kalendáře se nepoužívají k žádnému jinému účelu.
          </p>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Sdílení dat</h2>
          <p>
            Data se nesdílí s třetími stranami s výjimkou zpracovatelů
            nutných pro provoz: Todoist, Anthropic, Vercel a Hetzner. Data se
            neprodávají.
          </p>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Smazání dat</h2>
          <p>
            O smazání dat lze požádat e-mailem na{" "}
            <a href="mailto:honza.bindr@gmail.com" className="underline">
              honza.bindr@gmail.com
            </a>
            .
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
          H2 tools (H2 Buddy, H2 Inbox Watcher) are personal automations used
          only by the operator.
        </p>
        <p>
          Google Calendar access is used only to create events and read the
          list of calendars on the operator&apos;s own account.
        </p>
        <p>
          Data is not shared with third parties except processors required
          for operation: Todoist, Anthropic, Vercel, and Hetzner. Data is
          never sold.
        </p>
        <p>
          To request deletion, email{" "}
          <a href="mailto:honza.bindr@gmail.com" className="underline">
            honza.bindr@gmail.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
