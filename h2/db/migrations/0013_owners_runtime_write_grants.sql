-- H2 Buddy — h2-runtime — 0013_owners_runtime_write_grants
-- BUILD-03A bug fix: 0011 grantnul h2_runtime na owners jen SELECT, ale
-- první přihlášení (§31.1 enrollment) potřebuje INSERT nového ownera a
-- requireRecentReauth flow potřebuje UPDATE recent_reauth_at. Lokálně to
-- procházelo jen proto, že H2_RUNTIME_DATABASE_URL mířila na local DB bez
-- explicitní role (connectuje se jako OS superuser přes trust auth, tedy
-- bypassuje GRANT úplně) — v produkci se skutečně připojuje jako role
-- h2_runtime a INSERT spadl na "permission denied for table owners", což
-- se navenek projevilo jako NextAuth AccessDenied po úspěšném Google
-- souhlasu (signIn callback hodil chybu, NextAuth ji ukázal jako AccessDenied).

grant insert, update on owners to h2_runtime;
