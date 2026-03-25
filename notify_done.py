import os,sys
import notify

engine = sys.argv[1] if len(sys.argv) > 1 else "seznam"
before = int(sys.argv[2]) if len(sys.argv) > 2 else 0
after = int(sys.argv[3]) if len(sys.argv) > 3 else 0
added = after - before

if engine == "google":
    label = "Google crawler"
    emoji = "🔵"
else:
    label = "Seznam crawler"
    emoji = "🔴"

msg = emoji + " *" + label + "* dokončen\n"
msg += "✅ Nových frází: +" + str(added) + "\n"
msg += "📁 Celkem v DB: " + str(after) + "\n"
msg += "📈 Před: " + str(before) + " → Po: " + str(after)
notify.send(msg)
