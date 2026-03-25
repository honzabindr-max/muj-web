import json,os,sys,urllib.request
import notify

engine = sys.argv[1] if len(sys.argv) > 1 else "seznam"
url = os.environ.get("SUPABASE_URL","")
key = os.environ.get("SUPABASE_KEY","")
h = {"apikey": key, "Authorization": "Bearer " + key}

if engine == "google":
    state_table = "google_crawl_state"
    data_table = "google_suggestions"
    label = "Google crawler"
else:
    state_table = "crawl_state"
    data_table = "suggestions"
    label = "Seznam crawler"

try:
    state_url = url + "/rest/v1/" + state_table + "?select=*&id=eq.1"
    r = urllib.request.urlopen(urllib.request.Request(state_url, headers=h), timeout=10)
    s = json.loads(r.read())[0]

    total_url = url + "/rest/v1/" + data_table + "?select=id"
    r2 = urllib.request.urlopen(urllib.request.Request(total_url, headers=h), timeout=10)
    total = len(json.loads(r2.read()))

    msg = "✅ *" + label + "* dokončen\n"
    msg += "📊 Nových: +" + str(s.get("new_total", 0)) + "\n"
    msg += "📁 Celkem v DB: " + str(total) + "\n"
    msg += "🔍 Dotazů: " + str(s.get("queries_total", 0)) + "\n"
    msg += "📏 Hloubka: " + str(s.get("current_depth", 0))
    notify.send(msg)
except Exception as e:
    notify.send("⚠️ *" + label + "* — chyba při notifikaci: " + str(e))
