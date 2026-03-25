#!/usr/bin/env python3
"""Google Suggest Crawler — Czech (hl=cs). Same architecture as Seznam crawler."""
import json,os,sys,time,urllib.request,urllib.parse
from datetime import datetime,timezone

SUGGEST_URL="https://suggestqueries.google.com/complete/search"
SUGGEST_LIMIT=10;MAX_RETRIES=3;MAX_RUNTIME=25*60
EXPAND_CHARS=list("aábcčdďeéěfghiíjklmnňoópqrřsštťuúůvwxyýzž0123456789 ")
ALL_ROOTS=list("aábcčdďeéěfghiíjklmnňoópqrřsštťuúůvwxyýzž0123456789")
SAFE='=&.,()!*:"'

TABLE="google_suggestions"
STATE_TABLE="google_crawl_state"

class DB:
    def __init__(s,url,key):
        s.base=url.rstrip("/")+"/rest/v1";s.h={"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json"}
    def _req(s,m,p,d=None,eh=None):
        u=s.base+"/"+p;b=json.dumps(d).encode() if d else None;h=dict(s.h);h.update(eh or {})
        try:
            r=urllib.request.urlopen(urllib.request.Request(u,data=b,headers=h,method=m),timeout=30);t=r.read().decode()
            return json.loads(t) if t.strip() else None
        except urllib.error.HTTPError as e:
            code=e.code;err=e.read().decode()[:200]
            if code!=409:print("  ⚠ "+str(code)+": "+err[:80])
            return None
    def select(s,t,p=""):return s._req("GET",t+"?"+urllib.parse.quote(p,safe=SAFE)) or []
    def insert(s,t,d):return s._req("POST",t,d,{"Prefer":"return=representation"})
    def update(s,t,p,d):return s._req("PATCH",t+"?"+urllib.parse.quote(p,safe=SAFE),d,{"Prefer":"return=representation"})
    def count(s,t):return len(s.select(t,"select=id"))

class GoogleAPI:
    def __init__(s,delay=0.5):s.delay=delay;s.base=delay;s.reqs=0;s.errs=0;s.last=0
    def fetch(s,phrase):
        el=time.time()-s.last
        if el<s.delay:time.sleep(s.delay-el)
        params=urllib.parse.urlencode({"client":"firefox","q":phrase,"hl":"cs"})
        url=SUGGEST_URL+"?"+params
        for attempt in range(MAX_RETRIES):
            try:
                req=urllib.request.Request(url,headers={
                    "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept":"application/json","Accept-Language":"cs,en;q=0.5"})
                s.last=time.time()
                with urllib.request.urlopen(req,timeout=10) as r:
                    d=json.loads(r.read().decode());s.reqs+=1
                    if s.delay>s.base:s.delay=max(s.base,s.delay*0.95)
                    return d[1] if isinstance(d,list) and len(d)>=2 else []
            except urllib.error.HTTPError as e:
                s.errs+=1
                if e.code in(429,503):
                    s.delay=min(10.0,s.delay*2)
                    wait=s.delay*(attempt+1)
                    print("  ⚠ Google rate limited ("+str(e.code)+"), delay="+str(round(s.delay,1))+"s, čekám "+str(round(wait,1))+"s")
                    time.sleep(wait)
                elif e.code==403:print("  ✗ BLOCKED 403!");sys.exit(1)
                else:print("  ⚠ HTTP "+str(e.code)+", pokus "+str(attempt+1));time.sleep(2)
            except Exception as e:s.errs+=1;print("  ⚠ "+str(e)+", pokus "+str(attempt+1));time.sleep(2)
        return []

def load_state(db):
    rows=db.select(STATE_TABLE,"select=*&id=eq.1")
    if not rows:return None
    s=rows[0];s["queue"]=json.loads(s["queue"]);s["next_queue"]=json.loads(s["next_queue"])
    return s

def save_state(db,state):
    db.update(STATE_TABLE,"id=eq.1",{
        "current_depth":state["current_depth"],"status":state["status"],
        "queue":json.dumps(state["queue"]),"next_queue":json.dumps(state["next_queue"]),
        "processed":state["processed"],"queue_size":state["queue_size"],
        "current_prefix":state["current_prefix"],
        "queries_total":state["queries_total"],"new_total":state["new_total"],
        "updated_at":datetime.now(timezone.utc).isoformat()
    })

def run(db,api):
    state=load_state(db)
    if not state:print("✗ No "+STATE_TABLE+" row");return
    if state["status"] in ("idle","completed"):
        print("  🆕 Starting fresh Google crawl from depth 0")
        state["current_depth"]=0;state["queue"]=ALL_ROOTS[:];state["next_queue"]=[]
        state["processed"]=0;state["queue_size"]=len(ALL_ROOTS)
        state["queries_total"]=0;state["new_total"]=0;state["status"]="running";state["current_prefix"]=""
        db.update(STATE_TABLE,"id=eq.1",{"started_at":datetime.now(timezone.utc).isoformat()})
        save_state(db,state)
    if not state["queue"] and state["next_queue"]:
        state["current_depth"]+=1;state["queue"]=state["next_queue"][:];state["next_queue"]=[]
        state["processed"]=0;state["queue_size"]=len(state["queue"])
        print("  ⬆ Advancing to depth "+str(state["current_depth"])+" ("+str(state["queue_size"])+" prefixes)")
        save_state(db,state)
    if not state["queue"] and not state["next_queue"]:
        state["status"]="completed";save_state(db,state)
        print("  🏁 Google crawl complete!");return

    depth=state["current_depth"];queue=state["queue"];next_q=state["next_queue"]
    now=datetime.now(timezone.utc).isoformat();start=time.time()
    processed=state["processed"];queries=state["queries_total"];new_total=state["new_total"]
    total_in_q=state["queue_size"]
    print("  ▶ Depth "+str(depth)+" | Queue: "+str(len(queue))+" remaining / "+str(total_in_q)+" total | DB: "+str(db.count(TABLE))+" frází")
    print("─"*60)
    last_save=time.time()
    while queue:
        if time.time()-start>MAX_RUNTIME:
            print("\n  ⏰ Time limit (25 min). Saving state...");break
        prefix=queue.pop(0);processed+=1
        state["current_prefix"]=prefix;state["processed"]=processed
        state["queries_total"]=queries;state["new_total"]=new_total
        state["queue"]=queue;state["next_queue"]=next_q
        suggs=api.fetch(prefix);queries+=1
        new_count=0
        for s in suggs:
            ex=db.select(TABLE,"select=id&phrase=eq."+urllib.parse.quote(s)+"&limit=1")
            if not ex:
                db.insert(TABLE,[{"phrase":s,"first_seen_at":now,"last_seen_at":now,"seen_count":1}])
                new_count+=1
            else:
                db.update(TABLE,"id=eq."+str(ex[0]["id"]),{"last_seen_at":now})
        new_total+=new_count
        if len(suggs)>=SUGGEST_LIMIT:
            for c in EXPAND_CHARS:next_q.append(prefix+c)
        pct=round(processed/total_in_q*100) if total_in_q else 0
        elapsed=round(time.time()-start)
        if processed%10==0 or new_count>0:
            print("  [d"+str(depth)+" "+str(pct)+"%] '"+prefix+"' → "+str(len(suggs))+" suggs, +"+str(new_count)+" new | q="+str(queries)+" | "+str(elapsed)+"s | delay="+str(round(api.delay,2))+"s")
        if time.time()-last_save>30:
            save_state(db,state);last_save=time.time()
    state["queue"]=queue;state["next_queue"]=next_q;state["processed"]=processed
    state["queries_total"]=queries;state["new_total"]=new_total
    if not queue and not next_q:
        state["status"]="completed";print("\n  🏁 Google crawl complete!")
    elif not queue and next_q:
        print("\n  ✓ Depth "+str(depth)+" done. Next depth: "+str(len(next_q))+" prefixes.")
    save_state(db,state)
    dur=time.time()-start;ca=db.count(TABLE)
    print("\n"+"═"*60)
    print("  Depth:     "+str(depth))
    print("  Processed: "+str(processed)+"/"+str(total_in_q))
    print("  Queries:   "+str(queries))
    print("  New:       +"+str(new_total))
    print("  Errors:    "+str(api.errs))
    print("  Delay:     "+str(round(api.delay,2))+"s")
    print("  Duration:  "+str(round(dur))+"s ("+str(round(dur/60,1))+" min)")
    print("  DB total:  "+str(ca)+" frází")
    print("═"*60)

url=os.environ.get("SUPABASE_URL");key=os.environ.get("SUPABASE_KEY")
if not url or not key:print("✗ Set SUPABASE_URL and SUPABASE_KEY");sys.exit(1)
db=DB(url,key);api=GoogleAPI(0.5)
print("🔍 Google Suggest Crawler (cs)")
print("   Delay: 0.5s (adaptive)")
print("   Max runtime: 25 min")
try:
    run(db,api)
except Exception as e:
    print("FATAL: "+str(e))
