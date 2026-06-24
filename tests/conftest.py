import sys, os

# Root repo do sys.path aby šlo importovat watchdog, hetzner_watchdog, notify
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("SUGGEST_VERIFY_TOKEN", "test-token")
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "fake-key")
