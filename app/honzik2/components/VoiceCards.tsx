import { VOICES } from '../lib/content-data';

export function VoiceCards() {
  return (
    <div className="h2-voices">
      {VOICES.map((voice) => (
        <div className="h2-voice-card" key={voice.id}>
          <span className="h2-voice-num">{voice.num}</span>
          <p className="h2-voice-sign">{voice.sign}</p>
          <p className="h2-voice-line">„{voice.motto}"</p>
          <p className="h2-voice-quote">„{voice.quote}"</p>
          <p className="h2-voice-detail">
            <strong>Když funguje dobře:</strong> {voice.gift}
          </p>
          <p className="h2-voice-detail">
            <strong>Když to přeženu:</strong> {voice.whenTooMuch}
          </p>
          {voice.closingNote && <p className="h2-voice-detail">{voice.closingNote}</p>}
        </div>
      ))}
    </div>
  );
}
