-- get_new_phrases_today: nové fráze od půlnoci Europe/Prague
-- Použito /suggest2 KPI "Přírůstek dnes" (monotónní, kotva 00:00)
-- Pro Supabase: aplikovat přes Supabase dashboard nebo CLI
-- Pro Hetzner: přidat ekvivalentní endpoint /suggest/new-phrases-today (PENDING — runner side)

CREATE OR REPLACE FUNCTION get_new_phrases_today()
RETURNS TABLE (gl TEXT, hl TEXT, new_today BIGINT)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT gl, hl, COUNT(*) AS new_today
  FROM google_suggestions_v2
  WHERE first_seen_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Prague')
  GROUP BY gl, hl;
$$;
