import os,sys,urllib.request,urllib.parse,json

def send(msg):
    token=os.environ.get("TELEGRAM_TOKEN")
    chat=os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat:
        print("  ℹ Telegram not configured, skipping notification")
        return
    try:
        data=urllib.parse.urlencode({"chat_id":chat,"text":msg,"parse_mode":"Markdown"}).encode()
        urllib.request.urlopen(urllib.request.Request("https://api.telegram.org/bot"+token+"/sendMessage",data=data),timeout=10)
    except Exception as e:
        print("  ⚠ Telegram error: "+str(e))

if __name__=="__main__":
    send(" ".join(sys.argv[1:]) if len(sys.argv)>1 else "Test notification")
