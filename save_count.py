import json,os,sys,urllib.request

url = os.environ.get("SUPABASE_URL","")
key = os.environ.get("SUPABASE_KEY","")
table = sys.argv[1] if len(sys.argv) > 1 else "crawl_state"
field = sys.argv[2] if len(sys.argv) > 2 else "count_before"
value = int(sys.argv[3]) if len(sys.argv) > 3 else 0

data = json.dumps({field: value}).encode()
req = urllib.request.Request(
    url + "/rest/v1/" + table + "?id=eq.1",
    data=data, method="PATCH",
    headers={"apikey": key, "Authorization": "Bearer " + key,
             "Content-Type": "application/json", "Prefer": "return=minimal"})
urllib.request.urlopen(req, timeout=10)
print("Saved " + field + "=" + str(value) + " to " + table)
