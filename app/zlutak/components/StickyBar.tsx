import { TOC } from '../lib/toc-data';
import { ChecklistProgress } from './ChecklistProgress';
import { ZlutakSummaryMini } from './ZlutakSummary';

export function StickyBar() {
  return (
    <div className="z-sticky-bar">
      <ZlutakSummaryMini />
      <ChecklistProgress />
      <details className="z-toc">
        <summary className="z-toc-summary">Obsah</summary>
        <nav className="z-toc-nav" aria-label="Obsah stránky">
          <ul>
            {TOC.map((entry) => (
              <li key={entry.id} data-level={entry.level}>
                <a href={`#${entry.id}`}>{entry.title}</a>
              </li>
            ))}
          </ul>
        </nav>
      </details>
    </div>
  );
}
