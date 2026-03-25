#!/usr/bin/env python3
"""
Auto-depth crawler. Runs one session (up to 25 min), saves state, exits.
Cron restarts it. Crawls depth 0, then 1, 2... until exhausted.
"""
import json,os,sys,time,urllib.request,urllib.parse
from datetime import datetime,timezone

SUGGEST_URL="http://suggest.fulltext.seznam.cz/fulltext_ff"
SUGGEST_LIMIT=10;MAX_RETRIES=3;MAX_RUNTIME=25*60
EXPAND_CHARS=list("aábcčdďeéěfghiíjklmnňoópqrřsštťuúůvwxyýzž0123456789 ")
ALL_ROOTS=list("aábcčdďeéěfghiíjklmnňoópqrřsštťuúůvwxyýzž0123456789")
SAFE='=&.,()!*:"'

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
    def upsert(s,t,d):return s._req("POST",t,d,{"Prefer":"resolution=merge-duplicates,return=representation"})
    def update(s,t,p,d):return s._req("PATCH",t+"?"+urllib.parse.quote(p,safe=SAFE),d,{"Prefer":"return=representation"})
    def count(s,t):return len(s.select(t,"select=id"))

class SuggestAPI:
    def __init__(s,delay=0.12):s.delay=delay;s.base=delay;s.reqs=0;s.errs=0;s.last=0
    def fetch(s,phrase):
        el=time.time()-s.last
        if el<s.delay:time.sleep(s.delay-el)
        url=SUGGEST_URL+"?"+urllib.parse.urlencode({"phrase":phrase})
        for attempt in range(MAX_RETRIES):
            try:
                req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36","Accept":"application/json"})
                s.last=time.time()
                with urllib.request.urlopen(req,timeout=10) as r:
                    d=json.loads(r.read().decode());s.reqs+=1
                    if s.delay>s.base:s.delay=max(s.base,s.delay*0.95)
                    return d[1] if isinstance(d,list) and len(d)>=2 else []
            except urllib.error.HTTPError as e:
                s.errs+=1
                if e.code in(429,503):s.delay=min(5.0,s.delay*2);time.sleep(s.delay*(attempt+1))
                elif e.code==403:print("  ✗ BLOCKED 403");sys.exit(1)
                else:time.sleep(1)
            except:s.errs+=1;time.sleep(1)
        return []

def load_state(db):
    rows=db.select("crawl_state","select=*&id=eq.1")
    if not rows:return None
    s=rows[0];s["queue"]=json.loads(s["queue"]);s["next_queue"]=json.loads(s["next_queue"])
    return s

def save_state(db,state):
    db.update("crawl_state","id=eq.1",{
        "current_depth":state["current_depth"],"status":state["status"],
        "queue":json.dumps(state["queue"]),"next_queue":json.dumps(state["next_queue"]),
        "processed":state["processed"],"queue_size":state["queue_size"],
        "current_prefix":state["current_prefix"],
        "queries_total":state["queries_total"],"new_total":state["new_total"],
        "updated_at":datetime.now(timezone.utc).isoformat()
    })

def run(db,api):
    state=load_state(db)
    if not state:print("✗ No crawl_state row");return

    # If idle or completed — start fresh from depth 0
    if state["status"] in ("idle","completed"):
        print("  🆕 Starting fresh crawl from depth 0")
        state["current_depth"]=0
        state["queue"]=ALL_ROOTS[:]
        state["next_queue"]=[]
        state["processed"]=0
        state["queue_size"]=len(ALL_ROOTS)
        state["queries_total"]=0
        state["new_total"]=0
        state["status"]="running"
        state["current_prefix"]=""
        db.update("crawl_state","id=eq.1",{"started_at":datetime.now(timezone.utc).isoformat()})
        save_state(db,state)

    # If queue empty but next_queue has items — advance depth
    if not state["queue"] and state["next_queue"]:
        state["current_depth"]+=1
        state["queue"]=state["next_queue"][:]
        state["next_queue"]=[]
        state["processed"]=0
        state["queue_size"]=len(state["queue"])
        print("  ⬆ Advancing to depth "+str(state["current_depth"])+" ("+str(state["queue_size"])+" prefixes)")
        save_state(db,state)

    # If both empty — done
    if not state["queue"] and not state["next_queue"]:
        state["status"]="completed"
        save_state(db,state)
        print("  🏁 All depths exhausted. Crawl complete!")
        return

    depth=state["current_depth"]
    queue=state["queue"]
    next_q=state["next_queue"]
    now=datetime.now(timezone.utc).isoformat()
    start=time.time()
    processed=state["processed"]
    queries=state["queries_total"]
    new_total=state["new_total"]

    total_in_q=state["queue_size"]
    print("  ▶ Depth "+str(depth)+" | Queue: "+str(len(queue))+" remaining / "+str(total_in_q)+" total | DB: "+str(db.count("suggestions"))+" frází")
    print("─"*60)

    save_interval=30  # save state every 30s
    last_save=time.time()

    while queue:
        # Check time limit
        if time.time()-start>MAX_RUNTIME:
            print("\n  ⏰ Time limit (25 min). Saving state...")
            break

        prefix=queue.pop(0)
        processed+=1

        # Update live prefix in DB
        state["current_prefix"]=prefix
        state["processed"]=processed
        state["queries_total"]=queries
        state["new_total"]=new_total
        state["queue"]=queue
        state["next_queue"]=next_q

        suggs=api.fetch(prefix)
        queries+=1

        # Insert new suggestions (upsert to avoid 409)
        new_count=0
        for s in suggs:
            ex=db.select("suggestions","select=id&phrase=eq."+urllib.parse.quote(s)+"&limit=1")
            if not ex:
                db.insert("suggestions",[{"phrase":s,"first_seen_at":now,"last_seen_at":now,"seen_count":1}])
                new_count+=1
            else:
                db.update("suggestions","id=eq."+str(ex[0]["id"]),{"last_seen_at":now})

        new_total+=new_count

        # If saturated → expand for next depth
        if len(suggs)>=SUGGEST_LIMIT:
            for c in EXPAND_CHARS:
                next_q.append(prefix+c)

        # Progress log
        pct=round(processed/total_in_q*100) if total_in_q else 0
        elapsed=round(time.time()-start)
        if processed%10==0 or new_count>0:
            print("  [d"+str(depth)+" "+str(pct)+"%] '"+prefix+"' → "+str(len(suggs))+" suggs, +"+str(new_count)+" new | q="+str(queries)+" | "+str(elapsed)+"s | next_d: "+str(len(next_q)))

        # Periodic save
        if time.time()-last_save>save_interval:
            state["queue"]=queue;state["next_queue"]=next_q;state["processed"]=processed
            state["queries_total"]=queries;state["new_total"]=new_total
            save_state(db,state)
            last_save=time.time()

    # Final save
    state["queue"]=queue;state["next_queue"]=next_q;state["processed"]=processed
    state["queries_total"]=queries;state["new_total"]=new_total

    if not queue and not next_q:
        state["status"]="completed"
        print("\n  🏁 Crawl complete! No more prefixes.")
    elif not queue and next_q:
        print("\n  ✓ Depth "+str(depth)+" done. Next depth has "+str(len(next_q))+" prefixes.")

    save_state(db,state)

    dur=time.time()-start
    ca=db.count("suggestions")
    print("\n"+"═"*60)
    print("  Depth:     "+str(depth))
    print("  Processed: "+str(processed)+"/"+str(total_in_q))
    print("  Queries:   "+str(queries))
    print("  New:       +"+str(new_total))
    print("  Errors:    "+str(api.errs))
    print("  Duration:  "+str(round(dur))+"s ("+str(round(dur/60,1))+" min)")
    print("  DB total:  "+str(ca)+" frází")
    print("  Next depth queue: "+str(len(next_q))+" prefixes")
    print("═"*60)

url=os.environ.get("SUPABASE_URL");key=os.environ.get("SUPABASE_KEY")
if not url or not key:print("✗ Set SUPABASE_URL and SUPABASE_KEY");sys.exit(1)
db=DB(url,key);api=SuggestAPI(0.12)
print("🔍 Auto-depth Crawler")
print("   Max runtime: 25 min")
print("   DB: "+url)
try:
    run(db,api)
except Exception as e:
    print("FATAL: "+str(e))
    save_state(db,state) if "state" in dir() else None
