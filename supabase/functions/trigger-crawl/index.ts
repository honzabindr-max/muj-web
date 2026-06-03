import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GITHUB_REPO = 'honzabindr-max/muj-web'
const GITHUB_WORKFLOW = 'google_crawl.yml'

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Read GitHub token from Vault via SECURITY DEFINER helper
    const { data: githubToken, error: tokenError } = await supabase.rpc('get_vault_secret', {
      secret_name: 'github_dispatch_token',
    })
    if (tokenError || !githubToken) {
      return new Response(
        JSON.stringify({ error: 'Vault read failed', detail: tokenError?.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Check crawler_control: skip dispatch if cooldown is active
    const { data: ctrl } = await supabase
      .from('crawler_control')
      .select('stop_flag, cooldown_until')
      .eq('id', 1)
      .single()

    if (ctrl?.stop_flag && ctrl?.cooldown_until) {
      const cooldownUntil = new Date(ctrl.cooldown_until)
      if (new Date() < cooldownUntil) {
        const remainingMin = Math.ceil((cooldownUntil.getTime() - Date.now()) / 60000)
        return new Response(
          JSON.stringify({
            status: 'skipped',
            reason: 'cooldown aktivní',
            cooldown_until: ctrl.cooldown_until,
            remaining_minutes: remainingMin,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    // Dispatch GitHub workflow
    const dispatchRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            dry_run: 'false',
            max_parallel: '2',
            batch_limit: '8',
            max_depth: '1',
            market_filter: '',
            reset_killswitch: 'false',
          },
        }),
      },
    )

    return new Response(
      JSON.stringify({
        status: 'dispatched',
        github_status: dispatchRes.status,
        ok: dispatchRes.ok,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
