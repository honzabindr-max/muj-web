import json,os,sys,urllib.request

url = os.environ.get("SUPABASE_URL","")
key = os.environ.get("SUPABASE_KEY","")
table = sys.argv[1] if len(sys.argv) > 1 else "suggestions"

h = {"apikey": key, "Authorization": "Bearer " + key, "Range": "0-0", "Prefer": "count=exact"}
r = urllib.request.urlopen(urllib.request.Request(
    url + "/rest/v1/" + table + "?select=id",
    headers=h), timeout=10)
cr = r.headers.get("Content-Range", "")
total = int(cr.split("/")[1]) if "/" in cr else 0
print(total)
