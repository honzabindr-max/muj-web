'use client';

import { useState } from 'react';
import { VOICES } from '../lib/content-data';

export function VoiceCards() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="h2-voices">
      {VOICES.map((voice) => {
        const isOpen = openId === voice.id;
        return (
          <button
            type="button"
            key={voice.id}
            className="h2-voice-card"
            data-open={isOpen}
            onClick={() => setOpenId(isOpen ? null : voice.id)}
            aria-expanded={isOpen}
          >
            <span className="h2-voice-sign">{voice.sign}</span>
            <span className="h2-voice-line">„{voice.motto}"</span>
            <div className="h2-voice-detail" data-open={isOpen} aria-hidden={!isOpen}>
              <div className="h2-voice-detail-inner">
                <p>
                  <strong>Dar:</strong> {voice.gift}
                </p>
                <p>
                  <strong>Když je toho moc:</strong> {voice.whenTooMuch}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
