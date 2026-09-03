-- H2 Buddy — h2-runtime — 0014_telegram_rejected_audit_event
-- BUILD-04: rozšiřuje identity_audit_events_event_type_check (0012) o
-- TELEGRAM_MESSAGE_REJECTED_UNKNOWN_SENDER — stejný audit vzor jako
-- LOGIN_REJECTED_UNKNOWN_OWNER (owner_id null, bez obsahu payloadu),
-- ale pro cizí telegram_user_id mimo §31.1 allowlist. Aditivní změna,
-- žádná existující hodnota se neodstraňuje.

alter table identity_audit_events drop constraint identity_audit_events_event_type_check;

alter table identity_audit_events add constraint identity_audit_events_event_type_check
  check (
    event_type in (
      'LOGIN_SUCCESS', 'LOGIN_REJECTED_UNKNOWN_OWNER',
      'REAUTH_SUCCESS', 'REAUTH_EXPIRED', 'CSRF_REJECTED',
      'TELEGRAM_MESSAGE_REJECTED_UNKNOWN_SENDER'
    )
  );
