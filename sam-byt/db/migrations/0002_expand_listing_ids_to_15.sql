-- SAM-BYT — rozšíření katalogu na sam-15.
-- Katalog je pořád statický JSON; DB drží jen uživatelský stav a historii.
-- Staré archivované řádky sam-02/sam-11 zůstávají povolené, aby se
-- neztratily poznámky, favority, hodnocení ani decision_events.

alter table sam_byt_user_listing_state
  drop constraint if exists sam_byt_user_listing_state_listing_id_check;

alter table sam_byt_user_listing_state
  add constraint sam_byt_user_listing_state_listing_id_check
  check (listing_id ~ '^sam-(0[1-9]|1[0-5])$');

alter table sam_byt_decision_events
  drop constraint if exists sam_byt_decision_events_listing_id_check;

alter table sam_byt_decision_events
  add constraint sam_byt_decision_events_listing_id_check
  check (listing_id ~ '^sam-(0[1-9]|1[0-5])$');
