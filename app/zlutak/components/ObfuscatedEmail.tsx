'use client';

import { useEffect, useState } from 'react';

// Znakové kódy, ne prostý text — hodnota se nesmí objevit jako čitelný string
// ani v RSC payloadu SSR odpovědi, ani v JS bundlu; skládá se až za běhu v prohlížeči.
const USER_CODES = [106, 122, 101, 109, 108, 111, 118, 97];
const DOMAIN_CODES = [115, 101, 122, 110, 97, 109, 46, 99, 122];

function fromCodes(codes: number[]): string {
  return codes.map((c) => String.fromCharCode(c)).join('');
}

export function ObfuscatedEmail() {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    setAddress(`${fromCodes(USER_CODES)}@${fromCodes(DOMAIN_CODES)}`);
  }, []);

  if (!address) {
    return (
      <span className="z-email-placeholder" aria-label="e-mailová adresa, načítá se">
        e-mail…
      </span>
    );
  }

  return (
    <a href={`mailto:${address}`} className="z-email-link">
      {address}
    </a>
  );
}
