import { PROCESS_PHASES } from '../lib/content-data';

export function ProcessTimeline() {
  return (
    <div className="h2-phases">
      {PROCESS_PHASES.map((phase) => (
        <div className="h2-phase" key={phase.id}>
          <span className="h2-phase-num">{phase.id}</span>
          <div>
            <p className="h2-phase-title">{phase.title}</p>
            <p className="h2-phase-body">{phase.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
