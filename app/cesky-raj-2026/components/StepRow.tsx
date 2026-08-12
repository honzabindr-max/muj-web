import type { Step } from '../types';
import { ThumbBox } from './PhotoBox';

const ICONS: Record<Step['type'], string> = {
  vlak: '🚆',
  bus: '🚌',
  taxi: '🚕',
  trek: '🥾',
  highlight: '⭐',
  jidlo: '🍽️',
  voda: '💧',
  kemp: '⛺',
  'plan-b': '🚨',
};

export function StepRow({
  step,
  isPast,
  isNext,
}: {
  step: Step;
  isPast: boolean;
  isNext: boolean;
}) {
  return (
    <div id={step.id} className="raj-step" data-past={isPast} data-next={isNext}>
      <div className="raj-step__time">{step.time}</div>
      <div className="raj-step__body">
        <div className="raj-step__head">
          <span className="raj-step__icon" aria-hidden="true">
            {ICONS[step.type]}
          </span>
          <span className="raj-step__place">{step.place}</span>
          {step.transferBadge && (
            <span className="raj-badge" data-level={step.transferBadge.level}>
              {step.transferBadge.label}
            </span>
          )}
        </div>
        {step.instruction && <div className="raj-step__instruction">{step.instruction}</div>}

        {step.subPoints && step.subPoints.length > 0 && (
          <div className="raj-thumb-row">
            {step.subPoints.map((sp) => (
              <div className="raj-thumb" key={sp.name}>
                <ThumbBox photo={sp.photo} name={sp.name} />
                <span className="raj-thumb__label">{sp.name}</span>
              </div>
            ))}
          </div>
        )}

        {!step.subPoints && step.type === 'highlight' && (
          <div className="raj-thumb-row">
            <div className="raj-thumb">
              <ThumbBox photo={step.photo} name={step.place} />
            </div>
          </div>
        )}

        {step.mapUrl && (
          <a className="raj-map-btn" href={step.mapUrl} target="_blank" rel="noreferrer">
            MAPA ↗
          </a>
        )}
      </div>
    </div>
  );
}
