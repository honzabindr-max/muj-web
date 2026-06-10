import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GITHUB_REPO = 'honzabindr-max/muj-web'
const GITHUB_WORKFLOW = 'crawl.yml'

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: githubToken, error: tokenError } = await supabase.rpc('get_vault_secret', {
      secret_name: 'github_dispatch_token',
    })
    if (tokenError || !githubToken) {
      return new Response(
        JSON.stringify({ error: 'Vault read failed', detail: tokenError?.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

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
        body: JSON.stringify({ ref: 'main' }),
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
