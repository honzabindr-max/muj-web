import { RISKS } from '../data';
import { Callout } from './Callout';
import { Section } from './Section';

export function ContactsSection() {
  return (
    <Section id="kontakty" title="Ověř před cestou & kontakty">
      <div className="space-y-5">
        {/* Kritické věci k ověření */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-800">🔴 Kritické — ověřit před odjezdem</h3>
          <ul className="space-y-2 text-sm">
            {[
              {
                text: 'Rafting Slovinsko — permit v ceně (75 €/os)? Potvrdit písemně',
                link: 'https://www.raftingslovinsko.cz',
                linkLabel: 'raftingslovinsko.cz',
              },
              {
                text: 'Arriva letní linka Ljubljana↔Bovec — Po–So (ne neděle!), do 31.8.; návaznost na FlixBus',
                link: 'https://www.ap-ljubljana.si',
                linkLabel: 'ap-ljubljana.si',
              },
              {
                text: 'Bezplatný bus Vršič — staví zastávka Soča (Velika korita) v termínu?',
              },
              {
                text: 'Camp Bovec / Alpi Center — rezervace potvrdit e-mailem, hotovost připravit',
                link: 'https://www.campbovec.com',
                linkLabel: 'campbovec.com',
              },
              {
                text: 'Pojistka — krytí rafting WW3, canyoning, zipline, ferrata pro každého',
              },
            ].map((item, i) => (
              <li key={i} className="flex gap-2 text-slate-700">
                <span className="mt-0.5 flex-shrink-0 text-red-500">●</span>
                <span>
                  {item.text}
                  {item.link && (
                    <>
                      {' '}(
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-600 underline"
                      >
                        {item.linkLabel}
                      </a>
                      )
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Žluté — ověřit */}
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold mb-2">🟡 Ověřit, méně kritické</div>
          <ul className="space-y-1">
            {[
              'Hop-on-hop-off B3 jízdní řád a ceny 2026',
              'Vodní stav Soče (ovlivní rafting a koupání)',
              'Canyoning Sušec — aktuální dostupnost u Rafting Slovinsko',
              'Číslo lokálního taxi (zjistit první den na TIC)',
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span>·</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Rizika */}
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Rizika & zálohy
          </div>
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Riziko</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Prevence</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Fallback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {RISKS.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.risk}</td>
                    <td className="px-4 py-3 text-slate-600">{r.prevention}</td>
                    <td className="px-4 py-3 text-amber-700">{r.fallback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 sm:hidden">
            {RISKS.map((r, i) => (
              <div key={i} className="bg-white p-4">
                <div className="mb-1.5 font-medium text-slate-800">{r.risk}</div>
                <div className="mb-1 text-xs text-slate-600">
                  <span className="font-medium">Prevence:</span> {r.prevention}
                </div>
                <div className="text-xs text-amber-700">
                  <span className="font-medium">Fallback:</span> {r.fallback}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nouzové kontakty */}
        <div className="rounded-xl border border-red-100 bg-red-50 p-5">
          <h3 className="mb-3 font-semibold text-red-900">🆘 Nouzové kontakty</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: '112', desc: 'Záchrana + horská záchrana (GRZS) — Slovinsko' },
              { label: '113', desc: 'Policie Slovinsko' },
              { label: '1987', desc: 'GRZS — Gorska reševalna zveza Slovenija' },
              { label: 'TIC Bovec +386 5 302 96 47', desc: 'Aktivity, jízdní řády, taxi kontakt' },
              { label: 'ZS Bovec +386 5 620 33 22', desc: 'Zdravstvena postaja Bovec' },
              { label: 'Velvyslanectví ČR Ljubljana', desc: 'Konzulární pomoc (najít číslo předem)' },
            ].map((c) => (
              <div key={c.label} className="rounded-lg bg-white/60 px-3 py-2">
                <div className="font-semibold text-red-800">{c.label}</div>
                <div className="text-xs text-red-700">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Kontakty firem */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-800">Užitečné kontakty</h3>
          <div className="grid gap-1.5 sm:grid-cols-2 text-sm">
            {[
              ['Camp Bovec / Alpi Center', 'https://www.campbovec.com'],
              ['Rafting Slovinsko (CZ)', 'https://www.raftingslovinsko.cz'],
              ['Nomago (bus)', 'https://www.nomago.si'],
              ['FlixBus', 'https://www.flixbus.cz'],
              ['Hydromania (záloha)', 'https://www.hydromania.si'],
              ['Bovec Rafting Team (záloha)', 'https://www.bovec-rafting-team.com'],
            ].map(([name, url]) => (
              <div key={name} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-slate-400 flex-shrink-0" />
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 underline hover:text-sky-800"
                >
                  {name}
                </a>
              </div>
            ))}
          </div>
        </div>

        <Callout variant="info">
          Videa na YouTube si najdi vlastním vyhledáváním:{' '}
          <em>„rafting Soča Bovec vlog"</em> nebo{' '}
          <em>„pramen Soče ferrata vlog"</em> nebo{' '}
          <em>„Bovec canyoning Sušec vlog"</em>.
        </Callout>
      </div>
    </Section>
  );
}
