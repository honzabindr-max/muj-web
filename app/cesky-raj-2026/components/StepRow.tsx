import type { Step } from '../types';
import { Carousel } from './Carousel';
import { HighlightCard } from './HighlightCard';

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
      <div className="raj-step__row">
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

          {step.mapUrl && (
            <a className="raj-map-btn" href={step.mapUrl} target="_blank" rel="noreferrer">
              MAPA ↗
            </a>
          )}
        </div>
      </div>

      {step.subPoints && step.subPoints.length > 0 && <Carousel points={step.subPoints} />}

      {!step.subPoints && step.type === 'highlight' && (
        <HighlightCard photo={step.photo} name={step.place} note={step.instruction} />
      )}
    </div>
  );
}
