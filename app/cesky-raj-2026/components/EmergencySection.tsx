import { EMERGENCY } from '../data';

export function EmergencySection() {
  return (
    <section id="kdyz-se-neco-pokazi" className="raj-emergency">
      <h2 className="raj-emergency__title">🚨 Když se něco pokazí</h2>
      {EMERGENCY.map((item, i) => (
        <div className="raj-emergency__item" key={i}>
          <div className="raj-emergency__situace">{item.situace}</div>
          <div className="raj-emergency__reakce">
            <span className="raj-emergency__arrow">→</span> {item.reakce}
          </div>
        </div>
      ))}
    </section>
  );
}
