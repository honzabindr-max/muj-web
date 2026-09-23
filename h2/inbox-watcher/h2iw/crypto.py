"""AES-256-GCM envelope for NOTE / COMMAND text at rest.

Byte layout matches H2 Buddy's h2/crypto/envelope.ts (iv 12 B | auth tag 16 B
| ciphertext, no AAD), so rows can later be moved into H2 with the same key
family. The key is 32 bytes, base64, from the environment:

- H2IW_ENCRYPTION_KEY   dedicated watcher key (key_id "h2iw"), preferred
- H2_ENCRYPTION_KEY_V1  H2 Buddy key v1 (key_id "h2-v1"), fallback
"""

from __future__ import annotations

import base64
import os
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

IV_LEN = 12
TAG_LEN = 16
KEY_ENV = (("H2IW_ENCRYPTION_KEY", "h2iw"), ("H2_ENCRYPTION_KEY_V1", "h2-v1"))


class CryptoError(RuntimeError):
    pass


@dataclass(frozen=True)
class Key:
    key_id: str
    raw: bytes


def load_key(env: dict[str, str] | None = None) -> Key:
    env = os.environ if env is None else env
    for name, key_id in KEY_ENV:
        value = env.get(name)
        if value:
            try:
                raw = base64.b64decode(value, validate=True)
            except ValueError:
                raise CryptoError(f"{name} is not valid base64")
            if len(raw) != 32:
                raise CryptoError(f"{name} must decode to 32 bytes")
            return Key(key_id, raw)
    raise CryptoError("missing env: H2IW_ENCRYPTION_KEY or H2_ENCRYPTION_KEY_V1")


def encrypt(key: Key, plaintext: str) -> bytes:
    iv = os.urandom(IV_LEN)
    sealed = AESGCM(key.raw).encrypt(iv, plaintext.encode("utf-8"), None)  # ct || tag
    ct, tag = sealed[:-TAG_LEN], sealed[-TAG_LEN:]
    return iv + tag + ct


def decrypt(key: Key, blob: bytes) -> str:
    iv, tag, ct = blob[:IV_LEN], blob[IV_LEN:IV_LEN + TAG_LEN], blob[IV_LEN + TAG_LEN:]
    try:
        return AESGCM(key.raw).decrypt(iv, ct + tag, None).decode("utf-8")
    except Exception as e:
        raise CryptoError(f"decrypt failed: {type(e).__name__}")
